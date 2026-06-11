from datetime import date
from django.core.management.base import BaseCommand, CommandError
from coral.services.copernicus_placton import CopernicusPlanctonService

class Command(BaseCommand):
    def _parse_date(self, value):
        try:
            return date.fromisoformat(value)
        except ValueError:
            raise CommandError(f"A data '{value}' não está no formato ISO (AAAA-MM-DD).")

    def add_arguments(self, parser):
        parser.add_argument('--start_date', type=self._parse_date)
        parser.add_argument('--end_date', type=self._parse_date)
        parser.add_argument('--regiao', type=int)

    def handle(self, *args, **kwargs):
        if kwargs['end_date'] < kwargs['start_date']:
            raise CommandError('A data final deve ser maior ou igual à inicial.')

        servico = CopernicusPlanctonService()
        try:
            # Passamos self.stdout.write para manter o log colorido no terminal Django
            servico.executar(
                kwargs['start_date'], 
                kwargs['end_date'], 
                kwargs['regiao'], 
                log_func=self.stdout.write
            )
        except Exception as e:
            raise CommandError(f"Erro na operação: {e}")