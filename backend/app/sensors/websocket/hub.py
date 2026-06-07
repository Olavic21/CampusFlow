"""Hub WebSocket — diffusion occupancy temps réel (FastAPI, pas Django Channels)."""
import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("campusflow.sensors.ws")


class OccupancyHub:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clients.add(ws)
        logger.info("WebSocket client connecté — total=%d", len(self._clients))

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        await self.broadcast_batch([payload])

    async def broadcast_batch(self, payloads: list[dict[str, Any]]) -> None:
        if not payloads or not self._clients:
            return
        message = json.dumps({"type": "occupancy_update", "readings": payloads})
        dead: list[WebSocket] = []
        async with self._lock:
            clients = list(self._clients)
        for ws in clients:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)


occupancy_hub = OccupancyHub()
