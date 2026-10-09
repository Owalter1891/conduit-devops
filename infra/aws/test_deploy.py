import subprocess
import unittest

from deploy import deployment_commands


class DeploymentInputTests(unittest.TestCase):
    image = 'ghcr.io/owalter1891/conduit-devops:sha-' + 'a' * 40 + '@sha256:' + 'b' * 64

    def test_valid_payload_is_valid_shell(self):
        commands = deployment_commands(self.image, '192.0.2.10')
        subprocess.run(['bash', '-n'], input='\n'.join(commands), text=True, check=True)
        self.assertIn(self.image, commands[-1])
        self.assertIn('192.0.2.10.sslip.io', commands[-1])

    def test_rejects_mutable_tag(self):
        with self.assertRaises(ValueError):
            deployment_commands('ghcr.io/owalter1891/conduit-devops:latest', '192.0.2.10')

    def test_rejects_other_repository(self):
        with self.assertRaises(ValueError):
            deployment_commands(self.image.replace('owalter1891', 'someone-else'), '192.0.2.10')

    def test_rejects_shell_injection_in_image(self):
        with self.assertRaises(ValueError):
            deployment_commands(self.image + '; id', '192.0.2.10')

    def test_rejects_shell_injection_in_host(self):
        with self.assertRaises(ValueError):
            deployment_commands(self.image, '192.0.2.10; id')


if __name__ == '__main__':
    unittest.main()
