"""Unit tests for F1 Race Simulator (backend/simulator.py)."""
from backend.schemas import SimulateRequest
from backend.simulator import RaceSimulator


def test_race_simulator_run_basic():
    request = SimulateRequest(
        total_laps=3,
        steps_per_lap=15,
        initial_battery_pct=75.0,
        initial_gap_ahead=1.4,
        random_seed=42
    )
    simulator = RaceSimulator(request)
    response = simulator.run()

    assert response.total_steps == 45
    assert response.total_laps == 3
    assert len(response.steps) == 45

    # Check metrics
    assert response.ml_metrics is not None
    assert response.baseline_metrics is not None

    # Verify battery percentages are strictly within valid physical bounds
    assert 0.0 <= response.ml_metrics.final_battery_pct <= 100.0
    assert 0.0 <= response.baseline_metrics.final_battery_pct <= 100.0

    # Verify rule violation tracking (Baseline should breach rules more frequently due to naive deployment)
    assert response.ml_metrics.rule_violations_count <= response.baseline_metrics.rule_violations_count

    # Check first and last step records
    first_step = response.steps[0]
    assert first_step.step == 1
    assert first_step.lap == 1
    assert first_step.sector == 1
    assert first_step.ml_decision.action in ["OVERTAKE", "HOLD", "RECOVER"]
    assert first_step.baseline_decision.action in ["OVERTAKE", "HOLD", "RECOVER"]


def test_race_simulator_50_steps():
    # As specified in Step 4 done criteria: simulator.run(n_steps=50) produces full log without crashing
    request = SimulateRequest(
        total_laps=5,
        steps_per_lap=10,
        initial_battery_pct=65.0,
        initial_gap_ahead=1.0,
        random_seed=123
    )
    simulator = RaceSimulator(request)
    response = simulator.run()

    assert response.total_steps == 50
    assert len(response.steps) == 50
    assert "Simulation finished" in response.comparison_summary
