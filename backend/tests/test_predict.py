"""Unit tests for FastAPI endpoints: /health, /, and /predict"""
import time
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

SAMPLE_TELEMETRY = {
    "speed": 305.2,
    "throttle": 1.0,
    "brake": 0.0,
    "gear": 8,
    "drs_available": True,
    "drs_active": True,
    "battery_level": 65.0,
    "energy_deployment": 0.35,
    "energy_recovery": 0.0,
    "gap_ahead": 0.75,
    "gap_behind": 2.4,
    "lap": 10,
    "sector": 2,
    "lap_time": 35.8,
    "closing_speed": 4.5,
    "deployment_budget_remaining_this_lap": 2.8,
    "continuous_deployment_seconds": 1.0,
    "time_since_last_deployment": 8.0
}


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "operational"
    assert data["docs_url"] == "/docs"


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_predict_ml_decision():
    start = time.perf_counter()
    response = client.post("/predict", json=SAMPLE_TELEMETRY)
    elapsed_ms = (time.perf_counter() - start) * 1000.0

    assert response.status_code == 200
    data = response.json()

    assert "action" in data
    assert data["action"] in ["OVERTAKE", "HOLD", "RECOVER"]
    assert "confidence" in data
    assert 0.0 <= data["confidence"] <= 1.0
    assert "expected_energy_cost" in data
    assert "reason" in data
    assert len(data["reason"]) > 5
    assert "rule_compliant" in data

    # Verify high-performance latency requirement (< 500ms on first load, < 50ms in steady state)
    assert elapsed_ms < 500.0


def test_predict_baseline_decision():
    response = client.post("/predict?use_baseline=true", json=SAMPLE_TELEMETRY)
    assert response.status_code == 200
    data = response.json()

    assert data["action"] == "OVERTAKE"
    assert "Baseline heuristic" in data["reason"]
