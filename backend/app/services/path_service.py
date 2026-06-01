import networkx as nx
from app.database.models import Location
from sqlalchemy.orm import Session
from math import radians, sin, cos, sqrt, atan2

# Pré-construction du graphe (campus)
def build_graph(db: Session):
    G = nx.Graph()
    locations = db.query(Location).filter(Location.is_active == True).all()
    for loc in locations:
        G.add_node(loc.id, lat=loc.latitude, lon=loc.longitude)
    # Arêtes simulées (distances en mètres)
    # En vrai, il faudrait une table "distances" ou calculer via routes
    # Pour la démo, on crée un graphe complet avec distances euclidiennes
    nodes = list(G.nodes(data=True))
    for i, (id1, data1) in enumerate(nodes):
        for id2, data2 in nodes[i+1:]:
            dist = haversine(data1["lat"], data1["lon"], data2["lat"], data2["lon"])
            G.add_edge(id1, id2, weight=dist)
    return G

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # mètres
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi/2)**2 + cos(phi1)*cos(phi2)*sin(dlambda/2)**2
    c = 2*atan2(sqrt(a), sqrt(1-a))
    return R * c

def find_path(db: Session, from_id: int, to_id: int, avoid_congestion: bool, congestion_service):
    G = build_graph(db)  # À optimiser avec cache
    if from_id not in G or to_id not in G:
        return None
        
    if avoid_congestion:
        # Modifier les poids selon congestion (ex: pénalité +50% si congestion élevée)
        congestion_data = congestion_service.get_congestion(db)
        cong_map = {c["location_id"]: c["level"] for c in congestion_data}
        for u, v, data in G.edges(data=True):
            penalty = 1.0
            if u in cong_map and cong_map[u] in ["high", "critical"]:
                penalty *= 1.5
            if v in cong_map and cong_map[v] in ["high", "critical"]:
                penalty *= 1.5
            data["weight"] = data["weight"] * penalty
    try:
        path_nodes = nx.shortest_path(G, source=from_id, target=to_id, weight="weight")
        total_dist = sum(G[u][v]["weight"] for u, v in zip(path_nodes, path_nodes[1:]))
        # Vitesse moyenne 1.33 m/s (4.8 km/h)
        estimated_time = int(total_dist / 1.33)
        waypoints = [{"lat": G.nodes[n]["lat"], "lng": G.nodes[n]["lon"]} for n in path_nodes]
        return {
            "path": path_nodes,
            "total_distance": round(total_dist, 1),
            "estimated_time": estimated_time,
            "waypoints": waypoints
        }
    except nx.NetworkXNoPath:
        return None