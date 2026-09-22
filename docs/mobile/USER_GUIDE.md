# CampusFlow — Guide utilisateur

## Navigation

Barre inférieure à 5 onglets :

| Onglet | Usage |
|--------|-------|
| **Carte** | Vue principale du campus SUP'PTIC |
| **Bâtiments** | Liste et recherche des salles |
| **Itinéraires** | Calcul piéton intelligent |
| **Stats** | Occupation, état campus, prévisions |
| **Profil** | Compte, favoris, paramètres |

## Carte

- Pincez pour zoomer, glissez pour vous déplacer.
- Touchez un marqueur pour ouvrir la fiche bâtiment (bottom sheet).
- Couleurs : vert (disponible) → rouge (saturé).
- Badge source : 🟢 Réel / 🟡 Simulation / ⚪ Twin / 🔮 Prévision / ⚠️ Obsolète.

## Itinéraire

1. Onglet **Itinéraires** ou bouton « Créer itinéraire » sur une fiche.
2. Choisissez départ et arrivée.
3. Cliquez **Calculer** pour lancer la navigation sur la carte.
4. Distance et durée s'affichent en bas sans masquer la carte.

### Profils d'itinéraire

- **Le plus rapide** : route la plus courte en temps
- **Éviter l'affluence** : évite les zones bondées
- **Accessible PMR** : route accessible (si données disponibles)

### Navigation GPS

- Activez la navigation pour suivre votre position en temps réel.
- L'application vous guide pas à pas avec calcul automatique du recalcul si vous vous éloignez.

## Bâtiments

- Liste tous les 38 bâtiments SUP'PTIC.
- Recherche par nom ou code.
- Filtres : catégorie, "libre maintenant".
- Tri par affluence (de la moins fréquentée à la plus fréquentée).

### Fiche bâtiment

- Occupation actuelle (avec source : réel/simulation/twin/prévision)
- Historique des 4 dernières semaines
- Prévision des 24 prochaines heures (profil horaire)
- Bouton "Itinéraire vers..." pour se rendre au bâtiment
- Bouton "Favori" pour garder en accès rapide

## Statistiques

- **État du campus** : occupation moyenne, nombre de salles saturées, tendance
- **Bâtiments** : occupation par bâtiment, capacité, type
- **Prévisions** : occupation prévue pour les 24 prochaines heures

## Incidents

- Les incidents sont des fermetures temporaires de zones (salle, bâtiment, allée).
- Elles sont visibles sur la carte (icône incident) et dans les fiches bâtiments.
- Elles impactent les itinéraires (les zones fermées sont évitées).

## Mode hors ligne

Si le serveur est injoignable :

- Badge **📡 Mode Hors Ligne**
- Données campus et simulation depuis le cache local
- La carte nécessite Internet pour les tuiles
- Les itinéraires et favoris sont disponibles hors ligne

## Supervision IoT (menu Admin)

Accessible aux rôles staff et admin :

- Tableau de bord des capteurs (actifs, lectures, dernière synchronisation)
- CRUD des capteurs (créer, modifier, supprimer)
- Détection automatique des capteurs offline (heartbeat manquant)
- Mode hybride : capteurs réels + simulation pour les bâtiments sans capteur

## Profil

- Modifier le nom, l'avatar (caméra ou galerie).
- Gestion des favoris (bâtiments et itinéraires).
- Historique des itinéraires effectués.
- **Alertes saturation** : notifications locales quand un bâtiment favori devient saturé.
- **Admin** (si rôle admin) : accès à la console d'administration.

## Rôles

| Rôle | Accès |
|------|-------|
| Étudiant (défaut) | Lecture, favoris, itinéraires, liste capteurs |
| Staff | + création/modification incidents, capteurs, injection test |
| Admin | + gestion utilisateurs, suppression capteurs, statistiques admin |

Pour changer de rôle, contacter un administrateur.

---

*CampusFlow — SUP'PTIC Yaoundé, Cameroun.*