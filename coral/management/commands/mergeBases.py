from datetime import date
from django.core.management.base import BaseCommand, CommandError
from coral.services.copernicus_merge_databases import CopernicusMergeDatabases

class Command(BaseCommand):
    def _parse_date(self, value):
        try:
            return date.fromisoformat(value)
        except ValueError:
            raise CommandError(f"A data '{value}' não está no formato ISO (AAAA-MM-DD).")

    def add_arguments(self, parser):
        parser.add_argument('--vacumm', type=bool, default=True)

    def handle(self, *args, **kwargs):

        servico = CopernicusMergeDatabases()
        try:
            # Passamos self.stdout.write para manter o log colorido no terminal Django
            servico.mergeDatabases(kwargs['vacumm'])
            self.stdout.write("Merge concluído com sucesso.")
        except Exception as e:
            raise CommandError(f"Erro na operação: {e}")