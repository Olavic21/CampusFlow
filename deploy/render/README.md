# Déploiement Render — CampusFlow Backend

> **Obsolète** : le déploiement Oracle Cloud (`deploy/oracle/`) n'est plus le chemin
> de déploiement principal. Il est conservé à titre d'historique uniquement.
> L'architecture actuelle est **Vercel (frontend) + Render (backend FastAPI + SQLite)**.

## Architecture

```
GitHub
 ├──► Vercel  — React 19 + Vite 8 (frontend/)
 └──► Render  — FastAPI + Uvicorn + SQLite (backend/)
```

## 1. Créer le Web Service Render

1. Pusher la branche `mobile-release` sur GitHub.
2. Render Dashboard → **New → Web Service** → connecter le dépôt `nkoumougrinnel/CampusFlow`.
3. Configuration :

| Paramètre | Valeur |
|---|---|
| Service type | Web Service |
| Root Directory | `backend` |
| Runtime | Python |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |
| Plan | Free (démonstration) |

Alternative : **Blueprint** — Render lit automatiquement `deploy/render/render.yaml`
(New → Blueprint → sélectionner le dépôt).

## 2. Variables d'environnement

Gabarit complet : `deploy/render/.env.render.example` (aucun secret réel).

| Variable | Valeur Render |
|---|---|
| `DATABASE_URL` | `sqlite:////opt/render/project/src/data/campusflow.db` (4 slashes = chemin absolu) |
| `JWT_SECRET` | généré par Render (`generateValue: true` dans le blueprint) — **jamais dans Git** |
| `CORS_ORIGINS` | d'abord `http://localhost:5173`, puis l'URL Vercel réelle (§ 4) |
| `PUBLIC_API_BASE` | `https://<service>.onrender.com` |
| `SENSOR_MODE` | `simulation` |
| `SENSOR_SIM_INTERVAL_SEC` | `10` |
| `CAPTEURS_JSON_PATH` | `/opt/render/project/src/data/raw/capteurs.json` |
| `MEDIA_ROOT` | `/opt/render/project/src/data/media` |
| `MEDIA_URL` | `/media` |
| `PYTHON_VERSION` | `3.12.7` |

`REDIS_URL` n'est pas défini : le client Redis bascule sur son stub gracieux (cache mémoire).
`ML_MODEL_PATH` n'est pas défini et `ml/model.pkl` est hors Git (gitignore) : `/predict` renvoie 503 —
feature ML optionnelle, aucun impact sur le reste de l'API.

## 3. SQLite — LIMITATION IMPORTANTE (Render Free)

**SQLite sur Render Free = stockage NON durable garanti.**

- Le système de fichiers local de Render Free est **éphémère** : à chaque redéploiement
  (et tout replacement d'instance), le disque est réinitialisé.
- Conséquence : la base SQLite et les avatars uploadés (`MEDIA_ROOT`) sont **recréés à zéro**
  (tables + seed `init_db()` + 38 bâtiments + capteurs simulés) à chaque déploiement.
- Un **Disk persistant Render** (Starter+, 1 GB min) monté sur `/data` permettrait de conserver
  `sqlite:////data/campusflow.db` — non disponible sur Free.
- Cette architecture est explicitement une **version de démonstration/test**, pas une
  infrastructure de production durable.

## 4. CORS — après le déploiement Vercel

1. Déployer le frontend sur Vercel (cf. `docs/DEPLOIEMENT.md` § Vercel).
2. Récupérer l'URL réelle, ex. `https://campusflow-xxxxx.vercel.app`.
3. Render → Environment → `CORS_ORIGINS=https://campusflow-xxxxx.vercel.app` (+ `http://localhost:5173` pour le dev).
4. **Ne pas utiliser `*`** : l'application envoie des credentials (JWT Authorization).
5. Save → le service redémarre automatiquement.

## 5. Vérification

```bash
# Backend
curl https://<service>.onrender.com/health
curl https://<service>.onrender.com/docs

# Chaîne complète (API + CORS + frontend)
python scripts/verify_deployment.py \
  --api https://<service>.onrender.com \
  --frontend https://<vercel-url> \
  --origin https://<vercel-url>
```

## 6. Maintenance / logs

- **Logs** : Render Dashboard → service → onglet *Logs*.
- **Redéploiement** : tout push sur la branche suivie déclenche un build (autoDeploy).
  Manuel : *Manual Deploy → Deploy latest commit*.
- **Free tier** : le service peut être mis en veille après ~15 min d'inactivité ;
  la première requête suivante subit un cold start (~30-60 s).
