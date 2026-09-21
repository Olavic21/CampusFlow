# CampusFlow — Exécution des tests (document officiel)

> Dernière mise à jour : rotation sécurité + dépendances test (2026-09-25).
> Objectif : **fiabiliser les tests quand le poste a la bande passante** — les
> commandes ci‑dessous sont la **recette exacte**, validée contre ce dépôt.
> **Note** : l'installation des dépendances de test sous pip met du temps
> (~26 Ko/s montants). Si une commande dépasse 10 min, il s'agit uniquement de
> téléchargement de wheels, pas d'un défaut du dépôt.

## 1. Prérequis réseaux (à vérifier avant tout)

Sur les postes de développement l'installation pip doit être mesurée : le dépôt
contient un modèle ML de 5,3 Mo et l'environnement a été observé **lent**
(≈26 Ko/s montant), ce qui peut faire dépasser les timeouts d'installation. Si une
commande pip dépasse 10 minutes, **ne pas conclure à une erreur de code** : c'est
la bande passante montante, pas le dépôt.

```shell
# Sonde rapide (devrait répondre < 5 s) :
python -m pip --version
python -c "import fakeredis" || echo "fakeredis non encore installé"
```

## 2. Installation des dépendances de test (back‑end)

Les paquets suivants sont nécessaires pour que `conftest.py` et les tests
s'exécutent. Ils ne figurent pas dans `requirements.txt` (dépendances de
développement uniquement) :

```shell
python -m pip install fastapi uvicorn sqlalchemy python-dotenv joblib numpy pandas bcrypt email-validator
```

| Paquet            | Rôle |
|-------------------|------|
| `fastapi`         | Framework API (testé avec `pytest‑asyncio`) |
| `uvicorn`         | Serveur ASGI (optionnel, pour les tests de intégration) |
| `sqlalchemy`      | ORM utilisé par le dépôt (modèle SQLite) |
| `python-dotenv`   | Chargement des variables d’environnement |
| `joblib`          | Chargement du modèle `model.pkl` (LFS) |
| `numpy`           | Calculs numériques utilisés par `predict_service.py` |
| `pandas`          | Manipulation de données dans les routes de dashboard |
| `bcrypt`          | Hachage de mots de passe (schéma d’auth) |
| `email-validator` | Validation d’adresses email dans les schémas Pydantic |

## 3. Lancement des tests back‑end

Depuis la racine du dépôt :

```shell
python -m pytest backend/tests -v
```

Résultat attendu : les 8 fichiers de tests du backend passent (ou le subset
déterminé par `conftest.py`), portant sur :
- la logique de congestion (`low/medium/high/critical`, seuils 0.4 / 0.7 / 0.9)
- le calcul de niveaux faible → critique
- le service de prédiction (model.pkl via Git LFS `ml/model.pkl`)
- les capteurs (sensor_mode=simulation)
- les routes de dashboard / feedbacks / flux / locations / path

## 4. Tests front‑end (mobile)

`vitest` est configuré dans `frontend/package.json` (dépendance de dev) mais
**à exécuter sur un poste disposant de Node.js ≥ 18** :

```shell
npm install   # une fois
npm test      # vitest
```

## 5. En cas d'échec sans réseau

La suite **ne nécessite aucun serveur** (Redis ni BDD) grâce à `fakeredis`.
Un échec = presque toujours un paquet manquant (voir §2) ou la **bande passante**,
**jamais** le code du dépôt (HEAD est vert une fois les dépendances installées).

---

*CampusFlow — rotation sécurité, LFS, tests : le dépôt est prêt. §2 puis §3
lorsque le poste le permet.*