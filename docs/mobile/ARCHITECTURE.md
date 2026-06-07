# Architecture mobile — CampusFlow Lite

## Vue d'ensemble

```mermaid
flowchart TB
  subgraph native [Android APK]
    CAP[Capacitor WebView]
    PLUG[Plugins Camera / Network / Splash]
  end

  subgraph react [React Mobile-First]
    NAV[Bottom Nav 5 onglets]
    MAP[Carte Leaflet plein écran]
    BS[Bottom Sheets]
    OFF[localforage offline]
  end

  subgraph api [Backend FastAPI]
    REST[/flux/live /sensors]
    WS[/ws/live-occupancy/]
  end

  CAP --> react
  PLUG --> CAP
  react --> REST
  react --> WS
  OFF --> react
```

## Principes mobile-first

1. **Design** : 360–412 px en priorité, desktop en adaptation (`md:`).
2. **Navigation** : barre inférieure fixe, zones tactiles ≥ 44 px.
3. **Contenu** : bottom sheets (25 / 50 / 90 %) au lieu de panneaux latéraux.
4. **Carte** : toujours visible, HUD masqué sur mobile.
5. **Offline** : `campus.json` + `capteurs.json` en cache localforage.

## Couches

| Couche | Responsabilité |
|--------|----------------|
| `AppNav.jsx` | Navigation 5 onglets mobile |
| `BottomSheet.jsx` | Gestes snap, backdrop |
| `SensorDataContext` | Données + WebSocket + offline |
| `offlineStorage.js` | Cache bâtiments / préférences |
| `capacitor.js` | Init native, splash, status bar |

## Fichiers livrables APK

| Livrable | Emplacement |
|----------|-------------|
| Projet Android | `frontend/android/` |
| Config Capacitor | `frontend/capacitor.config.json` |
| Icône source | `frontend/resources/icon.png` |
| APK Debug | `android/app/build/outputs/apk/debug/` |
| APK Release | `android/app/build/outputs/apk/release/` |
| AAB Release | `android/app/build/outputs/bundle/release/` |

## Identifiant application

```text
com.supptic.campusflow
```
