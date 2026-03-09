#!/usr/bin/env python3
"""
ValleLogic Active Mode v1 - WiFi Test Script
Phases: Associate → DHCP → Gateway Ping → RF Details → Security Scan → Teardown
eth0 remains management plane throughout. wlan0 is test instrument.
"""

import os
import sys
import json
import time
import subprocess
import tempfile
import urllib.request

# ── Config from environment ──────────────────────────────────────────────────
DEVICE_ID  = os.environ.get("DEVICE_ID", "unknown")
CLOUD_BASE = os.environ.get("CLOUD_BASE", "").rstrip("/")
DEVICE_KEY = os.environ.get("DEVICE_KEY", "")
IFACE      = "wlan0"
WPA_CTRL   = "/var/run/wpa_supplicant_vl"  # FIX: custom ctrl_interface path

HEADERS = {
    "content-type": "application/json",
    "x-device-id": DEVICE_ID,
    "x-device-key": DEVICE_KEY,
}

# ── Helpers ──────────────────────────────────────────────────────────────────

def log(msg):
    print(f"[WIFI] {msg}", flush=True)

def run(cmd, timeout=30):
    """Run shell command, return (returncode, stdout, stderr)"""
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"

def post_json(url, payload):
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status
    except Exception as e:
        log(f"POST failed: {e}")
        return 0

def ts_utc():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

# ── Phase 1: Associate ────────────────────────────────────────────────────────

def phase_associate(ssid, psk):
    log(f"Phase 1 — Associating to '{ssid}'")
    result = {
        "ssid": ssid,
        "success": False,
        "auth_time_ms": 0,
        "failure_reason": None,
        "ts_utc": ts_utc(),
    }

    # Write temp wpa_supplicant config
    wpa_conf = tempfile.NamedTemporaryFile(mode="w", suffix=".conf", delete=False)
    wpa_conf.write(f"""ctrl_interface={WPA_CTRL}
ctrl_interface_group=0
network={{
    ssid="{ssid}"
    psk="{psk}"
    key_mgmt=WPA-PSK
}}
""")
    wpa_conf.flush()
    conf_path = wpa_conf.name
    wpa_conf.close()

    # Kill any existing wpa_supplicant on wlan0
    run(f"sudo pkill -f 'wpa_supplicant.*{IFACE}'")
    time.sleep(1)

    # Start wpa_supplicant
    start = time.time()
    rc, out, err = run(
        f"sudo wpa_supplicant -B -i {IFACE} -c {conf_path} "
        f"-P /tmp/wpa_vl.pid -f /tmp/wpa_vl.log",
        timeout=10
    )
    if rc != 0:
        result["failure_reason"] = f"wpa_supplicant launch failed: {err}"
        log(f"  ✗ {result['failure_reason']}")
        os.unlink(conf_path)
        return result

    # Wait for association (up to 20s) — FIX: use WPA_CTRL path in wpa_cli
    associated = False
    for _i in range(40):
        time.sleep(0.5)
        rc2, out2, _ = run(f"sudo wpa_cli -p {WPA_CTRL} -i {IFACE} status")
        if "wpa_state=COMPLETED" in out2:
            associated = True
            break
        if "wpa_state=DISCONNECTED" in out2 and _i > 10:
            break

    result["auth_time_ms"] = round((time.time() - start) * 1000, 2)

    if associated:
        result["success"] = True
        time.sleep(2)  # Let interface stabilize before DHCP
        log(f"  ✓ Associated in {result['auth_time_ms']}ms")
    else:
        rc3, out3, _ = run(f"sudo wpa_cli -p {WPA_CTRL} -i {IFACE} status")
        result["failure_reason"] = "association_timeout"
        for line in out3.splitlines():
            if "reason" in line.lower() or "state" in line.lower():
                result["failure_reason"] = line.strip()
                break
        log(f"  ✗ Failed: {result['failure_reason']}")

    os.unlink(conf_path)
    return result

# ── Phase 2: DHCP ─────────────────────────────────────────────────────────────

