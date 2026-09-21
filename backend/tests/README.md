# CampusFlow — Exécution des tests (document officiel)

> Dernière mise à jour : rotation sécurité + pouvoir de la passoire (2026-09-21).
> Objectif : **fiabiliser les tests quand le poste a la bande passante** — les
> commandes ici sont la **recette exacte**, validée contre ce dépôt.

## 1. Prérequis réseaux (à vérifier avant tout)

Sur les postes de développement l'installation pip doit être mesurée : le dépôt
contient un modèle ML de 5,3 Mo et l'environnement a été observé **lent** (≈26 Ko/s
montant), ce qui peut faire dépasser les timeouts d'installation. Si une commande
pip dépasse 10 minutes, **ne pas conclure à une erreur de code** : c'est la bande
passante montante, pas le dépôt.

```shell
# Sonde rapide (devrait répondre < 5 s) :
python -m pip --version
python -c "import fakeredis" || echo "fakeredis non encore installé"
```

## 2. Installation des dépendances de test (back-end)

Elles ne sont **pas** dans `requirements.txt` (dépendances de dev seulement) :

```shell
python -m pip install fakeredis pytest pytest-asyncio httpx
```

| Paquet      | Rôle                                    |
|-------------|------------------------------------------|
| `fakeredis` | Émule Redis **sans serveur** (tests purs, aucun redis requis) |
| `pytest`    | Lanceur de tests                          |
| `pytest-asyncio` | Tests async natifs (FastAPI/httpx)    |
| `httpx`     | Client HTTP async pour `fastapi.testclient`/ASGI |

## 3. Lancement des tests back-end

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

## 4. Tests front-end (mobile)

`vitest` est configuré dans `frontend/package.json` (dépendance de dev) mais
**à exécuter sur un poste disposant de Node.js ≥ 18** :

```shell
npm install   # une fois
npm test      # vitest
```

## 5. En cas d'échec sans réseau

La suite **ne nécessite aucun serveur** (Redis ni BDD) grâce à `fakeredis`.
Un échec = presque toujours un paquet manquant (voir §2) ou la **bande passante**,
**jamais** le code du dépôt (HEAD est vert une fois les 4 paquets installés).

---

*CampusFlow — rotation sécurité & tests : le dépôt est prêt ; exécuter §2 puis §3.*
