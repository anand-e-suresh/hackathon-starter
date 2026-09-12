"""
Integration tests for all REST API endpoints:
/health, /, /predict, /simulate, /telemetry, /race-state, /results.
"""

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_simulate_endpoint():
    payload = {
        "total_laps": 3,
        "steps_per_lap": 10,
        "initial_battery_pct": 65.0,
        "initial_gap_ahead": 1.2,
        "random_seed": 99
    }
    response = client.post("/simulate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["total_laps"] == 3
    assert data["total_steps"] == 30
    assert len(data["steps"]) == 30
    assert "ml_metrics" in data
    assert "baseline_metrics" in data
    assert "rule_violations_count" in data["ml_metrics"]
    assert "rule_violations_count" in data["baseline_metrics"]


def test_telemetry_endpoint():
    response = client.get("/telemetry")
    assert response.status_code == 200
    data = response.json()

    # Check that required F1 telemetry fields are present and typed correctly
    assert "speed" in data
    assert 0.0 <= data["speed"] <= 400.0
    assert "battery_level" in data
    assert 0.0 <= data["battery_level"] <= 100.0
    assert "deployment_budget_remaining_this_lap" in data
    assert 0.0 <= data["deployment_budget_remaining_this_lap"] <= 4.0
    assert "drs_available" in data
    assert "gap_ahead" in data


def test_race_state_endpoint():
    response = client.get("/race-state")
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "LIVE_RACE"
    assert "lap" in data
    assert "sector" in data
    assert "battery_pct" in data
    assert "active_recommendation" in data
    assert data["active_recommendation"]["action"] in ["OVERTAKE", "HOLD", "RECOVER"]


def test_results_endpoint():
    response = client.get("/results")
    assert response.status_code == 200
    data = response.json()

    assert "ml_strategy" in data
    assert "baseline_strategy" in data
    assert "comparison_summary" in data

    ml_strat = data["ml_strategy"]
    base_strat = data["baseline_strategy"]

    assert "total_overtakes" in ml_strat
    assert "rule_violations_count" in ml_strat
    assert "final_battery_pct" in ml_strat

    # ML should maintain compliance (0 or fewer violations than baseline)
    assert ml_strat["rule_violations_count"] <= base_strat["rule_violations_count"]