def phase_dhcp():
    log("Phase 2 — DHCP lease")
    result = {
        "success": False,
        "dhcp_time_ms": 0,
        "ip_assigned": None,
        "gateway": None,
        "dns_servers": [],
        "ts_utc": ts_utc(),
    }

    start = time.time()
    rc, out, err = run(
        f"sudo rm -f /var/lib/dhcp/dhclient.leases && sudo dhclient -v -1 {IFACE} 2>&1",
        timeout=20
    )
    result["dhcp_time_ms"] = round((time.time() - start) * 1000, 2)

    # Get assigned IP
    rc2, out2, _ = run(f"ip addr show {IFACE}")
    for line in out2.splitlines():
        if "inet " in line:
            result["ip_assigned"] = line.strip().split()[1].split("/")[0]
            result["success"] = True
            break

    # Get gateway
    rc3, out3, _ = run(f"ip route show dev {IFACE}")
    for line in out3.splitlines():
        if "default" in line:
            parts = line.split()
            if "via" in parts:
                result["gateway"] = parts[parts.index("via") + 1]
            break

    # Get DNS
    rc4, out4, _ = run("cat /etc/resolv.conf")
    for line in out4.splitlines():
        if line.startswith("nameserver"):
            result["dns_servers"].append(line.split()[1])

    if result["success"]:
        log(f"  ✓ IP={result['ip_assigned']} GW={result['gateway']} in {result['dhcp_time_ms']}ms")
    else:
        log(f"  ✗ DHCP failed")

    return result

# ── Phase 3: Gateway Ping ─────────────────────────────────────────────────────

def phase_ping(gateway):
    log(f"Phase 3 — Ping gateway {gateway}")
    result = {
        "target": gateway,
        "success": False,
        "latency_ms": None,
        "packet_loss_pct": 100.0,
        "ts_utc": ts_utc(),
    }

    if not gateway:
        result["failure_reason"] = "no_gateway"
        log("  ✗ No gateway available")
        return result

    rc, out, err = run(
        f"ping -I {IFACE} -c 5 -W 2 {gateway}",
        timeout=20
    )

    for line in out.splitlines():
        if "avg" in line and "rtt" in line:
            parts = line.split("=")[1].strip().split("/")
            result["latency_ms"] = float(parts[1])
            result["success"] = True
        if "packet loss" in line:
            for part in line.split(","):
                if "packet loss" in part:
                    result["packet_loss_pct"] = float(part.strip().split("%")[0])

    if result["success"]:
        log(f"  ✓ Gateway ping {result['latency_ms']}ms, {result['packet_loss_pct']}% loss")
    else:
        log(f"  ✗ Ping failed")

    return result

# ── Phase 4: RF Details from Associated AP ────────────────────────────────────

def phase_rf_details():
    log("Phase 4 — RF details from associated AP")
    result = {
        "bssid": None,
        "ssid": None,
        "rssi_dbm": None,
        "channel": None,
        "band": None,
        "frequency_mhz": None,
        "ts_utc": ts_utc(),
    }

    rc, out, _ = run(f"sudo iw dev {IFACE} link")
    for line in out.splitlines():
        line = line.strip()
        if line.startswith("Connected to"):
            result["bssid"] = line.split()[2]
        elif line.startswith("SSID:"):
            result["ssid"] = line.split(":", 1)[1].strip()
        elif line.startswith("signal:"):
            try:
                result["rssi_dbm"] = int(line.split()[1])
            except:
                pass
        elif line.startswith("freq:"):
            try:
                freq = int(float(line.split()[1]))  # FIX: handle 5260.0 decimal
                result["frequency_mhz"] = freq
                result["band"] = "2.4GHz" if freq < 3000 else "5GHz"
                if freq < 3000:
                    result["channel"] = int((freq - 2407) / 5)
                else:
                    result["channel"] = int((freq - 5000) / 5)
            except:
                pass

    if result["bssid"]:
        log(f"  ✓ BSSID={result['bssid']} RSSI={result['rssi_dbm']}dBm "
            f"Ch={result['channel']} {result['band']}")
    else:
        log("  ✗ Could not get RF details")

    return result

# ── Phase 5: Security Scan ────────────────────────────────────────────────────

