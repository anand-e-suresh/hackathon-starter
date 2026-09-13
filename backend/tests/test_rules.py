"""Unit tests for FIA Technical Rule Compliance Engine (backend/rules.py)."""
from schemas import ActionType
from rules import check_compliance, MAX_DEPLOYMENT_PER_LAP_MJ, MAX_CONTINUOUS_DEPLOYMENT_SECONDS


def test_hold_and_recover_always_compliant():
    state = {
        "deployment_budget_remaining_this_lap": 0.0,
        "continuous_deployment_seconds": 10.0,
        "time_since_last_deployment": 0.0
    }
    # HOLD and RECOVER never violate deployment limits
    result_hold = check_compliance(state, ActionType.HOLD, 0.05)
    assert result_hold.allowed is True

    result_rec = check_compliance(state, ActionType.RECOVER, 0.0)
    assert result_rec.allowed is True


def test_lap_budget_exceeded_violation():
    # Only 0.1 MJ remaining in budget, but OVERTAKE requires 0.35 MJ
    state = {
        "deployment_budget_remaining_this_lap": 0.10,
        "continuous_deployment_seconds": 0.0,
        "time_since_last_deployment": 10.0
    }
    result = check_compliance(state, ActionType.OVERTAKE, estimated_cost_mj=0.35)
    assert result.allowed is False
    assert "Lap deployment limit reached" in result.violation_reason
    assert result.capped_action == ActionType.HOLD


def test_continuous_deployment_duration_violation():
    # Already deployed for 6.0 seconds (> 5.0s cap)
    state = {
        "deployment_budget_remaining_this_lap": 3.0,
        "continuous_deployment_seconds": 6.0,
        "time_since_last_deployment": 0.0
    }
    result = check_compliance(state, ActionType.OVERTAKE, estimated_cost_mj=0.35)
    assert result.allowed is False
    assert "Max continuous deployment exceeded" in result.violation_reason
    assert result.capped_action == ActionType.HOLD


def test_compliant_overtake():
    state = {
        "deployment_budget_remaining_this_lap": 3.5,
        "continuous_deployment_seconds": 0.0,
        "time_since_last_deployment": 12.0
    }
    result = check_compliance(state, ActionType.OVERTAKE, estimated_cost_mj=0.35)
    assert result.allowed is True
    assert result.violation_reason is None
    assert result.remaining_lap_budget_mj == pytest.approx(3.15, 0.01)


import pytest
