"""Cache mémoire TTL pour données peu volatiles (dev / petite charge)."""
import time
from functools import wraps
from typing import Any, Callable, Optional

_store: dict[str, tuple[float, Any]] = {}


def cache_get(key: str) -> Optional[Any]:
    entry = _store.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if time.time() > expires_at:
        del _store[key]
        return None
    return value


def cache_set(key: str, value: Any, ttl_seconds: int = 60) -> None:
    _store[key] = (time.time() + ttl_seconds, value)


def cached(ttl_seconds: int = 60, key_fn: Optional[Callable] = None):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            key = key_fn(*args, **kwargs) if key_fn else f"{fn.__name__}:{args}:{kwargs}"
            hit = cache_get(key)
            if hit is not None:
                return hit
            result = fn(*args, **kwargs)
            cache_set(key, result, ttl_seconds)
            return result

        return wrapper

    return decorator


def invalidate_prefix(prefix: str) -> None:
    for key in list(_store.keys()):
        if key.startswith(prefix):
            del _store[key]
