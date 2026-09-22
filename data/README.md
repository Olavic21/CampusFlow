# Architecture de données — CampusFlow Lite

Ce dossier contient la génération, la documentation et le chargement des données simulées pour CampusFlow Lite (campus fictif à Yaoundé).

## Arborescence

```
data/
├── README.md                 # Ce document
├── load_postgres.py          # ETL : CSV/JSON → PostgreSQL
├── io_utils.py               # Lecture CSV multi-encodage
├── .env.example              # Variables PGHOST, PGDATABASE, etc.
├── db/
│   └── schema.sql            # Schéma PostgreSQL (+ PostGIS)
└── raw/
    ├── campus.json           # Lieux du campus (source de vérité)
    ├── generate_flux.py      # Génère flux historique.csv
    ├── generate_schedules.py # Génère schedules.csv
    ├── generate_feedback.py  # Génère feedbacks.csv
    ├── flux historique.csv   # (généré) fréquentation horaire
    ├── schedules.csv         # (généré) emplois du temps par groupe
    └── feedbacks.csv         # (généré) avis étudiants
```

Les dépendances Python du projet sont dans `requirements.txt` à la racine du dépôt.

---

## 1. `raw/campus.json`

Source de vérité pour tous les lieux du campus.

| Champ       | Type     | Description                                      |
| :---------- | :------- | :----------------------------------------------- |
| `id`        | `int`    | Identifiant unique du lieu                       |
| `nom`       | `string` | Nom du lieu (ex. « Amphi », « Bibliothèque »)  |
| `latitude`  | `float`  | Latitude (Yaoundé)                               |
| `longitude` | `float`  | Longitude (Yaoundé)                              |
| `capacite`  | `int`    | Capacité maximale en nombre de places            |
| `type`      | `string` | Type de lieu (amphithéâtre, salle, labo, etc.)   |

---

## 2. `generate_flux.py` → `flux historique.csv`

Simule la présence étudiante sur **4 semaines** à partir du **1ᵉʳ mai 2026**, du **lundi au samedi**, de **7h à 21h** (pas horaire), pour chaque lieu de `campus.json`. Les dimanches sont ignorés.

### Règles de réalisme

| Lieu / cas | Comportement |
| :--------- | :------------- |
| **Bibliothèque** | `activite_prevue = 0` ; pics 12h–14h et ≥ 17h (15–55 % capacité), sinon faible affluence (0–15 %) |
| **Amphi** | Activité prévue lun / mer / ven ; occupation 30–65 % de la capacité |
| **Petites salles TP** (`capacite == 15`) | Activité prévue mar / jeu |
| **Autres salles** | ~25 % de chance d’activité prévue par créneau |
| **Activité prévue** | Occupation cible 35–65 % (sous 70 % pour limiter le « eleve ») |
| **Sans activité** (hors biblio.) | 0–25 % de la capacité |
| **Samedi** | Affluence réduite (× 0,20–0,50) |
| **Bruit** | ± quelques étudiants, plafonné à `capacite` |

### Colonnes de `flux historique.csv`

| Colonne             | Type     | Description |
| :------------------ | :------- | :---------- |
| `location_id`       | `int`    | ID du lieu (`campus.json`) |
| `timestamp`         | `string` | `YYYY-MM-DD HH:MM:SS` |
| `heure_du_jour`     | `int`    | Heure (7–21) |
| `jour_semaine`      | `int`    | 0 = lundi … 5 = samedi |
| `activite_prevue`   | `int`    | `1` si cours/activité prévue, sinon `0` |
| `nombre_etudiants`  | `int`    | Effectif simulé |
| `niveau_congestion` | `string` | `faible` (&lt; 30 %), `moyen` (30–70 %), `eleve` (&gt; 70 %) |

Volume attendu : **~6 000 lignes** (4 semaines × 6 jours × 15 h × nombre de lieux).

### Exécution

```bash
cd data/raw
python generate_flux.py
```

---

## 3. `generate_schedules.py` → `schedules.csv`

Génère des emplois du temps **par groupe pédagogique** (et non plus par `etudiant_id` individuel), sur la même période que les flux (4 semaines depuis le 1ᵉʳ mai 2026).

### Groupes

- **Cours magistraux** : `ITT1A`, `ITT1B`, `ITT2A`, `ITT2B`, `ITT3RC`, `ITT3IR`, `IPT1`, `IPT2`
- **Travaux pratiques** (niveaux 1–2 ITT uniquement) : sous-groupes `ITT1A-G1` … `ITT2B-G4` (16 groupes TP, 4 par filière L1/L2)

