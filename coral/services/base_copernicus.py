from abc import ABC, abstractmethod
import time
import gc
import pandas as pd
import copernicusmarine
from coral.infra import db

class BaseCopernicusService(ABC):
    db_path = "data/data.db"

    @property
    @abstractmethod
    def dataset_id(self) -> str: pass

    @property
    @abstractmethod
    def variables(self) -> list: pass

    @abstractmethod
    def limpar_dataframe(self, df) -> pd.DataFrame: pass

    @abstractmethod
    def salvar_duckdb(self, df, regiaogem) -> float: pass

    def calcular_janela_maxima(self, area: float, limite_ram_gb: float = 5.5) -> int:
        # Fator calibrado multi-log com 10% de margem de segurança anti-estouro
        fator_densidade_calibrado = 0.0004
        
        # dias = RAM / (area * fator)
        dias_estimados = int(limite_ram_gb / (area * fator_densidade_calibrado))
        
        return min(dias_estimados, 3650)

    def get_regiao(self, regiao_id):
        query = """
            WITH sub_poligonos AS (
                SELECT UNNEST(ST_Dump(areas)).geom AS poli FROM regiao WHERE id = ?
            )
            SELECT ST_XMin(poli), ST_XMax(poli), ST_YMin(poli), ST_YMax(poli), ST_AsText(poli), st_area(poli)
            FROM sub_poligonos;
        """
        with db.obter_conexao() as con:
            return con.execute(query, [regiao_id]).fetchall()

    def executar(self, initial_date, final_date, regiao_id, log_func=print):
        regiao_coords = self.get_regiao(regiao_id)
        tempo_duck_total, linhas_total, i = 0, 0, 0
        log_func(f"Inicio do processamento para região {regiao_id} de {initial_date} a {final_date}")
        for coords in regiao_coords:
            min_lon, max_lon, min_lat, max_lat, regiaogem, area = coords
            current_date = initial_date
            tempo_banco_coord, linhas_total_cood = 0, 0
            log_func(f"    Processando sub_região {i} com área de {area * 12364:.2f} Km²")
            while current_date <= final_date:
                days = self.calcular_janela_maxima(area)
                final_datetemp = min(current_date + pd.Timedelta(days=days), final_date)
                log_func(f"        Processando: {current_date.isoformat()} até {final_datetemp.isoformat()} (days: {days})")
                
                start_read = time.perf_counter()
                df = copernicusmarine.read_dataframe(
                    dataset_id=self.dataset_id,
                    dataset_version="202311",
                    dataset_part="default",
                    variables=self.variables,
                    minimum_longitude=min_lon, maximum_longitude=max_lon,
                    minimum_latitude=min_lat, maximum_latitude=max_lat,
                    start_datetime=current_date.isoformat(),
                    end_datetime=final_datetemp.isoformat(),
                    minimum_depth=2.0, maximum_depth=10.0,
                )
                tempo_leitura = time.perf_counter() - start_read

                df = self.limpar_dataframe(df)
                linhas = len(df)
                log_func(f"    DF carregado: {linhas} linhas em {tempo_leitura:.2f}s (memória: {df.memory_usage(deep=True).sum() / 1e6:.2f} MB)")
                
                tempo_duck = self.salvar_duckdb(df, regiaogem)
                tempo_banco_coord += tempo_duck
                linhas_total_cood += linhas
                gc.collect()

                log_func(f"    Lote concluído. DuckDB: {tempo_duck:.4f}s\n" + "-"*40)
                current_date = final_datetemp + pd.Timedelta(days=1)

            linhas_total += linhas_total_cood
            tempo_duck_total += tempo_banco_coord
            log_func(f"Sub região {i} ({area * 12364:.2f} Km²) concluída. Total: {linhas_total_cood} linhas | Tempo DuckDB: {tempo_banco_coord:.4f}s\n" + "="*40)
            i += 1
        log_func(f"Total: {linhas_total} linhas | Tempo DuckDB: {tempo_duck_total:.4f}s\n" + "="*40)