import time
import pandas as pd
from coral.infra import db
from .base_copernicus import BaseCopernicusService

class CopernicusTemperaturaService(BaseCopernicusService):
    dataset_id = "cmems_mod_glo_phy_my_0.083deg_P1D-m"
    variables = ["thetao", "so", "uo", "vo"]

    def limpar_dataframe(self, df):
        df.reset_index(inplace=True)
        df.dropna(subset=['thetao'], inplace=True)
        df['thetao'] = df['thetao'].astype('float32')
        df['time'] = pd.to_datetime(df['time']).dt.date
        return df

    def salvar_duckdb(self, df, regiaogem):
        start = time.perf_counter()
        with db.obter_conexao(True) as con:
            con.execute("""
                CREATE TABLE IF NOT EXISTS monitoramento_temp_mar (
                    time DATE, ponto POINT_2D, profundidade FLOAT, 
                    temperatura FLOAT, salinidade FLOAT, corrente_zonal FLOAT, corrente_meridional FLOAT
                )
            """)
            con.execute("""
                INSERT INTO monitoramento_temp_mar 
                SELECT time, ST_Point(longitude, latitude) as ponto, round(depth, 5) as profundidade, 
                       thetao as temperatura, so as salinidade, uo as corrente_zonal, vo as corrente_meridional   
                FROM df
                WHERE ST_Within(ponto, ST_GeomFromText(?))
            """, [regiaogem])
        return time.perf_counter() - start