# Benign set
python gen_benign_auth.py --outdir ./out --events 40000 --days 2 --seed 11

# Malicious set
python gen_malic_auth.py --outdir ./out --events 60000 --days 2 --attackers 20 --seed 11


# NOIP Benign
python gen_benign_auth_noip.py --outdir ./out --events 40000 --days 2 --seed 11

# NOIP Malicious
python gen_malic_auth_noip.py --outdir ./out --events 60000 --days 2 --seed 11