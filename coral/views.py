from django.shortcuts import render
from .infra import db
import json

# Create your views here.
def index(request):
    with db.obter_conexao() as con:
        result = con.execute("""
            SELECT 
                pais, 
                ST_AsGeoJSON(areas) as coordenadas  -- Assumindo que isto retorna uma string GeoJSON ou WKT
            FROM regiao
        """).fetchall()
        
    recifes = []
    for pais, geojson_str in result:
        recifes.append({
            'pais': pais,
            'coordenadas': json.loads(geojson_str)
        })
        
  
    return render(request, 'index.html', {
        'recifes': recifes
    })

def getMediaMes(request):
    pais = request.GET.get('pais')  # Exemplo: obter o país da query string, com um valor padrão
    if not pais:
        return 404
    
    # with db.obter_conexao() as db:
    #     result = db.execute("""
    #         SELECT 
    #             mes, 
    #             media
    #         FROM media_mes
    #     """).fetchall()
        
    # return render(request, 'index.html', {
    #     'medias': medias
    # })