#!/usr/bin/env python3
"""
ValleLogic Device Provisioning Script
Usage: python3 provision.py --cpu-serial <CPU_SERIAL> --nr-serial <NR_SERIAL>

Run from Mac Mini in ~/netrunner-dashboard directory.
Requires: DATABASE_URL, VALLELOGIC_PROVISION_SECRET, CLOUDFLARE_ACCOUNT_ID,
          CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID in .env.local
"""

import argparse
import base64
import hashlib
import hmac
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

try:
    import urllib.request
except ImportError:
    pass


def load_env():
    """Load .env.local from current directory."""
    env_path = Path(".env.local")
    if not env_path.exists():
        print("ERROR: .env.local not found. Run from ~/netrunner-dashboard")
        sys.exit(1)

    env = {}
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        val = val.strip().strip(chr(34)).strip(chr(39))
        env[key.strip()] = val
    return env


def generate_device_id():
    """Generate a nr-prefixed UUID."""
    return f"nr-{uuid.uuid4()}"


def generate_cpu_serial_hash(cpu_serial: str, secret: str) -> str:
    """HMAC-SHA256 of cpu_serial using provision secret."""
    return hmac.new(
        secret.encode(),
        cpu_serial.lower().strip().encode(),
        hashlib.sha256
    ).hexdigest()


def generate_device_key(device_id: str, cpu_serial: str, secret: str) -> str:
    """Generate the device key stored on the Pi."""
    payload = f"{device_id}:{cpu_serial.lower().strip()}"
    h = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"vl_{h}"


def generate_device_key_hash(device_key: str) -> str:
    """SHA256 hash of the device key for DB storage."""
    return hashlib.sha256(device_key.encode()).hexdigest()


def generate_tunnel_secret() -> str:
    """Generate a random 32-byte base64-encoded tunnel secret."""
    return base64.b64encode(os.urandom(32)).decode()


def cf_api(method: str, path: str, token: str, data: dict = None) -> dict:
    """Make a Cloudflare API request."""
    url = f"https://api.cloudflare.com/client/v4{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        result = json.loads(e.read())

    if not result.get("success"):
        errors = result.get("errors", [])
        print(f"ERROR: Cloudflare API {method} {path} failed: {errors}")
        sys.exit(1)
    return result["result"]


def create_cloudflare_tunnel(account_id: str, token: str, device_id: str) -> tuple:
    """Create a Cloudflare tunnel for this device. Returns (tunnel_id, tunnel_token)."""
    tunnel_name = f"vallelogic-{device_id}"
    tunnel_secret = generate_tunnel_secret()

    print(f"  Creating Cloudflare tunnel: {tunnel_name} ...")
    result = cf_api(
        "POST",
        f"/accounts/{account_id}/cfd_tunnel",
        token,
        {"name": tunnel_name, "tunnel_secret": tunnel_secret}
    )

    tunnel_id = result["id"]
    tunnel_token = result["token"]
    print(f"  ✅ Tunnel created: {tunnel_id}")
    return tunnel_id, tunnel_token


def create_cloudflare_dns(zone_id: str, token: str, nr_serial: str, tunnel_id: str) -> str:
    """Create or update DNS CNAME for device-specific SSH hostname. Returns hostname."""
    hostname = f"{nr_serial.lower()}-ssh.vallelogic.com"
    cname_target = f"{tunnel_id}.cfargotunnel.com"
    record = {"type": "CNAME", "name": hostname, "content": cname_target, "proxied": True, "ttl": 1}

    existing = cf_api("GET", f"/zones/{zone_id}/dns_records?name={hostname}", token)
    if existing:
        record_id = existing[0]["id"]
        print(f"  Updating existing DNS record: {hostname} ...")
        cf_api("PUT", f"/zones/{zone_id}/dns_records/{record_id}", token, record)
        print(f"  ✅ DNS record updated: {hostname}")
    else:
        print(f"  Creating DNS record: {hostname} ...")
        cf_api("POST", f"/zones/{zone_id}/dns_records", token, record)
        print(f"  ✅ DNS record created: {hostname}")
    return hostname



def create_cloudflare_ingress(account_id: str, token: str, tunnel_id: str, tunnel_hostname: str):
    """Configure tunnel ingress rule to route SSH traffic to localhost:22."""
    print(f"  Configuring tunnel ingress rule for {tunnel_hostname} ...")
    cf_api(
        "PUT",
        f"/accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations",
        token,
        {
            "config": {
                "ingress": [
                    {"hostname": tunnel_hostname, "service": "ssh://localhost:22"},
                    {"service": "http_status:404"}
                ]
            }
        }
    )
    print(f"  ✅ Ingress rule configured: {tunnel_hostname} → ssh://localhost:22")

