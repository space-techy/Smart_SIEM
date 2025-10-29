#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_malicious_auth_noip.py
Generate MALICIOUS Wazuh-style authentication FAILURE events (no IPs), JSONL + CSV.

Scenarios:
  - SSH brute-force (same user@host, rapid failures)
  - Password spray (many users across hosts)
  - Low-and-slow (few spaced failures)
  - Mixed variants (invalid user/publickey failures)
Outputs:
  out/malicious_noip.jsonl
  out/malicious_noip_flat.csv

Usage:
  python3 gen_malicious_auth_noip.py --outdir ./out --events 60000 --days 2 --seed 11
"""

import argparse, csv, json, os, random, time
from datetime import datetime, timedelta, timezone

USERS = ["alice","bob","charlie","daniel","eva","frank","gina","harry","irene","john",
         "kate","liam","mona","nina","oscar","pam","quinn","rachel","sam","tina"]
HOSTS = ["sales-host1","sales-host2","eng-host1","eng-host2",
         "prod-server-1","prod-server-2","dev-vm-01","dev-vm-02"]

AGENT_ID = "001"
MANAGER_NAME = "wazuh-manager-synth"

def utc_iso(ts: datetime) -> str:
    return ts.replace(tzinfo=timezone.utc).isoformat()

def build_fail(ts, host, user, program_name, decoder_name, rule_desc, groups, full_log):
    return {
        "_index": "wazuh-archives-synth",
        "_source": {
            "predecoder": {"hostname": host, "program_name": program_name, "timestamp": ts.strftime("%b %d %H:%M:%S")},
            "input": {"type":"log"},
            "agent": {"ip": "", "name": host, "id": AGENT_ID},   # no IPs
            "manager": {"name": MANAGER_NAME},
            "data": {
                "srcuser": user, "dstuser": user,
                "uid": str(random.randint(1000,5000)),
                "euid": str(random.randint(1000,5000)),
                "logname": user, "tty": f"/dev/pts/{random.randint(0,9)}",
                "srcip": ""   # intentionally blank
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

def sshd_fail(ts, host, user):
    pid, port = random.randint(1000,9999), random.randint(1024,65535)
    r = random.random()
    if r < 0.2:
        msg = f"{ts.strftime('%b %d %H:%M:%S')} {host} sshd[{pid}]: Failed password for invalid user {user} from unknown port {port} ssh2"
    elif r < 0.4:
        msg = f"{ts.strftime('%b %d %H:%M:%S')} {host} sshd[{pid}]: Failed publickey for {user} from unknown port {port} ssh2"
    else:
        msg = f"{ts.strftime('%b %d %H:%M:%S')} {host} sshd[{pid}]: Failed password for {user} from unknown port {port} ssh2"
    return build_fail(ts, host, user, "sshd", "sshd", "sshd: Failed password for user",
                      ["sshd","authentication_failed"], msg)

def pam_fail(ts, host, user):
    pid = random.randint(2000,9999)
    msg = (f"{ts.strftime('%b %d %H:%M:%S')} {host} sudo[{pid}]: pam_unix(sudo:auth): authentication failure; "
           f"logname={user} uid={random.randint(1000,5000)} euid=0 tty=/dev/pts/{random.randint(0,9)} "
           f"ruser={user} rhost=  user={user}")
    return build_fail(ts, host, user, "sudo", "pam", "PAM: User login failed.",
                      ["pam","syslog","authentication_failed"], msg)

def gen_bruteforce(start_ts, host, user, attempts):
    out = []; t = start_ts
    for _ in range(attempts):
        out.append(sshd_fail(t, host, user) if random.random()<0.8 else pam_fail(t, host, user))
        t += timedelta(seconds=max(0.1, random.uniform(0.4, 1.6)))
    return out, "ssh_bruteforce"

def gen_password_spray(start_ts, hosts, users):
    out = []; t = start_ts
    for u in users:
        h = random.choice(hosts)
        out.append(sshd_fail(t, h, u) if random.random()<0.9 else pam_fail(t, h, u))
        t += timedelta(seconds=random.uniform(0.7, 2.2))
    return out, "password_spray"

def gen_low_and_slow(start_ts, host, user, hours):
    out = []; t = start_ts
    for _ in range(hours):
        if random.random() < 0.55:
            out.append(sshd_fail(t, host, user))
        t += timedelta(minutes=random.randint(20, 60))
    return out, "low_and_slow"

def orchestrate(total, days, seed):
    random.seed(seed)
    base = datetime.utcnow() - timedelta(days=days)
    events, types = [], []
    while len(events) < total:
        start = base + timedelta(seconds=random.randint(0, days*24*3600))
        r = random.random()
        if r < 0.50:
            user, host = random.choice(USERS), random.choice(HOSTS)
            attempts = max(12, int(random.expovariate(1/220)))
            evs, tname = gen_bruteforce(start, host, user, attempts)
        elif r < 0.75:
            k = random.randint(8, min(16, len(USERS)))
            evs, tname = gen_password_spray(start, HOSTS, random.sample(USERS, k=k))
        else:
            user, host = random.choice(USERS), random.choice(HOSTS)
            hours = random.randint(6, 24)
            evs, tname = gen_low_and_slow(start, host, user, hours)
        events.extend(evs); types.extend([tname]*len(evs))
    events = events[:total]; types = types[:total]

    # sort & ensure strictly increasing timestamps
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
        "label","attack_type","hour_of_day","day_of_week","success"
    ]
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields); w.writeheader()
        for ev, tname in zip(events, types):
            s = ev["_source"]; r = s["rule"]; d = s["data"]
            row = {
                "timestamp": s["timestamp"],
                "agent_name": s["agent"]["name"],
                "agent_ip": s["agent"]["ip"],   # blank by design
                "srcuser": d.get("srcuser",""),
                "srcip": d.get("srcip",""),     # blank by design
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
                "success": 0
            }
            w.writerow(row)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--outdir", default="./out")
    ap.add_argument("--events", type=int, default=60000)
    ap.add_argument("--days", type=int, default=1)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    evs, types = orchestrate(args.events, args.days, args.seed)

    jsonl_path = os.path.join(args.outdir, "malicious_noip.jsonl")
    csv_path   = os.path.join(args.outdir, "malicious_noip_flat.csv")
    write_jsonl(jsonl_path, evs); write_csv(csv_path, evs, types)
    print(f"[+] Wrote {len(evs)} malicious (no-IP) events")
    print(f"[+] JSONL: {jsonl_path}")
    print(f"[+] CSV  : {csv_path}")

if __name__ == "__main__":
    main()
