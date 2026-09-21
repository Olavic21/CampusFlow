#!/usr/bin/env python3
"""
verify_deployment.py — Vérification post-déploiement de CampusFlow.

Contrôle réellement (et non « le tableau de bord affiche success ») :
  · backend Oracle Cloud : API REST, endpoints principaux, données issues de la base
  · CORS : préflight OPTIONS + GET avec en-tête Origin (contrat exact du navigateur)
  · frontend Vercel : page servie, bundles JS/CSS, ABSENCE de toute URL localhost
  · contrat frontend → backend : URL d'API effectivement compilée dans le bundle

Aucune dépendance externe (bibliothèque standard uniquement).

Usage :
    python scripts/verify_deployment.py \
        --api https://api-campusflow.<domaine> \
        --frontend https://campusflow.vercel.app \
        --origin https://campusflow.vercel.app
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request

TIMEOUT = 15
LOCALHOST_MARKERS = ("127.0.0.1:8000", "localhost:8000", "127.0.0.1:5173", "localhost:5173")

results: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(f"  [{'OK  ' if ok else 'FAIL'}] {name}{(' — ' + detail) if detail else ''}")


def http(url: str, method: str = "GET", headers: dict | None = None, body: bytes | None = None):
    req = urllib.request.Request(url, method=method, data=body, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()
    except Exception as e:  # réseau, DNS, TLS
        return 0, {}, str(e).encode()


def as_json(raw: bytes):
    try:
        return json.loads(raw.decode("utf-8", "replace"))
    except Exception:
        return None


# ── Backend ──────────────────────────────────────────────────────────────────
def check_backend(api: str) -> None:
    print(f"\n== BACKEND : {api} ==")
    status, _, _ = http(f"{api}/health")
    record("API accessible (/health)", status == 200, f"HTTP {status}")
    if status != 200:
        return

    status, _, raw = http(f"{api}/")
    record("Racine API", status == 200 and isinstance(as_json(raw), dict), f"HTTP {status}")

    status, _, raw = http(f"{api}/openapi.json")
    spec = as_json(raw)
    n_paths = len(spec.get("paths", {})) if isinstance(spec, dict) else 0
    record("Documentation OpenAPI", status == 200 and n_paths > 0, f"{n_paths} routes")

    status, _, raw = http(f"{api}/locations")
    locs = as_json(raw)
    ok = status == 200 and isinstance(locs, list) and len(locs) > 0
    record("GET /locations (base de données)", ok,
           f"{len(locs) if isinstance(locs, list) else 0} bâtiments")
    if ok:
        lat_ok = all(3.86 <= float(l["latitude"]) <= 3.88 for l in locs)
        lon_ok = all(11.50 <= float(l["longitude"]) <= 11.52 for l in locs)
        record("Coordonnées SUP'PTIC cohérentes", lat_ok and lon_ok, "lat/lon dans la zone campus")

    status, _, raw = http(f"{api}/flux/live?window=60")
    live = as_json(raw)
    record("GET /flux/live (temps réel)", status == 200 and isinstance(live, list),
           f"{len(live) if isinstance(live, list) else 0} mesures")

    status, _, raw = http(f"{api}/flux/history/1?granularity=day")
    hist = as_json(raw)
    record("GET /flux/history/1 (historique)",
           status == 200 and isinstance(hist, dict) and "data" in hist, f"HTTP {status}")

    for label, path in (
        ("GET /congestion", "/congestion"),
        ("GET /path (itinéraire)", "/path?from=1&to=8&avoid_congestion=true"),
        ("GET /dashboard/stats", "/dashboard/stats?period=week"),
        ("GET /sensors/status (IoT)", "/sensors/status"),
        ("GET /incidents", "/incidents?active_only=true"),
    ):
        status, _, _ = http(f"{api}{path}")
        record(label, status == 200, f"HTTP {status}")


# ── CORS ─────────────────────────────────────────────────────────────────────
def check_cors(api: str, origin: str) -> None:
    print(f"\n== CORS : origine autorisée {origin} ==")
    status, headers, _ = http(
        f"{api}/health",
        method="OPTIONS",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    allow = headers.get("access-control-allow-origin")
    record("Préflight OPTIONS accepté", status in (200, 204) and allow in (origin, "*"),
           f"HTTP {status}, allow-origin={allow}")

    status, headers, _ = http(f"{api}/health", headers={"Origin": origin})
    allow = headers.get("access-control-allow-origin")
    record("GET avec Origin → en-tête CORS", status == 200 and allow in (origin, "*"),
           f"allow-origin={allow}")
    record("Access-Control-Allow-Credentials", headers.get("access-control-allow-credentials") == "true",
           f"valeur={headers.get('access-control-allow-credentials')}")


# ── Frontend ─────────────────────────────────────────────────────────────────
def check_frontend(frontend: str, api: str) -> None:
    print(f"\n== FRONTEND : {frontend} ==")
    status, _, raw = http(frontend)
    html = raw.decode("utf-8", "replace") if status else ""
    record("Application accessible", status == 200 and "CampusFlow" in html, f"HTTP {status}")

    status, _, _ = http(f"{frontend}/manifest.webmanifest")
    record("Manifeste PWA", status == 200, f"HTTP {status}")

    srcs = re.findall(r'(?:src|href)="([^"]+\.(?:js|css))"', html)
    bundles = []
    for src in dict.fromkeys(srcs):
        url = src if src.startswith("http") else f"{frontend}/{src.lstrip('./')}"
        st, _, body = http(url)
        if st == 200:
            bundles.append((url, body.decode("utf-8", "replace")))
    record("Bundles JS/CSS servis", len(bundles) > 0, f"{len(bundles)} fichiers")

    hits = sorted({m for _, txt in bundles for m in LOCALHOST_MARKERS if m in txt})
    record("Aucune URL localhost dans le build", not hits, f"trouvé : {hits}" if hits else "aucune")

    api_host = re.sub(r"^https?://", "", api).rstrip("/")
    record("URL de l'API compilée dans le bundle", any(api_host in txt for _, txt in bundles),
           api_host)


def main() -> int:
    parser = argparse.ArgumentParser(description="Vérification post-déploiement CampusFlow")
    parser.add_argument("--api", required=True, help="URL publique du backend (Oracle Cloud)")
    parser.add_argument("--frontend", default="", help="URL publique du frontend (Vercel)")
    parser.add_argument("--origin", default="", help="Origine testée en CORS (défaut : frontend)")
    args = parser.parse_args()

    api = args.api.rstrip("/")
    frontend = args.frontend.rstrip("/")
    origin = (args.origin or frontend).rstrip("/")

    print("Vérification du déploiement CampusFlow")
    print(f"  backend  : {api}")
    print(f"  frontend : {frontend or '(non testé)'}")

    check_backend(api)
    if origin:
        check_cors(api, origin)
    if frontend:
        check_frontend(frontend, api)

    passed = sum(1 for _, ok, _ in results if ok)
    failed = [(n, d) for n, ok, d in results if not ok]
    print(f"\nRésultat : {passed}/{len(results)} contrôles réussis")
    for name, detail in failed:
        print(f"  FAIL {name} — {detail}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

