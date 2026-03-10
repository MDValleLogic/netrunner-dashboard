#!/usr/bin/env python3
"""
ValleLogic Device Provisioning Script
Usage: python3 provision.py --cpu-serial <CPU_SERIAL> --nr-serial <NR_SERIAL>

Run from Mac Mini in ~/netrunner-dashboard directory.
Requires: DATABASE_URL and VALLELOGIC_PROVISION_SECRET in .env.local
"""

import argparse
import hashlib
import hmac
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path


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
        if val.startswith("$"):
            ref = val[1:]
            val = env.get(ref, val)
        env[key.strip()] = val
    return env


def generate_device_id():
    """Generate a pi-prefixed UUID."""
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


def insert_device(database_url: str, device_id: str, nr_serial: str,
                  cpu_serial_hash: str, image_version: str):
    """Insert device record into Neon."""
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed. Run: pip3 install psycopg2-binary")
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO devices (device_id, nr_serial, cpu_serial_hash, image_version, status)
            VALUES (%s, %s, %s, %s, 'provisioned')
            ON CONFLICT (nr_serial) DO UPDATE SET
                device_id = EXCLUDED.device_id,
                cpu_serial_hash = EXCLUDED.cpu_serial_hash,
                image_version = EXCLUDED.image_version,
                status = 'provisioned',
                updated_at = now()
            RETURNING device_id, nr_serial, status
        """, (device_id, nr_serial, cpu_serial_hash, image_version))

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


def main():
    parser = argparse.ArgumentParser(description="ValleLogic Device Provisioner")
    parser.add_argument("--cpu-serial", required=True,
                        help="Pi CPU serial from /proc/cpuinfo (e.g. 2ae65c7f104c9af7)")
    parser.add_argument("--nr-serial", required=True,
                        help="NR serial to assign (e.g. NR-2AE6-5C7F)")
    parser.add_argument("--image-version", default="1.0.0",
                        help="Image version to record (default: 1.0.0)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print device.env without writing to DB")
    args = parser.parse_args()

    # Validate NR serial format
    import re
    if not re.match(r'^NR-[A-Z0-9]{4}-[A-Z0-9]{4}$', args.nr_serial.upper()):
        print(f"ERROR: NR serial must be in format NR-XXXX-XXXX (got {args.nr_serial})")
        sys.exit(1)

    nr_serial = args.nr_serial.upper()
    cpu_serial = args.cpu_serial.lower().strip()

    # Load env
    env = load_env()
    secret = env.get("VALLELOGIC_PROVISION_SECRET")
    database_url = env.get("DATABASE_URL") or env.get("POSTGRES_URL")

    if not secret:
        print("ERROR: VALLELOGIC_PROVISION_SECRET not found in .env.local")
        sys.exit(1)
    if not database_url:
        print("ERROR: DATABASE_URL or POSTGRES_URL not found in .env.local")
        sys.exit(1)

    # Generate identity
    device_id = generate_device_id()
    cpu_serial_hash = generate_cpu_serial_hash(cpu_serial, secret)
    device_key = generate_device_key(device_id, cpu_serial, secret)

    print(f"\n{'='*60}")
    print(f"  ValleLogic Device Provisioner")
    print(f"{'='*60}")
    print(f"  NR Serial:      {nr_serial}")
    print(f"  Device ID:      {device_id}")
    print(f"  CPU Serial:     {cpu_serial}")
    print(f"  Image Version:  {args.image_version}")
    print(f"  Dry Run:        {args.dry_run}")
    print(f"{'='*60}\n")

    if not args.dry_run:
        row = insert_device(database_url, device_id, nr_serial,
                           cpu_serial_hash, args.image_version)
        print(f"✅ Device registered in Neon:")
        print(f"   device_id: {row[0]}")
        print(f"   nr_serial: {row[1]}")
        print(f"   status:    {row[2]}")
    else:
        print("⚠️  DRY RUN — skipping database insert\n")

    # Generate device.env content
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

    print(f"\n{'='*60}")
    print(f"  device.env for Pi ({nr_serial})")
    print(f"{'='*60}")
    print(device_env)
    print(f"{'='*60}")
    print(f"\nWrite to Pi with:")
    print(f"  sudo tee /etc/vallelogic/device.env << 'EOF'")
    print(device_env.strip())
    print(f"EOF")
    print()

    # Also save to local file for reference
    out_path = Path(f"device_env_{nr_serial.replace('-', '_')}.txt")
    out_path.write_text(device_env)
    print(f"✅ Saved locally to: {out_path}")
    print(f"   (Delete this file after writing to Pi)\n")


if __name__ == "__main__":
    main()
