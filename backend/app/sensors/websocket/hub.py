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
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Enregistre la boucle principale — permet la diffusion depuis un thread (MQTT)."""
        self._loop = loop

    def broadcast_threadsafe(self, payload: dict[str, Any]) -> None:
        """Diffusion depuis un thread non-asyncio (callback paho-mqtt)."""
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        try:
            asyncio.run_coroutine_threadsafe(self.broadcast(payload), loop)
        except RuntimeError:
            pass

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
