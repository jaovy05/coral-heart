from django.test import TestCase
from django.core.management import call_command
from unittest.mock import patch, MagicMock
from django.contrib.auth.models import User
from coral.models import Alerta

class AlertaTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='joaovitor@estudante.uffs.edu.br')
        self.alerta = Alerta.objects.create(
            user=self.user, region_name='Test Region', target_temp=25.0, active=True
        )

    @patch('coral.management.commands.process_alerts.send_mail')
    @patch('coral.management.commands.process_alerts.db.obter_conexao')
    def test_process_alerts_sends_email(self, mock_db, mock_send_mail):
        # Mock DB
        mock_conn = MagicMock()
        mock_db.return_value.__enter__.return_value = mock_conn
        # Simula retorno de temperatura 26.0 (acima de 25.0)
        mock_conn.execute.return_value.fetchone.return_value = [26.0] 

        call_command('process_alerts')

        mock_send_mail.assert_called_once()
        self.assertEqual(mock_send_mail.call_args[1]['recipient_list'], ['joaovitor@estudante.uffs.edu.br'])
        self.assertIn('26.00°C', mock_send_mail.call_args[1]['message'])

