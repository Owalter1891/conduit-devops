#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# The EIP may be attached while cloud-init is starting. Retry network operations.
apt-get -o Acquire::Retries=10 update
apt-get -o Acquire::Retries=10 install -y docker.io docker-compose-v2 openssl
install -d -m 700 /opt/conduit

# Bound container logs so the small disk does not fill up.
cat > /etc/docker/daemon.json <<'JSON'
{"log-driver":"local","log-opts":{"max-size":"10m","max-file":"3"}}
JSON
systemctl enable docker
systemctl restart docker

# Give the 1 GiB VM some room during image pulls and application startup.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Secrets are generated here, never in GitHub, user-data or Terraform state.
if [ ! -f /opt/conduit/.env.production ]; then
  umask 077
  {
    printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 32)"
    printf 'JWT_KEY=%s\n' "$(openssl rand -hex 32)"
  } > /opt/conduit/.env.production
fi
# A dedicated key grants deployment access to this VM only. The forced command
# reads the deployment script on stdin; it cannot open a shell or forward ports.
id -u deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
cat > /usr/local/sbin/conduit-deploy <<'SH'
#!/usr/bin/env bash
set -euo pipefail
exec flock -w 900 /opt/conduit/deploy.lock bash -se
SH
chmod 755 /usr/local/sbin/conduit-deploy
printf 'deploy ALL=(root) NOPASSWD: /usr/local/sbin/conduit-deploy\n' > /etc/sudoers.d/conduit-deploy
chmod 440 /etc/sudoers.d/conduit-deploy
visudo -cf /etc/sudoers.d/conduit-deploy
cat > /etc/ssh/sshd_config.d/00-conduit.conf <<'SSH'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
SSH
install -d -m 755 /run/sshd
sshd -t
systemctl restart ssh

