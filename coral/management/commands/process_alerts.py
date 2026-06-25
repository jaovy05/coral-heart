from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from coral.models import Alerta
from coral.infra import db
from django.conf import settings

class Command(BaseCommand):
    help = 'Processa alertas de temperatura diários'

    def handle(self, *args, **options):
        alertas = Alerta.objects.filter(active=True)
        
        with db.obter_conexao() as conn:
            for alerta in alertas:
                # Busca temperatura atual para a região
                # Assume-se que 'region_name' corresponde ao nome na tabela 'regiao'
                temp_atual = conn.execute("""
                    SELECT AVG(temperatura) 
                    FROM monitoramento_temp_mar m
                    JOIN regiao r ON ST_Intersects(m.ponto, ST_SetSRID(r.areas, 4326))
                    WHERE r.pais = ?
                      AND m.time = CURRENT_DATE
                """, (alerta.region_name,)).fetchone()[0]

                if temp_atual and temp_atual >= alerta.target_temp:
                    self.send_alert(alerta, temp_atual)
                    
                    if not alerta.repeat:
                        alerta.active = False
                        alerta.save()

    def send_alert(self, alerta, temp):
        send_mail(
            subject=f'Alerta de Temperatura: {alerta.region_name}',
            message=f'A região {alerta.region_name} atingiu {temp:.2f}°C, ultrapassando seu limite de {alerta.target_temp}°C.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[alerta.user.email],
            fail_silently=False,
        )
        self.stdout.write(f'Alerta enviado para {alerta.user.email}')