def lookup_existing_device(database_url: str, nr_serial: str):
    """Look up existing device by NR serial. Returns (device_id, status) or None."""
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed.")
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    try:
        cur.execute("SELECT device_id, status FROM devices WHERE nr_serial = %s", (nr_serial,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def insert_device(database_url: str, device_id: str, nr_serial: str,
                  cpu_serial_hash: str, device_key_hash: str, image_version: str):
    """Insert new device record into Neon including device_key_hash."""
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed. Run: pip3 install psycopg2-binary")
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO devices (device_id, nr_serial, cpu_serial_hash, device_key_hash, image_version, status)
            VALUES (%s, %s, %s, %s, %s, 'provisioned')
            RETURNING device_id, nr_serial, status
        """, (device_id, nr_serial, cpu_serial_hash, device_key_hash, image_version))

        row = cur.fetchone()
        conn.commit()
        return row
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Database insert failed: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


def update_device_key_hash(database_url: str, device_id: str, device_key_hash: str):
    """Update device_key_hash on existing device record."""
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed.")
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE devices SET device_key_hash = %s, updated_at = now()
            WHERE device_id = %s
        """, (device_key_hash, device_id))
        conn.commit()
        print(f"  ✅ device_key_hash updated on existing device")
    except Exception as e:
        conn.rollback()
        print(f"ERROR: device_key_hash update failed: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


def insert_device_secrets(database_url: str, device_id: str,
                          tunnel_id: str, tunnel_token: str, tunnel_hostname: str):
    """Insert tunnel credentials into device_secrets table."""
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed.")
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO device_secrets (device_id, tunnel_id, tunnel_token, tunnel_hostname)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (device_id) DO UPDATE SET
                tunnel_id = EXCLUDED.tunnel_id,
                tunnel_token = EXCLUDED.tunnel_token,
                tunnel_hostname = EXCLUDED.tunnel_hostname,
                updated_at = now()
        """, (device_id, tunnel_id, tunnel_token, tunnel_hostname))
        conn.commit()
        print(f"  ✅ Secrets stored in device_secrets")
    except Exception as e:
        conn.rollback()
        print(f"ERROR: device_secrets insert failed: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="ValleLogic Device Provisioner")
    parser.add_argument("--cpu-serial", required=True,
                        help="Pi CPU serial from /proc/cpuinfo (e.g. 2ae65c7f104c9af7)")
    parser.add_argument("--nr-serial", required=True,
                        help="NR serial to assign (e.g. NR-2AE6-5C7F)")
    parser.add_argument("--image-version", default="1.0.0",
                        help="Image version to record (default: 1.0.0)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print device.env without writing to DB or Cloudflare")
    args = parser.parse_args()

    # Validate NR serial format
    if not re.match(r'^NR-[A-Z0-9]{4}-[A-Z0-9]{4}$', args.nr_serial.upper()):
        print(f"ERROR: NR serial must be in format NR-XXXX-XXXX (got {args.nr_serial})")
        sys.exit(1)

    nr_serial = args.nr_serial.upper()
    cpu_serial = args.cpu_serial.lower().strip()

    # Load env
    env = load_env()
    secret = env.get("VALLELOGIC_PROVISION_SECRET")
    database_url = env.get("DATABASE_URL") or env.get("POSTGRES_URL")
    cf_account_id = env.get("CLOUDFLARE_ACCOUNT_ID")
    cf_api_token = env.get("CLOUDFLARE_API_TOKEN")
    cf_zone_id = env.get("CLOUDFLARE_ZONE_ID")

    if not secret:
        print("ERROR: VALLELOGIC_PROVISION_SECRET not found in .env.local")
        sys.exit(1)
    if not database_url:
        print("ERROR: DATABASE_URL not found in .env.local")
        sys.exit(1)
    if not cf_account_id or not cf_api_token:
        print("ERROR: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN required in .env.local")
        sys.exit(1)
    if not cf_zone_id:
        print("ERROR: CLOUDFLARE_ZONE_ID required in .env.local")
        sys.exit(1)

    # Generate identity
    device_id = generate_device_id()
    cpu_serial_hash = generate_cpu_serial_hash(cpu_serial, secret)
    device_key = generate_device_key(device_id, cpu_serial, secret)
    device_key_hash = generate_device_key_hash(device_key)

    print(f"\n{'='*60}")
    print(f"  ValleLogic Device Provisioner")
    print(f"{'='*60}")
    print(f"  NR Serial:      {nr_serial}")
    print(f"  Device ID:      {device_id}")
    print(f"  CPU Serial:     {cpu_serial}")
    print(f"  Image Version:  {args.image_version}")
    print(f"  Dry Run:        {args.dry_run}")
    print(f"{'='*60}\n")

    if args.dry_run:
        print("⚠️  DRY RUN — skipping Cloudflare and database\n")
        tunnel_id = "dry-run-tunnel-id"
        tunnel_token = "dry-run-tunnel-token"
        tunnel_hostname = f"{nr_serial.lower()}-ssh.vallelogic.com"
    else:
        # Check if device already exists
        existing = lookup_existing_device(database_url, nr_serial)

        if existing:
            device_id = existing[0]
            print(f"  ℹ️  Existing device found: {device_id} (status: {existing[1]})")
            print(f"  ℹ️  Using existing device_id — skipping devices table insert")
        
        # Step 1 — Create Cloudflare tunnel
        print("[ Step 1 ] Cloudflare tunnel...")
        tunnel_id, tunnel_token = create_cloudflare_tunnel(cf_account_id, cf_api_token, device_id)

        # Step 2 — Create DNS record
        print("[ Step 2 ] DNS record...")
        tunnel_hostname = create_cloudflare_dns(cf_zone_id, cf_api_token, nr_serial, tunnel_id)

        # Step 2.5 — Configure tunnel ingress rule
        print("[ Step 2.5 ] Tunnel ingress rule...")
        create_cloudflare_ingress(cf_account_id, cf_api_token, tunnel_id, tunnel_hostname)

        # Step 3 — Insert or update device in DB
        if existing:
            print("[ Step 3 ] Updating device_key_hash on existing device...")
            update_device_key_hash(database_url, device_id, device_key_hash)
        else:
            print("[ Step 3 ] Device DB record...")
            row = insert_device(database_url, device_id, nr_serial,
                               cpu_serial_hash, device_key_hash, args.image_version)
            print(f"  ✅ Device registered: {row[0]} / {row[1]} / {row[2]}")

        # Step 4 — Store secrets
        print("[ Step 4 ] Device secrets...")
        insert_device_secrets(database_url, device_id, tunnel_id, tunnel_token, tunnel_hostname)

    # Generate device.env
    device_env = f"""# ValleLogic Device Identity
# Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
# DO NOT EDIT — regenerate via provision.py if needed

DEVICE_ID={device_id}
NR_SERIAL={nr_serial}
DEVICE_KEY={device_key}
IMAGE_VERSION={args.image_version}
CLOUD_BASE=https://app.vallelogic.com
TENANT_ID=
CLAIMED=false
"""

    # Generate tunnel.env
    tunnel_env = f"""# ValleLogic Tunnel Identity
# Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
# DO NOT EDIT — managed by ValleLogic provisioning

TUNNEL_ID={tunnel_id}
TUNNEL_TOKEN={tunnel_token}
TUNNEL_HOSTNAME={tunnel_hostname}
"""

    # Print device.env
    print(f"\n{'='*60}")
    print(f"  device.env for Pi ({nr_serial})")
    print(f"{'='*60}")
    print(device_env)

    # Print tunnel.env
    print(f"{'='*60}")
    print(f"  tunnel.env for Pi ({nr_serial})")
    print(f"{'='*60}")
    print(tunnel_env)
    print(f"{'='*60}")

    # Write to Pi instructions
    print(f"\nWrite to Pi:")
    print(f"  sudo tee /etc/vallelogic/device.env << 'EOF'")
    print(device_env.strip())
    print(f"EOF")
    print(f"\n  sudo tee /etc/vallelogic/tunnel.env << 'EOF'")
    print(tunnel_env.strip())
    print(f"EOF")
    print()

    # Save locally
    device_env_path = Path(f"device_env_{nr_serial.replace('-', '_')}.txt")
    tunnel_env_path = Path(f"tunnel_env_{nr_serial.replace('-', '_')}.txt")
    device_env_path.write_text(device_env)
    tunnel_env_path.write_text(tunnel_env)
    print(f"✅ Saved locally:")
    print(f"   {device_env_path}")
    print(f"   {tunnel_env_path}")
    print(f"   (Delete both files after writing to Pi)\n")

    if not args.dry_run:
        print(f"✅ Provision complete for {nr_serial}")
        print(f"   Tunnel:   {tunnel_hostname}")
        print(f"   Next:     scp staging files → run setup.sh\n")


if __name__ == "__main__":
    main()