### Créneaux et salles

- Créneaux : `(7–9)`, `(9–11)`, `(11–13)`, `(13–15)`, `(15–17)`, `(17–19)`
- **Cours** : 1 à 3 créneaux/jour/groupe ; salle = amphi (60 %) ou grande salle de cours (40 %)
- **TP** : 0 à 2 créneaux/jour/groupe TP ; salle = salle TP (80 %) ou salle de cours (20 %)

Répartition des salles selon la capacité et le nom dans `campus.json` (amphi ≥ 100, cours 30–99, TP ≤ 60, hors bibliothèque).

### Colonnes de `schedules.csv`

| Colonne         | Type     | Description |
| :-------------- | :------- | :---------- |
| `id`            | `int`    | Identifiant unique du créneau |
| `groupe`        | `string` | Code groupe (ex. `ITT1A`, `ITT1A-G2`) |
| `type_activite` | `string` | `cours` ou `tp` |
| `salle_id`      | `int`    | ID du lieu |
| `heure_debut`   | `string` | Début `YYYY-MM-DD HH:MM:SS` |
| `heure_fin`     | `string` | Fin `YYYY-MM-DD HH:MM:SS` |
| `jour_semaine`  | `int`    | 0 = lundi … 5 = samedi |

### Exécution

```bash
cd data/raw
python generate_schedules.py
```

> **Note chargement PostgreSQL** : le schéma `db/schema.sql` et `load_postgres.py` utilisent encore la colonne `etudiant_id` pour la table `schedules`. Après régénération du CSV, adapter le schéma et le loader pour mapper `groupe` / `type_activite` si besoin.

---

## 4. `generate_feedback.py` → `feedbacks.csv`

Génère **1 000** feedbacks en français, avec sentiment `positif` (60 %), `negatif` (20 %), `neutre` (20 %). Les horodatages sont tirés aléatoirement dans la plage couverte par `flux historique.csv` (à générer avant).

### Colonnes de `feedbacks.csv`

| Colonne       | Type     | Description |
| :------------ | :------- | :---------- |
| `id`          | `int`    | Identifiant du feedback |
| `etudiant_id` | `int`    | ID étudiant fictif (1–200) |
| `texte`       | `string` | Message en français |
| `sentiment`   | `string` | `positif`, `negatif`, `neutre` |
| `timestamp`   | `string` | `YYYY-MM-DD HH:MM:SS` |

### Exécution

```bash
cd data/raw
python generate_feedback.py
```

---

## 5. `db/schema.sql`

Définit les tables PostgreSQL `locations`, `schedules`, `flux`, `feedbacks` (clés, index, PostGIS sur `locations.geom`).

```bash
psql -U campusflow -d campusflow -f data/db/schema.sql
```

PostGIS doit être disponible sur la base (`CREATE EXTENSION postgis`).

---

## 6. `load_postgres.py`

Charge `raw/campus.json`, `raw/flux historique.csv`, `raw/schedules.csv` et `raw/feedbacks.csv` vers PostgreSQL.

### Configuration

Copier `data/.env.example` vers `data/.env` ou exporter les variables :

| Variable      | Défaut        |
| :------------ | :------------ |
| `PGHOST`      | `localhost`   |
| `PGPORT`      | `5432`        |
| `PGDATABASE`  | `campusflow`  |
| `PGUSER`      | `campusflow`  |
| `PGPASSWORD`  | `campusflow`  |

### Exécution

Depuis la racine du dépôt (avec le venv activé) :

```bash
python data/load_postgres.py
```

---

## Ordre d’exécution recommandé

1. **Environnement** (à la racine du projet) :
   ```bash
   python -m venv .venv
   .venv\Scripts\activate          # Windows
   pip install -r requirements.txt
   ```

2. **Générer les CSV** (dans `data/raw`) :
   ```bash
   cd data/raw
   python generate_flux.py
   python generate_schedules.py
   python generate_feedback.py
   ```

3. **Créer le schéma PostgreSQL** :
   ```bash
   psql -U campusflow -d campusflow -f data/db/schema.sql
   ```

4. **Charger les données** :
   ```bash
   python data/load_postgres.py
   ```

Cette chaîne alimente les pipelines ML (`ml/`), le backend FastAPI et le frontend du projet.
