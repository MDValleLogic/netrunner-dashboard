#!/usr/bin/env python3
import subprocess, json, time, os, requests
from datetime import datetime, timezone

CLOUD_BASE  = os.environ.get("CLOUD_BASE", "https://app.vallelogic.com")
INTERVAL    = int(os.environ.get("RF_INTERVAL", "60"))

def load_device():
    env = {}
    with open("/etc/vallelogic/device.env") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return {"device_id": env["DEVICE_ID"], "api_key": env.get("DEVICE_KEY", "")}

def freq_to_channel(mhz):
    if 2412 <= mhz <= 2484:
        return (mhz - 2412) // 5 + 1
    if 5180 <= mhz <= 5825:
        return (mhz - 5000) // 5
    return None

def parse_iw_scan(raw):
    networks = []
    current  = {}
    for line in raw.splitlines():
        line = line.strip()
        if line.startswith("BSS "):
            if current.get("bssid"):
                networks.append(current)
            current = {"bssid": line.split()[1].split("(")[0].strip()}
        elif line.startswith("SSID:"):
            current["ssid"] = line[5:].strip()
        elif line.startswith("signal:"):
            try: current["signal_dbm"] = int(float(line.split()[1]))
            except: pass
        elif line.startswith("DS Parameter set: channel"):
            try: current["channel"] = int(line.split()[-1])
            except: pass
        elif line.startswith("freq:"):
            try:
                mhz = int(float(line.split()[1]))
                current["frequency_mhz"] = mhz
                current["band"] = "2.4GHz" if mhz < 3000 else "5GHz"
                # Derive channel from freq if DS Parameter line is missing
                if "channel" not in current:
                    ch = freq_to_channel(mhz)
                    if ch:
                        current["channel"] = ch
            except: pass
        elif "RSN:" in line:
            current["security"] = "WPA2"
        elif "WPA:" in line and "security" not in current:
            current["security"] = "WPA"
    if current.get("bssid"):
        networks.append(current)

    clean = []
    for n in networks:
        bssid = n.get("bssid", "")
        if not bssid or len(bssid) != 17 or bssid.count(":") != 5:
            continue
        if "security" not in n:
            n["security"] = "Open"
        ssid = n.get("ssid", "")
        if ssid and "\\x00" in ssid:
            n["ssid"] = "<hidden>"
        clean.append(n)
    return clean

def scan():
    try:
        result = subprocess.run(
            ["sudo", "iw", "dev", "wlan0", "scan"],
            capture_output=True, text=True, timeout=30
        )
        return parse_iw_scan(result.stdout)
    except Exception as e:
        print(f"[RFRUNNER] Scan error: {e}")
        return []

def post(device, networks):
    if not networks:
        print("[RFRUNNER] No networks found")
        return
    payload = {
        "device_id": device["device_id"],
        "api_key":   device["api_key"],
        "networks":  networks
    }
    try:
        r = requests.post(f"{CLOUD_BASE}/api/rfrunner/ingest", json=payload, timeout=10)
        print(f"[RFRUNNER] Posted {len(networks)} networks, status={r.status_code}")
    except Exception as e:
        print(f"[RFRUNNER] Post error: {e}")

if __name__ == "__main__":
    device = load_device()
    print(f"[RFRUNNER] Starting device={device['device_id']} interval={INTERVAL}s")
    while True:
        networks = scan()
        post(device, networks)
        time.sleep(INTERVAL)
