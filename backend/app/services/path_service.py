"""
path_service.py — Calcul de chemin optimal entre deux salles (Dijkstra / Haversine).
Graphe piéton : arêtes uniquement si distance < 120 m (aligné frontend SUP'PTIC).
"""
import networkx as nx
from sqlalchemy.orm import Session
from math import radians, sin, cos, sqrt, atan2

from app.database.models import Location

MAX_EDGE_DIST = 120  # mètres — allées piétonnes campus SUP'PTIC


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance en mètres entre deux points GPS (formule Haversine)."""
    R = 6_371_000
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi    = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def build_graph(db: Session) -> nx.Graph:
    """Graphe piéton : nœuds = bâtiments, arêtes si distance Haversine < 120 m."""
    G = nx.Graph()
    locations = db.query(Location).all()

    for loc in locations:
        G.add_node(loc.id, lat=float(loc.latitude), lon=float(loc.longitude), name=loc.nom)

    nodes = list(G.nodes(data=True))
    for i, (id1, d1) in enumerate(nodes):
        for id2, d2 in nodes[i + 1:]:
            dist = haversine(d1["lat"], d1["lon"], d2["lat"], d2["lon"])
            if dist < MAX_EDGE_DIST:
                G.add_edge(id1, id2, weight=dist)

    return G


def find_path(
    db: Session,
    from_id: int,
    to_id: int,
    avoid_congestion: bool,
    get_congestion,          # callable : get_congestion(db) → list[dict]
) -> dict | None:
    """
    Trouve le chemin le plus court (Dijkstra) entre deux salles.

    Si avoid_congestion=True, les arêtes passant par des salles
    à congestion high/critical reçoivent une pénalité ×1.5.
    """
    G = build_graph(db)

    if from_id not in G or to_id not in G:
        return None

    if avoid_congestion:
        congestion_data = get_congestion(db)          # ← appel correct (fonction, pas module)
        cong_map = {c["location_id"]: c["level"] for c in congestion_data}
        for u, v, data in G.edges(data=True):
            penalty = 1.0
            if cong_map.get(u) in ("high", "critical"):
                penalty *= 1.5
            if cong_map.get(v) in ("high", "critical"):
                penalty *= 1.5
            data["weight"] = data["weight"] * penalty

    try:
        path_nodes = nx.shortest_path(G, source=from_id, target=to_id, weight="weight")
    except nx.NetworkXNoPath:
        return None

    total_dist = sum(G[u][v]["weight"] for u, v in zip(path_nodes, path_nodes[1:]))
    estimated_time = int(total_dist / 1.33)           # 1.33 m/s ≈ 4.8 km/h
    waypoints = [
        {"lat": G.nodes[n]["lat"], "lng": G.nodes[n]["lon"]}
        for n in path_nodes
    ]

    return {
        "path":            path_nodes,
        "total_distance":  round(total_dist, 1),
        "estimated_time":  estimated_time,
        "waypoints":       waypoints,
    }