def phase_security_scan(gateway):
    log("Phase 5 — WiFi security scan")
    result = {
        "host_count": 0,
        "open_ports_found": [],
        "risk_score": "low",
        "findings": [],
        "ts_utc": ts_utc(),
    }

    if not gateway:
        log("  ✗ No gateway — skipping scan")
        return result

    subnet = ".".join(gateway.split(".")[:3]) + ".0/24"
    log(f"  Scanning subnet {subnet}")

    rc, out, _ = run(f"sudo nmap -sn -R {subnet}", timeout=60)
    hosts = []
    hostname_map = {}  # ip -> hostname
    for line in out.splitlines():
        if "Nmap scan report for" in line:
            parts = line.split()
            if "(" in line:
                ip = parts[-1].strip("()")
                hostname = parts[4]
                hostname_map[ip] = hostname
            else:
                ip = parts[-1]
                hostname_map[ip] = None
            hosts.append(ip)

    result["host_count"] = len(hosts)
    log(f"  Found {len(hosts)} hosts")

    risky_ports = "21,22,23,80,443,445,3389,8080,8443"
    risk_flags = []

    # mDNS hostname resolution (parallel)
    from concurrent.futures import ThreadPoolExecutor, as_completed
    def mdns_lookup(host):
        rc_m, out_m, _ = run(f"avahi-resolve -a {host}", timeout=3)
        if rc_m == 0 and out_m:
            parts = out_m.strip().split()
            if len(parts) >= 2:
                return host, parts[1]
        return host, None
    with ThreadPoolExecutor(max_workers=10) as ex:
        futures = [ex.submit(mdns_lookup, h) for h in hosts[:20] if not hostname_map.get(h)]
        for f in as_completed(futures):
            host, name = f.result()
            if name:
                hostname_map[host] = name

    for host in hosts[:20]:
        rc2, out2, _ = run(
            f"sudo nmap -p {risky_ports} --open -T4 {host}",
            timeout=30
        )
        for line in out2.splitlines():
            if "/tcp" in line and "open" in line:
                port = line.split("/")[0].strip()
                service = line.split()[-1] if line.split() else ""
                finding = {
                    "host": host,
                    "hostname": hostname_map.get(host),
                    "port": int(port),
                    "service": service,
                }
                result["open_ports_found"].append(finding)
                if port in ["23", "445", "3389"]:
                    host_label = hostname_map.get(host) or host
                    risk_flags.append(f"High risk port {port} open on {host_label} ({host})")

    if risk_flags:
        result["risk_score"] = "high"
        result["findings"] = risk_flags
    elif len(result["open_ports_found"]) > 5:
        result["risk_score"] = "medium"
    else:
        result["risk_score"] = "low"

    log(f"  ✓ {len(result['open_ports_found'])} open ports found, risk={result['risk_score']}")
    return result

# ── Phase 6: Teardown ─────────────────────────────────────────────────────────

def phase_teardown():
    log("Phase 6 — Teardown")

    run(f"sudo dhclient -r {IFACE}", timeout=10)
    run(f"sudo pkill -f 'wpa_supplicant.*{IFACE}'", timeout=5)
    run("sudo rm -f /tmp/wpa_vl.pid /tmp/wpa_vl.log", timeout=5)
    run(f"sudo ip addr flush dev {IFACE}", timeout=5)
    run(f"sudo ip link set {IFACE} up", timeout=5)

    time.sleep(2)

    rc, out, _ = run("ip route show default")
    if "eth0" in out:
        log("  ✓ eth0 default route intact")
    else:
        log("  ⚠ WARNING: eth0 default route may be affected — check connectivity")

    log("  ✓ Teardown complete")

# ── Ingest Results ────────────────────────────────────────────────────────────

def ingest_results(ssid, assoc, dhcp, ping, rf, security):
    if not CLOUD_BASE:
        log("No CLOUD_BASE set — skipping ingest")
        return

    payload = {
        "device_id": DEVICE_ID,
        "ts_utc": ts_utc(),
        "ssid": ssid,
        "association": assoc,
        "dhcp": dhcp,
        "ping": ping,
        "rf_details": rf,
        "security_scan": security,
    }

    url = f"{CLOUD_BASE}/api/rfrunner/wifi-test"
    status = post_json(url, payload)
    log(f"Ingest → {url} status={status}")

# ── Main ──────────────────────────────────────────────────────────────────────

def run_wifi_test(ssid, psk):
    log(f"=== Active Mode v1 — target: {ssid} ===")
    start = time.time()

    assoc    = phase_associate(ssid, psk)
    dhcp     = {"success": False}
    ping     = {"success": False}
    rf       = {}
    security = {}

    if assoc["success"]:
        dhcp     = phase_dhcp()
        gateway  = dhcp.get("gateway")
        ping     = phase_ping(gateway)
        rf       = phase_rf_details()
        security = phase_security_scan(gateway)

    phase_teardown()
    ingest_results(ssid, assoc, dhcp, ping, rf, security)

    elapsed = round(time.time() - start, 1)
    log(f"=== Complete in {elapsed}s ===")

    return {
        "assoc": assoc,
        "dhcp": dhcp,
        "ping": ping,
        "rf": rf,
        "security": security,
    }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: sudo python3 wifitest.py <SSID> <PSK>")
        sys.exit(1)

    ssid = sys.argv[1]
    psk  = sys.argv[2]
    results = run_wifi_test(ssid, psk)
    print(json.dumps(results, indent=2))
