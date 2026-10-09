#!/usr/bin/env python3
"""Deploy a public, digest-pinned GHCR image over SSH with a pinned server host key."""

import base64
import ipaddress
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]


def deployment_commands(image, address):
    if not re.fullmatch(
        r"ghcr\.io/owalter1891/conduit-devops:sha-[0-9a-f]{40}@sha256:[0-9a-f]{64}",
        image,
    ):
        raise ValueError("APP_IMAGE must be this repository's full commit tag and SHA-256 digest")
    domain = f"{ipaddress.IPv4Address(address)}.sslip.io"
    commands = ["set -eu", "cd /opt/conduit", "mkdir -p infra/aws"]
    for name in [
        "compose.production.yaml", "infra/aws/compose.aws.yaml",
        "infra/aws/Caddyfile", "infra/aws/deploy-remote.sh",
    ]:
        encoded = base64.b64encode((ROOT / name).read_bytes()).decode()
        commands.append(f"printf %s {shlex.quote(encoded)} | base64 -d > {shlex.quote(name)}")
    commands.append(
        f"APP_IMAGE={shlex.quote(image)} APP_DOMAIN={shlex.quote(domain)} "
        "bash infra/aws/deploy-remote.sh"
    )
    return commands


def main():
    address = str(ipaddress.IPv4Address(os.environ["AWS_HOST"]))
    commands = deployment_commands(os.environ["APP_IMAGE"], address)
    known_hosts = os.environ["AWS_SSH_KNOWN_HOSTS"].strip()
    if not any(line.startswith(address + " ssh-ed25519 ") for line in known_hosts.splitlines()):
        raise ValueError("AWS_SSH_KNOWN_HOSTS must contain the verified Ed25519 key for AWS_HOST")

    with tempfile.TemporaryDirectory(prefix="conduit-ssh-") as directory:
        directory = Path(directory)
        hosts = directory / "known_hosts"
        hosts.write_text(known_hosts + "\n")
        if key_file := os.environ.get("AWS_SSH_KEY_FILE"):
            key = Path(key_file).resolve()
        else:
            key = directory / "deploy"
            key.write_text(os.environ["AWS_SSH_PRIVATE_KEY"].strip() + "\n")
            key.chmod(0o600)
        # No ssh-keyscan here: the server key must be verified through AWS first.
        subprocess.run([
            "ssh", "-T", "-i", str(key),
            "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes",
            "-o", "StrictHostKeyChecking=yes", "-o", f"UserKnownHostsFile={hosts}",
            "-o", "ConnectTimeout=20", "-o", "ServerAliveInterval=15",
            "-o", "ServerAliveCountMax=4", f"deploy@{address}",
        ], input="\n".join(commands) + "\n", text=True, check=True, timeout=1200)

    url = f"https://{address}.sslip.io"
    print(f"Deployed: {url}")
    if output := os.environ.get("GITHUB_OUTPUT"):
        with open(output, "a") as file:
            file.write(f"url={url}\n")


if __name__ == "__main__":
    try:
        main()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, ValueError, KeyError) as error:
        print(f"Deployment failed: {error}", file=sys.stderr)
        sys.exit(1)
