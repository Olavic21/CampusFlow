from locust import HttpUser, task, between
import random

class CampusFlowUser(HttpUser):
    wait_time = between(1, 3)  # attente entre chaque requête

    # ── Tâches légères ──────────────────────────────────────────

    @task(3)
    def get_locations(self):
        self.client.get("/locations")

    @task(3)
    def get_flux_live(self):
        self.client.get("/flux/live")

    @task(2)
    def get_congestion(self):
        self.client.get("/congestion")

    @task(1)
    def get_path(self):
        from_id = random.randint(1, 17)
        to_id = random.randint(1, 17)
        while to_id == from_id:
            to_id = random.randint(1, 17)
        self.client.get(f"/path?from={from_id}&to={to_id}")

    # ── Tâche ML — la plus importante à tester ──────────────────

    @task(4)
    def predict_congestion(self):
        payload = {
            "location_id": random.randint(1, 17),
            "heure_du_jour": random.randint(7, 21),
            "jour_semaine": random.randint(0, 5),
            "activite_prevue": random.randint(0, 1),
            "flux_moyen_historique": round(random.uniform(0, 120), 2),
            "capacite": random.choice([15, 20, 30, 60, 120])
        }
        self.client.post("/predict", json=payload)