from coral.infra import db

class CopernicusMergeDatabases:

    def mergeDatabases(self, vacumm=True):
        with db.obter_conexao(True) as connection:
            connection.execute("""
                create table if not exists monitoramento (
                    time DATE, ponto POINT_2D, profundidade FLOAT, 
                    temperatura FLOAT, salinidade FLOAT, corrente_zonal FLOAT, corrente_meridional FLOAT
                    , oxigenio FLOAT, plancton FLOAT
                )
            """)
            connection.execute("""
                insert into monitoramento  
                select 
                    mar.time,
                    mar.ponto,
                    mar.profundidade,
                    mar.temperatura, 
                    mar.salinidade, 
                    mar.corrente_zonal, 
                    mar.corrente_meridional, 
                    vida.oxigenio, 
                    vida.plancton
                from (select *, rowid from monitoramento_temp_mar) as mar
                left join monitoramento_temp_vida as vida on
                    vida.time = mar.time 
                    and vida.profundidade = mar.profundidade
                    qualify row_number() over (
                        partition by mar.time, mar.profundidade, mar.rowid
                        order by mar.salinidade asc 
                    ) = 1
                """
            )

            connection.execute("truncate table monitoramento_temp_mar")
            connection.execute("truncate table monitoramento_temp_vida")
            if vacumm: 
                connection.execute("vacuum")
       
