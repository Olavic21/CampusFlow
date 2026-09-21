"""P0-4 — Qualification de fraîcheur des données (data_quality)."""
from datetime import datetime, timedelta, timezone

from app.services.data_quality import age_seconds, freshness, is_stale


def test_is_stale_recent():
    now = datetime.now(timezone.utc)
    assert is_stale(now - timedelta(seconds=10), now) is False


def test_is_stale_old():
    now = datetime.now(timezone.utc)
    assert is_stale(now - timedelta(seconds=500), now) is True


def test_is_stale_none():
    assert is_stale(None) is True


def test_age_naive_treated_as_utc():
    now = datetime.now(timezone.utc)
    naive = (now - timedelta(seconds=30)).replace(tzinfo=None)
    assert 25 <= age_seconds(naive, now) <= 35


def test_freshness_labels():
    now = datetime.now(timezone.utc)
    assert freshness(None) == "unknown"
    assert freshness(now - timedelta(seconds=1), now) == "fresh"
    assert freshness(now - timedelta(seconds=999), now) == "stale"