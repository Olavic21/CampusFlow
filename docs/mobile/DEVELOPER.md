# CampusFlow Lite — Guide développeur mobile

## Stack

| Couche | Technologie |
|--------|-------------|
| UI | React 19 + Vite 8 + Tailwind |
| Native | Capacitor 8 + Android |
| Carte | Leaflet + react-leaflet |
| Offline | localforage + JSON embarqué |

## Workflow

```bash
# Développement web
cd frontend && npm run dev

# Backend LAN (téléphone / APK sur le même Wi-Fi)
# Depuis la racine : .\scripts\restart-backend.ps1 -Lan
# Depuis backend/ : .\scripts\restart-backend.ps1 -Lan

# Build + sync Android
npm run cap:sync

# Ouvrir Android Studio
npm run cap:android
```

## Structure mobile

```text
frontend/
├── capacitor.config.json
├── resources/icon.png          # Icône 1024×1024
├── android/                    # Projet Gradle Capacitor
├── src/
│   ├── components/ui/BottomSheet.jsx
│   ├── utils/capacitor.js
│   ├── services/offlineStorage.js
│   └── hooks/useAvatarPicker.js
```

## Plugins Capacitor

| Plugin | Usage |
|--------|-------|
| `@capacitor/camera` | Avatar profil |
| `@capacitor/geolocation` | Position utilisateur (préparé) |
| `@capacitor/network` | Détection hors ligne |
| `@capacitor/preferences` | Préférences locales |
| `@capacitor/splash-screen` | Splash natif |
| `@capacitor/status-bar` | Barre de statut bleue SUP'PTIC |
| `@capacitor/local-notifications` | Alertes saturation (préparé) |

## Variables d'environnement

```env
VITE_API_URL=http://IP:8000
VITE_BACKEND_DIRECT=http://IP:8000
VITE_SENSOR_MODE=api
```

`vite.config.js` utilise `base: './'` pour les chemins relatifs dans le WebView Capacitor.

## Breakpoint mobile-first

- Principal : `< 768px` (navigation bas, bottom sheets)
- Desktop : sidebar + panneaux latéraux

## Tests avant release

- [ ] Inscription / connexion / avatar
- [ ] Zoom carte, sélection bâtiment
- [ ] Itinéraire création / recalcul
- [ ] Dashboard stats + historique
- [ ] Mode simulation + WebSocket
- [ ] Rotation écran portrait
