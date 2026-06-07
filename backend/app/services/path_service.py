"""
path_service.py — Itinéraires piétons le long des allées campus (Dijkstra).
Ne traverse pas les bâtiments : graphe = voies piétonnes + accès bâtiments.
"""
from __future__ import annotations

import heapq
from sqlalchemy.orm import Session

from app.database.models import Location
from app.services.campus_walkways import (
    build_pedestrian_graph,
    location_graph_key,
)

_graph_cache: tuple[int, int, dict, dict] | None = None


def _get_pedestrian_graph(db: Session) -> tuple[dict, dict]:
    """Cache le graphe piéton tant que le nombre / max id Location est stable."""
    global _graph_cache
    locations = db.query(Location).all()
    count = len(locations)
    max_id = max((loc.id for loc in locations), default=0)
    if _graph_cache and _graph_cache[0] == count and _graph_cache[1] == max_id:
        return _graph_cache[2], _graph_cache[3]
    graph, nodes = build_pedestrian_graph(locations)
    _graph_cache = (count, max_id, graph, nodes)
    return graph, nodes


def find_path(
    db: Session,
    from_id: int,
    to_id: int,
    avoid_congestion: bool,
    get_congestion,
) -> dict | None:
    graph, nodes = _get_pedestrian_graph(db)

    start_key = location_graph_key(from_id)
    end_key = location_graph_key(to_id)
    if start_key not in graph or end_key not in graph:
        return None

    cong_map: dict[int, str] = {}
    if avoid_congestion:
        congestion_data = get_congestion(db)
        cong_map = {c["location_id"]: c["level"] for c in congestion_data}

    def edge_weight(u: str, v: str, base_dist: float) -> float:
        weight = base_dist
        node_v = nodes.get(v, {})
        loc_id = node_v.get("location_id")
        if loc_id and cong_map.get(loc_id) in ("high", "critical"):
            weight *= 1.5
        return weight

    dist: dict[str, float] = {k: float("inf") for k in graph}
    prev: dict[str, str | None] = {k: None for k in graph}
    dist[start_key] = 0.0
    heap: list[tuple[float, str]] = [(0.0, start_key)]
    visited: set[str] = set()

    while heap:
        d_u, u = heapq.heappop(heap)
        if u in visited:
            continue
        if u == end_key:
            break
        visited.add(u)
        for edge in graph.get(u, []):
            v = edge["to"]
            if v in visited:
                continue
            w = edge_weight(u, v, edge["distance"])
            alt = d_u + w
            if alt < dist[v]:
                dist[v] = alt
                prev[v] = u
                heapq.heappush(heap, (alt, v))

    if prev[end_key] is None and end_key != start_key:
        return None

    node_path: list[str] = []
    cur: str | None = end_key
    while cur:
        node_path.insert(0, cur)
        cur = prev[cur]

    building_path = [
        nodes[n]["location_id"]
        for n in node_path
        if nodes.get(n, {}).get("type") == "building"
    ]
    if not building_path:
        building_path = [from_id, to_id]

    coords = [
        [nodes[n]["lat"], nodes[n]["lon"]]
        for n in node_path
        if n in nodes
    ]

    total_dist = dist[end_key]
    estimated_time = int(total_dist / 1.33)

    return {
        "path": building_path,
        "node_path": node_path,
        "total_distance": round(total_dist, 1),
        "estimated_time": estimated_time,
        "waypoints": [{"lat": c[0], "lng": c[1]} for c in coords],
        "coords": coords,
    }
