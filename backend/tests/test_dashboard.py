def test_dashboard_stats(client, sample_locations, sample_flux, sample_feedbacks):
    response = client.get("/dashboard/stats?period=week")
    assert response.status_code == 200
    data = response.json()
    assert "top_locations" in data
    assert "peak_hours" in data
    assert "avg_congestion_by_day" in data
    assert "feedback_summary" in data
    assert "total_flux" in data
    assert isinstance(data["top_locations"], list)
    assert data["total_flux"] >= 0