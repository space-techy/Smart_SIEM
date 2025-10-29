#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_benign_auth_noip.py
Generate BENIGN Wazuh-style authentication events (no IPs), JSONL + CSV.

Outputs:
  out/benign_noip.jsonl
  out/benign_noip_flat.csv

Usage:
  python3 gen_benign_auth_noip.py --outdir ./out --events 40000 --days 2 --seed 11
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

def make_success(ts, host, user, use_pam=False):
    if not use_pam:
        pid, port = random.randint(1000,9999), random.randint(1024,65535)
        full_log = f"{ts.strftime('%b %d %H:%M:%S')} {host} sshd[{pid}]: Accepted password for {user} from unknown port {port} ssh2"
        return build(ts, host, user, "", "sshd", "sshd", True,
                     "sshd: Accepted password for user", ["sshd","authentication_success"], [], full_log)
    else:
        pid = random.randint(2000,9999)
        full_log = f"{ts.strftime('%b %d %H:%M:%S')} {host} sudo[{pid}]: pam_unix(sudo:auth): authentication success; user={user} rhost="
        return build(ts, host, user, "", "sudo", "pam", True,
                     "PAM: User login success.", ["pam","syslog","authentication_success"], [], full_log)

def make_fail_benign(ts, host, user, use_pam=False):
    mitre = [("Password Guessing","T1110.001","Credential Access")]
    if not use_pam:
        pid, port = random.randint(1000,9999), random.randint(1024,65535)
        full_log = f"{ts.strftime('%b %d %H:%M:%S')} {host} sshd[{pid}]: Failed password for {user} from unknown port {port} ssh2"
        return build(ts, host, user, "", "sshd", "sshd", False,
                     "sshd: Failed password for user", ["sshd","authentication_failed"], mitre, full_log)
    else:
        pid = random.randint(2000,9999)
        full_log = (f"{ts.strftime('%b %d %H:%M:%S')} {host} sudo[{pid}]: pam_unix(sudo:auth): authentication failure; "
                    f"logname={user} uid={random.randint(1000,5000)} euid=0 tty=/dev/pts/{random.randint(0,9)} "
                    f"ruser={user} rhost=  user={user}")
        return build(ts, host, user, "", "sudo", "pam", False,
                     "PAM: User login failed.", ["pam","syslog","authentication_failed"], mitre, full_log)

def build(ts, host, user, srcip, program_name, decoder_name, success, rule_desc, groups, mitre, full_log):
    level = 3 if success else 5
    pci = hipaa = tsc = nist = gdpr = []
    gpg13 = []
    if not success:
        pci   = ["10.2.4","10.2.5"]
        hipaa = ["164.312.b"]
        tsc   = ["CC6.1","CC6.8","CC7.2","CC7.3"]
        nist  = ["AU.14","AC.7"]
        gdpr  = ["IV_35.7.d","IV_32.2"]
        gpg13 = ["7.8"]
    return {
        "_index": "wazuh-archives-synth",
        "_source": {
            "predecoder": {"hostname": host, "program_name": program_name, "timestamp": ts.strftime("%b %d %H:%M:%S")},
            "input": {"type": "log"},
            "agent": {"ip": "", "name": host, "id": AGENT_ID},
            "manager": {"name": MANAGER_NAME},
            "data": {
                "srcuser": user, "dstuser": user,
                "uid": str(random.randint(1000,5000)),
                "euid": "0" if (success and random.random()<0.02) else str(random.randint(1000,5000)),
                "logname": user, "tty": f"/dev/pts/{random.randint(0,9)}",
                "srcip": ""  # intentionally blank
            },
            "rule": {
                "mail": False, "level": level,
                "pci_dss": pci, "hipaa": hipaa, "tsc": tsc,
                "description": rule_desc, "groups": groups,
                "nist_800_53": nist, "gdpr": gdpr, "firedtimes": 1,
                "mitre": {
                    "technique": [m[0] for m in mitre] if mitre else [],
                    "id": [m[1] for m in mitre] if mitre else [],
                    "tactic": [m[2] for m in mitre] if mitre else []
                },
                "id": str(random.randint(5500,9999)),
                "gpg13": gpg13
            },
            "location": "journald",
            "decoder": {"name": decoder_name},
            "id": f"{int(time.time()*1000)}.{random.randint(1000,9999)}",
            "full_log": full_log,
            "timestamp": utc_iso(ts)
        }
    }

