# Signature Android — CampusFlow Lite

## Keystore (une seule fois)

```bash
keytool -genkey -v -keystore campusflow-release.keystore \
  -alias campusflow -keyalg RSA -keysize 2048 -validity 10000
```

Conservez le keystore et les mots de passe en lieu sûr. **Ne commitez jamais le keystore.**

## Configuration Gradle

Créez `frontend/android/keystore.properties` (gitignored) :

```properties
storeFile=../../campusflow-release.keystore
storePassword=VOTRE_MOT_DE_PASSE
keyAlias=campusflow
keyPassword=VOTRE_MOT_DE_PASSE
```

Dans `frontend/android/app/build.gradle`, section `signingConfigs` :

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

## Build signé

```bash
cd frontend/android
./gradlew assembleRelease
./gradlew bundleRelease
```

## Play Store

Utilisez `app-release.aab` pour Google Play Console.

Pour distribution directe (APK), utilisez `app-release.apk`.
