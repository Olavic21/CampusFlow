"""
redis_client.py — Client Redis avec fallback gracieux.

Si Redis est indisponible (ex: env de dev sans Redis), toutes les opérations
dégradent silencieusement en no-op plutôt que de crasher l'API.
"""
import redis
from app.config import settings


class _FallbackRedis:
    """Stub Redis retournant None/[] sur toutes les opérations."""

    def get(self, key):
        return None

    def setex(self, key, time, value):
        return None

    def keys(self, pattern="*"):
        return []

    def delete(self, *keys):
        return 0

    def ping(self):
        raise ConnectionError("Redis non disponible (fallback actif)")


def _make_client():
    try:
        client = redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        client.ping()
        return client
    except Exception:
        # Redis absent → fallback silencieux
        return _FallbackRedis()


redis_client = _make_client()