def orchestrate(total, days, seed, benign_fail_rate=0.03):
    random.seed(seed)
    base = datetime.utcnow() - timedelta(days=days)
    out = []
    while len(out) < total:
        host = random.choice(HOSTS)
        user = random.choice(USERS)
        t = base + timedelta(seconds=random.randint(0, days*24*3600))
        # occasional benign failure, then a success
        if random.random() < benign_fail_rate:
            out.append(make_fail_benign(t, host, user, use_pam=(random.random()<0.3)))
            t += timedelta(seconds=random.uniform(1.0, 3.0))
        out.append(make_success(t, host, user, use_pam=(random.random()<0.2)))
    out = out[:total]
    out.sort(key=lambda e: e["_source"]["timestamp"])
    # enforce strictly increasing timestamps
    last = None
    for ev in out:
        ts = ev["_source"]["timestamp"]
        if last and ts <= last:
            dt = datetime.fromisoformat(last.replace("Z","+00:00")) if last.endswith("Z") else datetime.fromisoformat(last)
            dt = dt + timedelta(milliseconds=3)
            ev["_source"]["timestamp"] = utc_iso(dt)
            ev["_source"]["predecoder"]["timestamp"] = dt.strftime("%b %d %H:%M:%S")
            last = ev["_source"]["timestamp"]
        else:
            last = ts
    return out

def write_jsonl(path, events):
    with open(path, "w") as f:
        for ev in events:
            f.write(json.dumps(ev) + "\n")

def write_csv(path, events):
    fields = [
        "timestamp","agent_name","agent_ip","srcuser","srcip","decoder_name","program_name",
        "rule_level","rule_description","rule_groups","full_log",
        "label","attack_type","hour_of_day","day_of_week","success"
    ]
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields); w.writeheader()
        for ev in events:
            s = ev["_source"]; r = s["rule"]; d = s["data"]
            success = 1 if ("authentication_success" in (r.get("groups") or []) or "Accepted" in s.get("full_log","")) else 0
            row = {
                "timestamp": s["timestamp"],
                "agent_name": s["agent"]["name"],
                "agent_ip": s["agent"]["ip"],     # blank by design
                "srcuser": d.get("srcuser",""),
                "srcip": d.get("srcip",""),       # blank by design
                "decoder_name": s["decoder"]["name"],
                "program_name": s["predecoder"]["program_name"],
                "rule_level": r.get("level",0),
                "rule_description": r.get("description",""),
                "rule_groups": ";".join(r.get("groups",[])) if r.get("groups") else "",
                "full_log": s.get("full_log",""),
                "label": "benign",
                "attack_type": "auth_success" if success else "auth_fail_benign",
                "hour_of_day": datetime.fromisoformat(s["timestamp"].replace("Z","+00:00")).hour,
                "day_of_week": datetime.fromisoformat(s["timestamp"].replace("Z","+00:00")).weekday(),
                "success": success
            }
            w.writerow(row)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--outdir", default="./out")
    ap.add_argument("--events", type=int, default=40000)
    ap.add_argument("--days", type=int, default=1)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    evs = orchestrate(args.events, args.days, args.seed)
    jsonl_path = os.path.join(args.outdir, "benign_noip.jsonl")
    csv_path   = os.path.join(args.outdir, "benign_noip_flat.csv")
    write_jsonl(jsonl_path, evs); write_csv(csv_path, evs)
    print(f"[+] Wrote {len(evs)} benign (no-IP) events")
    print(f"[+] JSONL: {jsonl_path}")
    print(f"[+] CSV  : {csv_path}")

if __name__ == "__main__":
    main()
