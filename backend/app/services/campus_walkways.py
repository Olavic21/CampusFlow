"""
Réseau piéton SUP'PTIC — allées du campus (pas de traversée des bâtiments).
Coordonnées GPS projetées depuis le plan schématique officiel.
"""
from __future__ import annotations

import math
from typing import Any

# Segments d'allées principales (lat, lon)
WALKWAY_SEGMENTS: list[list[tuple[float, float]]] = [
    [(3.86855, 11.50715), (3.86905, 11.50755), (3.86935, 11.5080), (3.86955, 11.50835),
     (3.86975, 11.50865), (3.8700, 11.50885), (3.8702, 11.50905), (3.87032, 11.50925)],
    [(3.86855, 11.50715), (3.86855, 11.50755), (3.86865, 11.5080), (3.86885, 11.50835),
     (3.8691, 11.50865)],
    [(3.86975, 11.50865), (3.86995, 11.50895), (3.87015, 11.5092), (3.87032, 11.50945),
     (3.87035, 11.5097)],
    [(3.86905, 11.50755), (3.86945, 11.50755), (3.8700, 11.50775), (3.87032, 11.5097)],
]

JUNCTION_THRESHOLD_M = 22.0
BUILDING_ACCESS_MAX_M = 90.0


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _add_edge(graph: dict[str, list], edges: set, a: str, b: str, dist: float) -> None:
    key = tuple(sorted((a, b)))
    if key in edges:
        return
    edges.add(key)
    graph.setdefault(a, []).append({"to": b, "distance": dist})
    graph.setdefault(b, []).append({"to": a, "distance": dist})


def build_pedestrian_graph(locations: list[Any]) -> tuple[dict[str, list], dict[str, dict]]:
    """Graphe : waypoints + accès bâtiments (Location ORM)."""
    graph: dict[str, list] = {}
    nodes: dict[str, dict] = {}
    edges: set[tuple[str, str]] = set()
    wp_ids: list[str] = []

    wp_index = 0
    for seg_i, segment in enumerate(WALKWAY_SEGMENTS):
        prev_id = None
        for pt_i, (lat, lon) in enumerate(segment):
            wp_id = f"wp:{seg_i}:{pt_i}"
            wp_index += 1
            nodes[wp_id] = {"id": wp_id, "lat": lat, "lon": lon, "type": "waypoint"}
            graph.setdefault(wp_id, [])
            wp_ids.append(wp_id)
            if prev_id:
                prev = nodes[prev_id]
                d = haversine(prev["lat"], prev["lon"], lat, lon)
                _add_edge(graph, edges, prev_id, wp_id, d)
            prev_id = wp_id

    for i, a in enumerate(wp_ids):
        na = nodes[a]
        for b in wp_ids[i + 1 :]:
            nb = nodes[b]
            d = haversine(na["lat"], na["lon"], nb["lat"], nb["lon"])
            if d < JUNCTION_THRESHOLD_M:
                _add_edge(graph, edges, a, b, d)

    for loc in locations:
        lat = float(loc.latitude)
        lon = float(loc.longitude)
        key = f"geo:{loc.id}"
        nodes[key] = {
            "id": key,
            "lat": lat,
            "lon": lon,
            "type": "building",
            "location_id": loc.id,
            "name": loc.nom,
        }
        graph.setdefault(key, [])

        nearest_id = None
        nearest_d = float("inf")
        for wp_id in wp_ids:
            wp = nodes[wp_id]
            d = haversine(lat, lon, wp["lat"], wp["lon"])
            if d < nearest_d:
                nearest_d = d
                nearest_id = wp_id
        if nearest_id and nearest_d <= BUILDING_ACCESS_MAX_M:
            _add_edge(graph, edges, key, nearest_id, nearest_d)

    return graph, nodes


def location_graph_key(location_id: int) -> str:
    return f"geo:{location_id}"
