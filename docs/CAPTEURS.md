# Raccordement des capteurs a CampusFlow

Ce guide explique comment relier un compteur, une camera, un capteur RFID ou un capteur infrarouge a CampusFlow, et comment une mesure arrive jusqu'a la carte.

## 1. Fonctionnement general

```text
Capteur physique
    |
    | HTTP authentifie ou MQTT
    v
CampusFlow / FastAPI
    |
    +-- sensor_readings : historique des mesures
    +-- flux            : serie utilisee par les graphiques et la congestion
    +-- sensors         : statut, source, dernier contact
    |
    +--> WebSocket /ws/live-occupancy/
             |
             v
       Frontend : carte, couleurs, fiche batiment, dashboard IoT
```

Pour chaque mesure, le backend :

1. verifie le `building_id` (le `location_id` du batiment) ;
2. rattache eventuellement la mesure a un `sensor_id` ;
3. enregistre la mesure dans `sensor_readings` ;
4. cree le flux correspondant dans `flux` ;
5. met a jour `last_seen` et le statut du capteur ;
6. diffuse la mesure aux clients WebSocket connectes.

Le frontend n'interroge jamais directement un capteur. Il lit CampusFlow via l'API et le WebSocket.

## 2. Identifier le batiment et le capteur

Un capteur doit etre rattache a un batiment existant. L'identifiant attendu dans les mesures est l'ID numerique du batiment, appele `location_id` dans la base et `building_id` dans les messages.

Lister les batiments :

```bash
curl http://localhost:8000/locations
```

En production, remplacer l'URL par `https://<API_DOMAIN>`.

Un membre `staff` ou `admin` enregistre ensuite le capteur :

```bash
curl -X POST http://localhost:8000/sensors \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ESP-AMPHI-01",
    "location_id": 1,
    "sensor_type": "counter",
    "source": "mqtt",
    "mark_online": true
  }'
```

Types acceptes par la plateforme : `counter`, `camera`, `rfid`, `infrared`. La reponse contient l'`id` du capteur. Cet ID est facultatif dans un message MQTT, mais il permet un suivi precis dans le dashboard.

## 3. Option A : raccordement MQTT recommande pour l'IoT

Cette option convient a un ESP32, un Raspberry Pi ou une passerelle locale.

### Configuration du backend

Dans `backend/.env` :

```dotenv
SENSOR_MODE=mqtt
MQTT_BROKER_URL=mqtt://127.0.0.1:1883
MQTT_TOPIC=campusflow/occupancy/#
```

Le broker peut etre local ou distant. En production, il est recommande de le garder sur le reseau prive et de proteger MQTT par TLS et authentification. Le client actuel accepte une URL `mqtt://hote:port`.

Le paquet MQTT doit etre installe :

```bash
pip install paho-mqtt
```

Redemarrer ensuite le backend. Au demarrage, les logs doivent indiquer que MQTT est connecte.

### Topic et payload

Le capteur publie du JSON sur un topic correspondant a `MQTT_TOPIC`, par exemple :

```text
campusflow/occupancy/1
```

Payload minimal :

```json
{
  "building_id": 1,
  "occupancy": 42
}
```

Payload recommande :

```json
{
  "building_id": 1,
  "sensor_id": 7,
  "occupancy": 42,
  "confidence_score": 0.96
}
```

Contraintes :

| Champ | Type | Obligatoire | Description |
|---|---:|:---:|---|
| `building_id` | entier | oui | ID du batiment (`location_id`) |
| `occupancy` | entier >= 0 | oui | Nombre de personnes mesurees |
| `sensor_id` | entier | non | ID retourne par `POST /sensors` |
| `confidence_score` | nombre 0..1 | non | Confiance de la mesure, 1 par defaut |

Le timestamp est genere par le backend a la reception du message. Une mesure invalide est rejetee et journalisee sans interrompre le listener MQTT.

### Exemple Python de publication

```python
import json
import time
import paho.mqtt.client as mqtt

client = mqtt.Client()
client.connect("127.0.0.1", 1883, 60)
client.loop_start()

while True:
    message = {
        "building_id": 1,
        "sensor_id": 7,
        "occupancy": 42,
        "confidence_score": 0.96,
    }
    client.publish(
        "campusflow/occupancy/1",
        json.dumps(message),
        qos=1,
        retain=False,
    )
    time.sleep(10)
```

