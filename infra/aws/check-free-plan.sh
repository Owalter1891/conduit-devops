#!/usr/bin/env bash
set -euo pipefail

# Read-only check. Fails closed if AWS cannot confirm an active Free Plan.
aws freetier get-account-plan-state --region us-east-1 --output json --no-cli-pager |
  python3 -c '
import json, sys
p = json.load(sys.stdin)
credits = p.get("accountPlanRemainingCredits", {})
if p.get("accountPlanType") != "FREE" or p.get("accountPlanStatus") != "ACTIVE" or float(credits.get("amount", 0)) <= 0:
    sys.exit("STOP: AWS did not confirm an active Free Plan with credits. Do not apply Terraform.")
print("Free Plan verified. Credits remaining:", credits["amount"], credits.get("unit", ""))
print("Plan expires:", p.get("accountPlanExpirationDate", "Check Billing console"))
'
