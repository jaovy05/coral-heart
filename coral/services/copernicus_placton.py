import time
import pandas as pd
from coral.infra import db
from .base_copernicus import BaseCopernicusService

class CopernicusPlanctonService(BaseCopernicusService):
    dataset_id = "cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m"
    variables = ["nppv", "o2"]

    def limpar_dataframe(self, df):
        df.reset_index(inplace=True)
        df.dropna(subset=['nppv'], inplace=True)
        df['time'] = pd.to_datetime(df['time']).dt.date
        return df

    def salvar_duckdb(self, df, regiaogem):
        start = time.perf_counter()
        with db.obter_conexao(True) as con:
            con.execute("""
                CREATE TABLE IF NOT EXISTS monitoramento_temp_vida (
                    time DATE, ponto POINT_2D, profundidade FLOAT, 
                    plancton FLOAT, oxigenio FLOAT
                )
            """)
            con.execute("""
                INSERT INTO monitoramento_temp_vida 
                SELECT time, ST_Point(longitude, latitude) as ponto, round(depth, 5) as profundidade, 
                       nppv as plancton, o2 as oxigenio
                FROM df
                WHERE ST_Within(ponto, ST_GeomFromText(?))
            """, [regiaogem])
        return time.perf_counter() - start