## 4. Option B : injection HTTP

Cette option convient a une passerelle qui envoie les mesures au backend au lieu de publier sur MQTT. L'endpoint actuel est protege par un compte `staff` ou `admin`.

```bash
curl -X POST http://localhost:8000/sensors/test-data \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "building_id": 1,
    "sensor_id": 7,
    "occupancy": 42,
    "confidence_score": 0.96,
    "timestamp": "2026-09-22T12:30:00Z"
  }'
```

Le nom `test-data` est historique : l'endpoint utilise le meme pipeline d'ingestion que les donnees capteurs et sert a l'integration HTTP. Il ne doit pas etre expose sans authentification ou sans une passerelle de securite.

Reponse attendue :

```json
{
  "ok": true,
  "reading": {
    "building_id": 1,
    "occupancy": 42,
    "timestamp": "2026-09-22T12:30:00+00:00",
    "source": "api",
    "confidence_score": 0.96
  }
}
```

## 5. Modes de fonctionnement

Configurer `SENSOR_MODE` dans `backend/.env` :

| Mode | Usage | Source principale |
|---|---|---|
| `simulation` | demonstration ou developpement | generateur interne / `capteurs.json` |
| `api` | mesures injectees par HTTP | lectures enregistrees en base |
| `mqtt` | capteurs physiques MQTT | broker MQTT |
| `websocket` | diffusion temps reel cote application | hub WebSocket |
| `hybrid` | coexistence de plusieurs sources | selon les providers actifs |

Pour le frontend web, `VITE_SENSOR_MODE=api` ou `websocket` active la lecture des donnees backend. Le mode demo du frontend utilise volontairement `data/raw/capteurs.json` et ne represente pas un capteur physique.

## 6. Ce que voit le frontend

- `GET /flux/live?window=10` fournit l'occupation recente par batiment.
- `GET /flux/history/{location_id}` fournit l'historique affiche dans la fiche.
- `/ws/live-occupancy/` envoie un snapshot a la connexion puis les mises a jour.
- Les couleurs sont calculees a partir du taux `occupancy / capacite` :
  - jusqu'a 40 % : vert, disponible ;
  - 40 a 70 % : orange, modere ;
  - 70 a 90 % : rouge, charge ;
  - au-dela de 90 % : violet, sature.

Une mesure sans lecture recente est marquee inconnue ou ancienne, plutot que transformee en faux zero.

## 7. Statut et diagnostic

Verifier le mode et le dashboard :

```bash
curl http://localhost:8000/sensors/mode
curl http://localhost:8000/sensors/status
curl http://localhost:8000/sensors
curl "http://localhost:8000/flux/live?window=10"
```

Points a verifier lorsqu'un capteur n'apparait pas :

1. le `building_id` existe dans `GET /locations` ;
2. le `sensor_id` appartient bien a ce batiment ;
3. `SENSOR_MODE` correspond au transport choisi ;
4. le topic MQTT correspond a `MQTT_TOPIC` ;
5. le payload contient un entier `occupancy` et un `building_id` numerique ;
6. `last_seen` est recent et le capteur n'est pas muet depuis plus de `SENSOR_HEARTBEAT_OFFLINE_SEC` secondes ;
7. le frontend utilise la bonne URL API et la WebSocket `/ws/live-occupancy/`.

Logs utiles :

```bash
# Developpement
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Production
journalctl -u campusflow-api -f
```

## 8. Securite et exploitation

- Ne jamais ouvrir PostgreSQL, Redis, MQTT ou Uvicorn directement sur Internet.
- Utiliser HTTPS pour l'API publique et WSS pour le WebSocket.
- Utiliser un compte `staff` ou `admin` pour enregistrer les capteurs et injecter par HTTP.
- Ne pas utiliser `retain=true` pour une mesure d'occupation ponctuelle, afin d'eviter de rejouer une vieille valeur au redemarrage.
- Utiliser `qos=1` si la perte d'une mesure est problematique, tout en gardant un timestamp de reception cote backend.
- Le backend conserve les lectures selon `RETENTION_DAYS` (90 jours par defaut).
