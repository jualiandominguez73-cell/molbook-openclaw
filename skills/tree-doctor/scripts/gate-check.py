#!/usr/bin/env python3
"""
Check if user has access to tree-doctor skill via stripe-gate.
Returns JSON with access status and checkout URL if needed.
"""

import json
import subprocess
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).parent.parent
STRIPE_GATE_DIR = SKILL_DIR.parent / "stripe-gate"

def check_access(user_id: str) -> dict:
    """Check subscription and return access info."""
    check_script = STRIPE_GATE_DIR / "scripts" / "check.py"
    checkout_script = STRIPE_GATE_DIR / "scripts" / "create-checkout.py"
    
    # Check subscription status
    result = subprocess.run(
        [sys.executable, str(check_script), user_id, "--json"],
        capture_output=True, text=True
    )
    
    try:
        status = json.loads(result.stdout)
    except json.JSONDecodeError:
        status = {"status": result.stdout.strip().lower()}
    
    if status.get("status") == "active":
        return {
            "access": True,
            "user_id": user_id,
            "message": None
        }
    
    # Not active - get checkout URL
    checkout_result = subprocess.run(
        [sys.executable, str(checkout_script), user_id],
        capture_output=True, text=True,
        env={**subprocess.os.environ}
    )
    
    checkout_url = checkout_result.stdout.strip()
    
    return {
        "access": False,
        "user_id": user_id,
        "status": status.get("status", "inactive"),
        "checkout_url": checkout_url if checkout_url and not checkout_url.startswith("ERROR") else None,
        "message": f"""🌳 **Tree Amigos Pro Required**

Get unlimited tree disease diagnosis for just $5/month!

✓ Instant AI diagnosis from photos
✓ Treatment recommendations  
✓ Prevention tips
✓ Unlimited queries

{f'Subscribe here: {checkout_url}' if checkout_url and not checkout_url.startswith("ERROR") else 'Contact support to subscribe.'}"""
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: gate-check.py <user_id> [--json]", file=sys.stderr)
        sys.exit(1)
    
    user_id = sys.argv[1]
    as_json = "--json" in sys.argv
    
    result = check_access(user_id)
    
    if as_json:
        print(json.dumps(result, indent=2))
    else:
        if result["access"]:
            print("ACCESS_GRANTED")
        else:
            print(result["message"])

if __name__ == "__main__":
    main()
