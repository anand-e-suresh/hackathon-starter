"""Unit tests for Pydantic schemas in backend/schemas.py"""
import pytest
from schemas import (
    ActionType,
    TelemetryState,
    DecisionResponse,
    RuleCheckResult,
    SimulateRequest,
    StrategyMetrics
)


def test_telemetry_state_valid():
    state = TelemetryState(
        speed=310.5,
        throttle=1.0,
        brake=0.0,
        gear=8,
        drs_available=True,
        drs_active=True,
        battery_level=60.0,
        energy_deployment=0.4,
        energy_recovery=0.0,
        gap_ahead=0.8,
        gap_behind=3.0,
        lap=5,
        sector=1,
        lap_time=25.4,
        closing_speed=3.2,
        deployment_budget_remaining_this_lap=3.1,
        continuous_deployment_seconds=1.0,
        time_since_last_deployment=5.0
    )
    assert state.speed == 310.5
    assert state.gear == 8
    assert state.deployment_budget_remaining_this_lap == 3.1


def test_decision_response_valid():
    decision = DecisionResponse(
        action=ActionType.OVERTAKE,
        confidence=0.89,
        expected_energy_cost=0.35,
        reason="Car ahead within attack range with DRS enabled."
    )
    assert decision.action == ActionType.OVERTAKE
    assert decision.confidence == 0.89
    assert decision.rule_compliant is True


def test_strategy_metrics():
    metrics = StrategyMetrics(
        strategy_name="ML-XGBoost",
        total_overtakes=3,
        positions_gained=2,
        final_position=1,
        average_lap_time_s=88.4,
        total_race_time_s=442.0,
        final_battery_pct=45.2,
        total_energy_deployed_mj=16.8,
        total_energy_recovered_mj=8.2,
        energy_efficiency_score=1.85,
        rule_violations_count=0
    )
    assert metrics.total_overtakes == 3
    assert metrics.rule_violations_count == 0
