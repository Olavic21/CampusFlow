"""
redis_client.py — Client Redis avec fallback gracieux et timeouts courts.

Évite de bloquer l'API si Redis est lent ou injoignable (cause fréquente de timeout global).
"""
import redis
from app.config import settings

_REDIS_TIMEOUT_SEC = 2


class _FallbackRedis:
    """Stub Redis — toutes les opérations retournent immédiatement."""

    def get(self, key):
        return None

    def setex(self, key, time, value):
        return None

    def keys(self, pattern="*"):
        return []

    def scan_iter(self, match=None, count=None):
        return iter([])

    def delete(self, *keys):
        return 0

    def ping(self):
        raise ConnectionError("Redis non disponible (fallback actif)")


def _make_client():
    try:
        client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=_REDIS_TIMEOUT_SEC,
            socket_timeout=_REDIS_TIMEOUT_SEC,
        )
        client.ping()
        return client
    except Exception:
        return _FallbackRedis()


redis_client = _make_client()
