# Mise à jour CampusFlow Lite (APK)

## Mise à jour applicative (code React)

1. Modifier le frontend.
2. Incrémenter `version` dans `frontend/package.json` et `android/app/build.gradle` (`versionCode`, `versionName`).
3. Rebuild :

```bash
cd frontend
npm run cap:sync
cd android
./gradlew assembleRelease
```

4. Distribuer le nouvel APK aux utilisateurs.

## Mise à jour sans réinstallation (futur)

Pour les mises à jour OTA via Play Store, publiez un nouveau **AAB** avec `versionCode` supérieur.

## Synchronisation backend

L'APK pointe vers `VITE_BACKEND_DIRECT`. Si l'URL change :

1. Mettre à jour `.env`
2. Rebuild obligatoire (`cap:sync`)

Les utilisateurs n'ont pas besoin de réinstaller si l'URL backend reste stable.

## Checklist release

- [ ] Tests sur 360×640 et 412×915
- [ ] Backend accessible depuis réseau mobile
- [ ] `versionCode` incrémenté
- [ ] Keystore release configuré
- [ ] Notes de version rédigées
