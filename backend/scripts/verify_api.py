#!/usr/bin/env python3
"""Vérifie tous les endpoints API CampusFlow."""
import sys
import json
import urllib.request
import urllib.error

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"

CHECKS = [
    ("GET", "/health", None),
    ("GET", "/locations", None),
    ("GET", "/flux/live?window=60", None),
    ("GET", "/congestion", None),
    ("GET", "/path?from=1&to=8&avoid_congestion=true", None),
    ("GET", "/dashboard/stats?period=week", None),
    ("GET", "/flux/history/8?granularity=day", None),
    ("GET", "/feedbacks?limit=5", None),
]


def check(method, path, body):
    url = f"{BASE}{path}"
    req = urllib.request.Request(url, method=method)
    if body:
        req.data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            return resp.status, data
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return 0, str(e)


def main():
    print(f"Vérification API CampusFlow — {BASE}\n")
    ok = 0
    fail = 0
    for method, path, body in CHECKS:
        status, data = check(method, path, body)
        if status == 200:
            ok += 1
            preview = ""
            if isinstance(data, list):
                preview = f" ({len(data)} items)"
            elif isinstance(data, dict):
                keys = list(data.keys())[:4]
                preview = f" (keys: {keys})"
            print(f"  OK  {method} {path}{preview}")
        else:
            fail += 1
            print(f"  FAIL {method} {path} → {status}: {str(data)[:120]}")

    # Cohérence SUP'PTIC
    _, locs = check("GET", "/locations", None)
    if isinstance(locs, list) and locs:
        lat_ok = all(3.868 <= float(l["latitude"]) <= 3.871 for l in locs)
        lon_ok = all(11.507 <= float(l["longitude"]) <= 11.510 for l in locs)
        print(f"\n  Coordonnées SUP'PTIC : {len(locs)} bâtiments, lat OK={lat_ok}, lon OK={lon_ok}")

    print(f"\nRésultat : {ok} OK, {fail} FAIL")
    sys.exit(0 if fail == 0 else 1)


if __name__ == "__main__":
    main()
