#!/usr/bin/env python3
"""Read the SSH host key through authenticated AWS SSM, never trust a network scan."""
import ipaddress
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time


def aws(*args):
    result = subprocess.run(["aws", *args, "--output", "json", "--no-cli-pager"],
                            capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def main():
    instance = os.environ["AWS_INSTANCE_ID"]
    address = str(ipaddress.IPv4Address(os.environ["AWS_HOST"]))
    actual = aws("ec2", "describe-instances", "--instance-ids", instance)
    if actual["Reservations"][0]["Instances"][0]["PublicIpAddress"] != address:
        raise ValueError("AWS_HOST does not match the instance's public IP")
    deadline = time.monotonic() + 600
    while time.monotonic() < deadline:
        info = aws("ssm", "describe-instance-information", "--filters",
                   f"Key=InstanceIds,Values={instance}")["InstanceInformationList"]
        if any(item["PingStatus"] == "Online" for item in info):
            break
        time.sleep(10)
    else:
        raise TimeoutError("VM has not connected to Systems Manager")
    command = aws("ssm", "send-command", "--instance-ids", instance,
                  "--document-name", "AWS-RunShellScript", "--parameters", json.dumps({
                      "commands": ["set -e", "timeout 600 bash -c 'until test -f /opt/conduit/bootstrap-complete; do sleep 5; done'",
                                   "cat /etc/ssh/ssh_host_ed25519_key.pub"],
                      "executionTimeout": ["650"],
                  }))["Command"]["CommandId"]
    print("Waiting for bootstrap; SSM command:", command, flush=True)
    deadline = time.monotonic() + 700
    while time.monotonic() < deadline:
        try:
            result = aws("ssm", "get-command-invocation", "--command-id", command,
                         "--instance-id", instance)
        except subprocess.CalledProcessError as error:
            if "InvocationDoesNotExist" not in error.stderr:
                raise
            time.sleep(5)
            continue
        status = result["Status"]
        if status == "Success":
            key = result["StandardOutputContent"].strip().split()
            if len(key) < 2 or key[0] != "ssh-ed25519" or not re.fullmatch(r"[A-Za-z0-9+/=]+", key[1]):
                raise ValueError("AWS did not return a valid Ed25519 host key")
            target = Path(__file__).parent / ".ssh" / "known_hosts"
            target.parent.mkdir(exist_ok=True, mode=0o700)
            target.write_text(f"{address} {key[0]} {key[1]}\n")
            print("Verified host key saved to", target)
            return
        if status not in {"Pending", "InProgress", "Delayed"}:
            raise RuntimeError(f"Host verification failed: {status}: {result.get('StandardErrorContent', '')}")
        time.sleep(10)
    raise TimeoutError("Bootstrap did not finish; inspect cloud-init logs in AWS")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as error:
        print(error.stderr, file=sys.stderr)
        sys.exit(1)
