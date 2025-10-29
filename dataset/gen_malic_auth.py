#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_malicious_auth.py
Generate MALICIOUS Wazuh-style authentication failure events (JSONL + CSV).
Scenarios:
  - SSH brute-force bursts
  - Password spray across users/hosts
  - Low-and-slow probing
  - Rotating-IP botnets
Outputs:
  out/malicious.jsonl
  out/malicious_flat.csv

Usage:
  python3 gen_malicious_auth.py --outdir ./out --events 60000 --days 2 --attackers 18 --seed 7
"""

import argparse, csv, json, os, random, time
from datetime import datetime, timedelta, timezone
from ipaddress import ip_network, ip_address

USERS = ["alice","bob","charlie","daniel","eva","frank","gina","harry","irene","john",
         "kate","liam","mona","nina","oscar","pam","quinn","rachel","sam","tina"]

HOSTS = ["sales-host1","sales-host2","eng-host1","eng-host2",
         "prod-server-1","prod-server-2","dev-vm-01","dev-vm-02"]

HOST_IPS = {
  "sales-host1":"10.0.10.11","sales-host2":"10.0.10.12",
  "eng-host1":"10.0.20.11","eng-host2":"10.0.20.12",
  "prod-server-1":"10.0.30.21","prod-server-2":"10.0.30.22",
  "dev-vm-01":"10.0.40.31","dev-vm-02":"10.0.40.32",
}

AGENT_ID = "001"
MANAGER_NAME = "wazuh-manager-synth"

def utc_iso(ts: datetime) -> str:
    return ts.replace(tzinfo=timezone.utc).isoformat()

def rand_public_ip():
    while True:
        a = random.randint(1, 223); b = random.randint(0,255); c = random.randint(0,255); d = random.randint(2,254)
        if a == 10 or (a == 172 and 16 <= b <= 31) or (a == 192 and b == 168): continue
        if a == 127 or (a == 169 and b == 254) or a >= 224: continue
        return f"{a}.{b}.{c}.{d}"

def mitre_password_guessing():
    return [("Password Guessing","T1110.001","Credential Access")]

def build_fail(ts, host, user, srcip, program_name, decoder_name, rule_desc, groups, full_log):
    return {
        "_index": "wazuh-archives-synth",
        "_source": {
            "predecoder": {"hostname": host, "program_name": program_name, "timestamp": ts.strftime("%b %d %H:%M:%S")},
            "input": {"type":"log"},
            "agent": {"ip": HOST_IPS.get(host,"10.0.0.5"), "name": host, "id": AGENT_ID},
            "manager": {"name": MANAGER_NAME},
            "data": {
                "srcuser": user, "dstuser": user,
                "uid": str(random.randint(1000,5000)),
                "euid": str(random.randint(1000,5000)),
                "logname": user, "tty": f"/dev/pts/{random.randint(0,9)}",
                "srcip": srcip
            },
            "rule": {
                "mail": False, "level": 5,
                "pci_dss": ["10.2.4","10.2.5"],
                "hipaa": ["164.312.b"],
                "tsc": ["CC6.1","CC6.8","CC7.2","CC7.3"],
                "description": rule_desc, "groups": groups,
                "nist_800_53": ["AU.14","AC.7"], "gdpr": ["IV_35.7.d","IV_32.2"],
                "firedtimes": 1,
                "mitre": {
                    "technique": ["Password Guessing"],
                    "id": ["T1110.001"],
                    "tactic": ["Credential Access"]
                },
                "id": str(random.randint(6500,9999)),
                "gpg13": ["7.8"]
            },
            "location": "journald",
            "decoder": {"name": decoder_name},
            "id": f"{int(time.time()*1000)}.{random.randint(1000,9999)}",
            "full_log": full_log,
            "timestamp": utc_iso(ts)
        }
    }

def sshd_fail(ts, host, user, srcip):
    pid, port = random.randint(1000,9999), random.randint(1024,65535)
    if random.random() < 0.2:
        msg = f"{ts.strftime('%b %d %H:%M:%S')} {host} sshd[{pid}]: Failed password for invalid user {user} from {srcip} port {port} ssh2"
    elif random.random() < 0.2:
        msg = f"{ts.strftime('%b %d %H:%M:%S')} {host} sshd[{pid}]: Failed publickey for {user} from {srcip} port {port} ssh2"
    else:
        msg = f"{ts.strftime('%b %d %H:%M:%S')} {host} sshd[{pid}]: Failed password for {user} from {srcip} port {port} ssh2"
    return build_fail(ts, host, user, srcip, "sshd", "sshd", "sshd: Failed password for user",
                      ["sshd","authentication_failed"], msg)

def pam_fail(ts, host, user, srcip):
    pid = random.randint(2000,9999)
    msg = (f"{ts.strftime('%b %d %H:%M:%S')} {host} sudo[{pid}]: pam_unix(sudo:auth): authentication failure; "
           f"logname={user} uid={random.randint(1000,5000)} euid=0 tty=/dev/pts/{random.randint(0,9)} "
           f"ruser={user} rhost={srcip}  user={user}")
    return build_fail(ts, host, user, srcip, "sudo", "pam", "PAM: User login failed.",
                      ["pam","syslog","authentication_failed"], msg)

def gen_bruteforce(start_ts, attacker_ip, host, user, attempts):
    out = []; t = start_ts
    for _ in range(attempts):
        out.append(sshd_fail(t, host, user, attacker_ip) if random.random()<0.8 else pam_fail(t, host, user, attacker_ip))
        t += timedelta(seconds=max(0.1, random.uniform(0.4, 1.8)))
    return out, "ssh_bruteforce"

def gen_password_spray(start_ts, attacker_ip, hosts, users):
    out = []; t = start_ts
    for u in users:
        h = random.choice(hosts)
        out.append(sshd_fail(t, h, u, attacker_ip) if random.random()<0.9 else pam_fail(t, h, u, attacker_ip))
        t += timedelta(seconds=random.uniform(0.7,2.2))
    return out, "password_spray"

def gen_low_and_slow(start_ts, attacker_ip, host, user, hours):
    out = []; t = start_ts
    for _ in range(hours):
        if random.random() < 0.5:
            out.append(sshd_fail(t, host, user, attacker_ip))
        t += timedelta(minutes=random.randint(20, 60))
    return out, "low_and_slow"

def gen_rotating_ips(start_ts, host, user, attempts):
    out = []; t = start_ts
    for _ in range(attempts):
        sip = rand_public_ip()
        out.append(sshd_fail(t, host, user, sip))
        t += timedelta(seconds=random.uniform(0.3, 1.2))
    return out, "rotating_ips"

def orchestrate(total, days, attackers, seed):
    random.seed(seed)
    base = datetime.utcnow() - timedelta(days=days)
    events, types = [], []

    attacker_ips = [rand_public_ip() for _ in range(attackers)]
    while len(events) < total:
        start = base + timedelta(seconds=random.randint(0, days*24*3600))
        r = random.random()
        if r < 0.50:
            user, host, ip = random.choice(USERS), random.choice(HOSTS), random.choice(attacker_ips)
            attempts = max(12, int(random.expovariate(1/220)))
            evs, tname = gen_bruteforce(start, ip, host, user, attempts)
        elif r < 0.75:
            ip = random.choice(attacker_ips); k = random.randint(8, min(16, len(USERS)))
            evs, tname = gen_password_spray(start, ip, HOSTS, random.sample(USERS, k=k))
        elif r < 0.90:
            user, host, ip = random.choice(USERS), random.choice(HOSTS), random.choice(attacker_ips)
            hours = random.randint(6, 24)
            evs, tname = gen_low_and_slow(start, ip, host, user, hours)
        else:
            user, host = random.choice(USERS), random.choice(HOSTS)
            attempts = random.randint(15, 80)
            evs, tname = gen_rotating_ips(start, host, user, attempts)

        events.extend(evs); types.extend([tname]*len(evs))

    events = events[:total]; types = types[:total]
    # stable, increasing-ish timestamps
    zipped = list(zip(events, types))
    zipped.sort(key=lambda z: z[0]["_source"]["timestamp"])
    last = None
    for ev, _ in zipped:
        ts = ev["_source"]["timestamp"]
        if last and ts <= last:
            dt = datetime.fromisoformat(last.replace("Z","+00:00")) if last.endswith("Z") else datetime.fromisoformat(last)
            dt = dt + timedelta(milliseconds=3)
            ev["_source"]["timestamp"] = utc_iso(dt)
            ev["_source"]["predecoder"]["timestamp"] = dt.strftime("%b %d %H:%M:%S")
            last = ev["_source"]["timestamp"]
        else:
            last = ts
    return [e for e,_ in zipped], [t for _,t in zipped]

def write_jsonl(path, events):
    with open(path, "w") as f:
        for ev in events:
            f.write(json.dumps(ev) + "\n")

def write_csv(path, events, types):
    fields = [
        "timestamp","agent_name","agent_ip","srcuser","srcip","decoder_name","program_name",
        "rule_level","rule_description","rule_groups","full_log",
        "label","attack_type","hour_of_day","day_of_week","srcip_in_allowlist","success"
    ]
    from ipaddress import ip_address
    def in_private(ip):
        try:
            x = ip_address(ip); return x.is_private
        except: return False

    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields); w.writeheader()
        for ev, tname in zip(events, types):
            s = ev["_source"]; r = s["rule"]; d = s["data"]
            row = {
                "timestamp": s["timestamp"],
                "agent_name": s["agent"]["name"],
                "agent_ip": s["agent"]["ip"],
                "srcuser": d.get("srcuser",""),
                "srcip": d.get("srcip",""),
                "decoder_name": s["decoder"]["name"],
                "program_name": s["predecoder"]["program_name"],
                "rule_level": r.get("level",5),
                "rule_description": r.get("description",""),
                "rule_groups": ";".join(r.get("groups",[])) if r.get("groups") else "",
                "full_log": s.get("full_log",""),
                "label": "malicious",
                "attack_type": tname,
                "hour_of_day": datetime.fromisoformat(s["timestamp"].replace("Z","+00:00")).hour,
                "day_of_week": datetime.fromisoformat(s["timestamp"].replace("Z","+00:00")).weekday(),
                "srcip_in_allowlist": 1 if in_private(d.get("srcip","")) else 0,
                "success": 0
            }
            w.writerow(row)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--outdir", default="./out")
    ap.add_argument("--events", type=int, default=50000)
    ap.add_argument("--days", type=int, default=1)
    ap.add_argument("--attackers", type=int, default=12)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    evs, types = orchestrate(args.events, args.days, args.attackers, args.seed)

    jsonl_path = os.path.join(args.outdir, "malicious.jsonl")
    csv_path   = os.path.join(args.outdir, "malicious_flat.csv")
    write_jsonl(jsonl_path, evs); write_csv(csv_path, evs, types)
    print(f"[+] Wrote {len(evs)} malicious events")
    print(f"[+] JSONL: {jsonl_path}")
    print(f"[+] CSV  : {csv_path}")

if __name__ == "__main__":
    main()
