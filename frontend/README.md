# CampusFlow Frontend

Application web responsive permettant la navigation et la visualisation des bâtiments, itinéraires et données de flux du campus.

## 📋 Vue d'ensemble du projet

CampusFlow Frontend est une application **React 19** construite avec **Vite**, utilisant **Tailwind CSS** pour le styling et **Leaflet** pour les cartes interactives. L'application adopte un **design responsive** avec deux layouts distincts : un pour mobile (< 768px) et un pour desktop (≥ 768px).

---

## 📁 Structure du projet

### Configuration et fichiers racine

| Fichier | Rôle |
|---------|------|
| `package.json` | Gestion des dépendances npm et scripts de développement |
| `vite.config.js` | Configuration du bundler Vite et des alias de chemins |
| `tailwind.config.js` | Configuration de la génération des classes CSS Tailwind |
| `postcss.config.js` | Configuration PostCSS (autoprefixer, Tailwind) |
| `eslint.config.js` | Configuration du linter ESLint pour la qualité du code |
| `index.html` | Point d'entrée HTML de l'application |

### `src/` - Code source principal

**Cœur de l'application React avec tous les composants, hooks et styles.**

#### `src/main.jsx`
- **Point d'entrée de l'application**
- Initialise React et monte l'app dans le DOM
- Configure le Service Worker pour le mode hors ligne
- Importe les styles Leaflet

#### `src/App.jsx`
- **Composant racine de l'application**
- Gère la logique de **responsive design**
- Détermine le layout (Mobile ou Desktop) selon la taille d'écran
- Gère l'état global : `currentScreen` (navigation entre écrans) et `selectedSalle` (salle sélectionnée)
- Passe les props partagées aux layouts

#### `src/index.css`
- **Styles CSS globaux** (reset, variables CSS, etc.)
- Intégration des styles Tailwind

#### `src/App.css`
- **Styles spécifiques au composant App**

---

### `src/layouts/` - Structures de mise en page

**Deux layouts responsifs pour adapter l'interface à la taille d'écran.**

#### `DesktopLayout.jsx`
- **Layout pour écrans ≥ 768px**
- Structure : **sidebar gauche** (navigation fixe) + **carte plein écran** (droite)
- Barre de navigation horizontale en haut
- Affichage complet des informations du campus

#### `MobileLayout.jsx`
- **Layout pour écrans < 768px**
- Structure : **smartphone 430px centré**
- **Barre de navigation en haut** (navbar)
- **Barre de navigation inférieure** (bottom bar) pour la navigation
- Interface optimisée pour touch

---

### `src/components/` - Composants React réutilisables

**Composants UI modulaires pour construire l'interface.**

| Composant | Rôle |
|-----------|------|
| **BottomNavigationBar.jsx** | Barre de navigation inférieure (mobile) - onglets/menu principal |
| **CampusMap.jsx** | Composant Leaflet pour afficher la carte interactive du campus |
| **ItineraryPanel.jsx** | Panneau affichant les itinéraires / directions entre points |
| **Navbar.jsx** | Barre de navigation supérieure avec branding et actions principales |
| **RoomCard.jsx** | Carte affichant les informations d'une salle/batiment |

---

### `src/views/` - Vues/Pages de l'application

**Écrans/pages principales représentant les différentes sections de l'app.**

| Vue | Rôle |
|-----|------|
| **BuildingList.jsx** | Liste des bâtiments du campus avec recherche/filtrage |
| **MapView.jsx** | Vue principale avec la carte interactive du campus |

---

### `src/hooks/` - Hooks React personnalisés

**Logique réutilisable pour les composants React.**

#### `useMediaQuery.js`
- **Hook personnalisé pour les requêtes média CSS**
- Retourne un booléen indiquant si une media query est active
- Utilisé dans `App.jsx` pour déterminer le layout (mobile vs desktop)
- Permet une réactivité en temps réel aux changements de taille d'écran

---

### `src/data/` - Données et ressources

**Données statiques et fichiers de ressources utilisés par l'application.**

#### `raw/`
- **campus.json** : Données brutes du campus (bâtiments, salles, coordonnées, etc.)
- Importées et utilisées par les vues et composants pour afficher l'information

---

### `src/assets/` - Ressources statiques

**Images, icônes et autres fichiers médias** (dossier actuellement vide, pour future utilisation)

---

### `public/` - Fichiers publics statiques

**Ressources qui ne sont pas traitées par Vite** (favicon, manifest, etc.)

---

### `Components/` - Composants supplémentaires (hérité)

**Dossier legacy - À fusionner avec `src/components/`**

---

## 🚀 Commandes disponibles

```bash
# Démarrer le serveur de développement
npm run dev

# Construire l'application pour la production
npm run build

# Vérifier la qualité du code avec ESLint
npm run lint

# Prévisualiser la build de production localement
npm run preview
```

---

## 🛠️ Technologies principales

| Technologie | Utilisation |
|-------------|------------|
| **React 19** | Framework UI progressif |
| **Vite** | Bundler et dev server ultra-rapide |
| **Tailwind CSS** | Framework CSS utilitaire pour le styling |
| **Leaflet** | Bibliothèque de cartographie interactive |
| **React-Leaflet** | Wrapper React pour Leaflet |
| **Leaflet.Offline** | Support du mode hors ligne pour les cartes |
| **LocalForage** | Stockage local côté client (IndexedDB, localStorage) |
| **ESLint** | Linter pour la qualité du code |

---

## 📱 Design responsive

L'application utilise un **breakpoint à 768px** (Tailwind default) :

- **Mobile** (< 768px) : Interface optimisée pour smartphones/tablettes
- **Desktop** (≥ 768px) : Interface avec sidebar + carte plein écran

La responsivité est gérée via le hook `useMediaQuery()` et les classes Tailwind.

---

## 🔄 Flux de données

```
App.jsx
├── isDesktop ? DesktopLayout : MobileLayout
│   ├── currentScreen (état de navigation)
│   ├── selectedSalle (salle/batiment sélectionné)
│   └── Composants enfants
│       ├── CampusMap (carte Leaflet)
│       ├── BuildingList / MapView (vues)
│       ├── RoomCard (détails salle)
│       ├── ItineraryPanel (itinéraires)
│       └── Navbar / BottomNavigationBar (navigation)
```

---

## 📋 À faire et améliorations

- [ ] Fusionner `Components/` avec `src/components/`
- [ ] Remplir le dossier `src/assets/` avec les ressources (icônes, images)
- [ ] Connecter les composants aux APIs du backend
- [ ] Ajouter la gestion des états avec Context API ou Redux si nécessaire
- [ ] Implémenter la validation des formulaires
- [ ] Améliorer les performances avec lazy loading des vues

---

## 🤝 Contribution

Assurez-vous que la qualité du code est validée avant de soumettre des changements :

```bash
npm run lint
```

Respectez le **naming convention**, les **composants réutilisables** et adaptez votre code au **design responsive**.

---

## 📝 Notes de développement

- **Hot Module Replacement (HMR)** activé en développement pour un feedback instantané
- **Service Worker** enregistré pour support offline (si disponible)
- Les chemins d'import aliasés (`@data`) sont configurés dans `vite.config.js`
- Tailwind CSS génère uniquement les classes utilisées pour une taille optimale en production

---

## 📞 Support

Pour toute question sur l'architecture ou la structure du projet, consultez les commentaires dans les fichiers source, particulièrement dans `src/App.jsx` qui explique le layout responsive.
