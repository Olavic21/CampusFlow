# CampusFlow Lite — Installation et build APK

Guide pour installer l'application sur Android et generer l'APK **sans Android Studio**.

---

## Prerequis

| Outil | Version | Verification |
|-------|---------|--------------|
| **JDK** | **17 ou 21** (LTS recommande) | `java -version` — **pas Java 25** |
| **Node.js** | 18+ | `node -v` |
| **Android SDK** | API 35, build-tools 35 | voir section SDK ci-dessous |
| **Telephone** | Android 8+ (API 26) | — |

L'APK communique avec le backend via l'**IP LAN** du PC (pas `127.0.0.1`). PC et telephone doivent etre sur le **meme reseau**.

---

## 1. Installer JDK 21 (si Java 25 est votre version par defaut)

Gradle Android ne supporte pas encore **Java 25**. Si `java -version` affiche `25.x` :

```powershell
.\scripts\install-jdk21.ps1
```

Ou telechargez [Temurin JDK 21](https://adoptium.net/temurin/releases/?version=21&os=windows&arch=x64&package=jdk). Le script `build-apk-cli.ps1` detecte automatiquement JDK 17-24.

---

## 2. Installer le SDK Android (sans Android Studio)

### Telechargement

1. [Command line tools only](https://developer.android.com/studio#command-line-tools-only) (Windows)
2. Placez le zip `commandlinetools-win-*.zip` dans votre dossier **Telechargements**

### Installation automatique (recommande)

```powershell
cd "C:\Users\HP PROBOOK 450 G2\CampusFlow"
.\scripts\install-android-sdk.ps1
```

Le script extrait le SDK dans `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\`, accepte les licences et installe `platform-tools`, `platforms;android-35`, `build-tools;35.0.0`.

### Installation manuelle

Structure obligatoire :

```text
%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat
```

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --licenses
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" "platform-tools" "platforms;android-35" "build-tools;35.0.0"
```

---

## 3. Configurer l'URL backend pour l'APK

Vite integre les variables au **moment du build**. Editez `frontend/.env.apk` ou laissez le script detecter l'IP :

```powershell
cd frontend
npm run env:apk
```

Exemple de contenu (`frontend/.env.apk`) :

```env
VITE_API_URL=http://10.94.13.27:8000
VITE_BACKEND_DIRECT=http://10.94.13.27:8000
VITE_WS_URL=ws://10.94.13.27:8000
VITE_SENSOR_MODE=api
```

Remplacez l'IP par celle de votre PC (`ipconfig` → adresse IPv4 Wi-Fi/Ethernet).

---

## 4. Demarrer le backend (accessible telephone)

Depuis la **racine du projet** :

```powershell
cd "C:\Users\HP PROBOOK 450 G2\CampusFlow"
.\scripts\restart-backend.ps1 -Lan
```

Depuis le dossier **backend** (equivalent) :

```powershell
cd "C:\Users\HP PROBOOK 450 G2\CampusFlow\backend"
.\scripts\restart-backend.ps1 -Lan
```

> Le script `backend\scripts\restart-backend.ps1` redirige vers `scripts\restart-backend.ps1` a la racine. Si vous voyez « terme non reconnu », verifiez que vous etes bien dans `CampusFlow` ou `CampusFlow\backend`, pas dans un sous-dossier plus profond.

Le flag `-Lan` lance uvicorn sur `0.0.0.0:8000` (ecoute reseau local).

Verifiez dans `backend/.env` :

```env
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://localhost,capacitor://localhost
```

Autorisez le port **8000** dans le pare-feu Windows si necessaire.

---

## 5. Generer l'APK (sans Android Studio)

### Methode recommandee (tout-en-un)

```powershell
cd "C:\Users\HP PROBOOK 450 G2\CampusFlow"
.\scripts\build-apk-cli.ps1 -DetectIp
```

Ce script :

1. Copie `.env.apk` → `.env` (detection IP optionnelle)
2. Verifie Java et le SDK Android
3. Execute `npm run cap:sync` (build Vite + sync Capacitor)
4. Lance `gradlew.bat assembleDebug`
5. Copie l'APK vers `CampusFlow-lite-debug.apk` a la racine

### Depuis le dossier frontend

```powershell
cd frontend
npm install
npm run build:apk
```

### Options du script

| Parametre | Effet |
|-----------|--------|
| `-DetectIp` | Detecte l'IP LAN et met a jour `.env` |
| `-LanIp 192.168.1.50` | Force une IP precise |
| `-SkipSync` | Saute le rebuild frontend (Gradle seul) |

> **Note :** l'ancien parametre `-Sync` n'existe plus. Par defaut, le sync est **toujours** execute.

---

## 6. Installer sur le telephone

1. Transferez `CampusFlow-lite-debug.apk` ou `frontend\android\app\build\outputs\apk\debug\app-debug.apk`
2. Activez **Installer des applications inconnues** pour votre gestionnaire de fichiers
3. Ouvrez l'APK et installez
4. Lancez **CampusFlow Lite**

---

## Fichiers generes

| Fichier | Chemin |
|---------|--------|
| APK Gradle | `frontend/android/app/build/outputs/apk/debug/app-debug.apk` |
| Copie racine | `CampusFlow-lite-debug.apk` |
| Version actuelle | `1.1.0` (versionCode 2) |

---

## Build Release (distribution)

Voir [ANDROID_SIGNING.md](./ANDROID_SIGNING.md).

```powershell
cd frontend\android
.\gradlew.bat assembleRelease
.\gradlew.bat bundleRelease
```

---

## Avec Android Studio (optionnel)

```powershell
cd frontend
npm run cap:sync
npm run cap:android
```

Puis **Build → Build Bundle(s) / APK(s)** dans Android Studio.

---

## Depannage reseau (telephone ne joint pas l'API)

### 1. IP Wi-Fi fixe (prioritaire pour l'APK)

Les scripts privilegient le **Wi-Fi** (`-DetectIp`). IP recommandee et fixe :

```text
10.94.13.27
```

Configurer l'IP statique sur le PC (PowerShell **administrateur**) :

```powershell
.\scripts\set-wifi-static-ip.ps1
```

Verifier :

```powershell
.\scripts\show-lan-ips.ps1
```

Mettez a jour `frontend/.env.apk`, puis rebuild :

```powershell
.\scripts\prepare-apk-env.ps1 -DetectIp
.\scripts\build-apk-cli.ps1 -DetectIp
```

### 2. Test navigateur sur le telephone

Ouvrez : `http://VOTRE_IP:8000/health`  
Reponse attendue : `{"status":"ok"}`

- Si ca echoue dans le navigateur, l'APK echouera aussi (pare-feu ou reseau).
- Si ca marche dans le navigateur mais pas dans l'APK, rebuild avec la bonne IP.

### 3. Pare-feu Windows (souvent la cause)

PowerShell **en administrateur** :

```powershell
cd "C:\Users\HP PROBOOK 450 G2\CampusFlow"
.\scripts\open-backend-firewall.ps1
```

### 4. Backend en mode LAN

```powershell
# depuis la racine CampusFlow
.\scripts\restart-backend.ps1 -Lan

# ou depuis backend/
cd backend
.\scripts\restart-backend.ps1 -Lan
```

Doit afficher `Uvicorn running on http://0.0.0.0:8000`.

### 5. Isolation client (reseau campus / box)

Certains reseaux empechent les appareils de se parler entre eux. Testez avec un **partage de connexion** du telephone vers le PC, ou un routeur domestique sans isolation AP.

---

## Depannage

| Probleme | Cause | Solution |
|----------|-------|----------|
| `restart-backend.ps1` introuvable | Mauvais repertoire courant | `cd` vers `CampusFlow` ou `CampusFlow\backend`, puis relancer ; voir section 4 |
| `sdkmanager.bat` introuvable | SDK non installe ou mauvais dossier | `.\scripts\install-android-sdk.ps1` — verifier `...\cmdline-tools\latest\bin\` |
| `Java non trouve` alors que Java est installe | Faux positif PowerShell (corrige) | Relancer `build-apk-cli.ps1` ; verifier `java -version` dans le terminal |
| `Unsupported class file major version 69` | Java 25 incompatible avec Gradle | `.\scripts\install-jdk21.ps1` puis rebuild |
| Erreur syntaxe PowerShell (`l'APK`, accents) | Here-strings / encodage | Scripts mis a jour — `git pull` ou scripts recents |
| API inaccessible sur telephone | IP, pare-feu ou isolation reseau | Voir section **Depannage reseau** ci-dessous |
| Ecran blanc au lancement | Assets non synchronises | `npm run cap:sync` puis rebuild APK |
| Carte vide hors ligne | Normal | Tuiles OSM necessitent le reseau |
| `-Sync` ignore | Parametre obsolete | Utiliser `-DetectIp` ou rien ; `-SkipSync` pour sauter le frontend |

---

## Resume — commandes

```powershell
cd "C:\Users\HP PROBOOK 450 G2\CampusFlow"
.\scripts\set-wifi-static-ip.ps1           # admin, une fois — IP Wi-Fi fixe
.\scripts\open-backend-firewall.ps1        # admin, une fois
.\scripts\install-jdk21.ps1                # si java -version = 25
.\scripts\install-android-sdk.ps1          # une fois
.\scripts\restart-backend.ps1 -Lan         # terminal 1
.\scripts\build-apk-cli.ps1 -DetectIp     # terminal 2 (Wi-Fi prioritaire)
```

Transferez `CampusFlow-lite-debug.apk` sur le telephone.
