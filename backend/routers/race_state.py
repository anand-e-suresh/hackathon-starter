"""
Race State Router
Provides real-time race state metrics for live dashboard polling.
"""

from typing import Dict, Any
from fastapi import APIRouter, status
from state_store import RaceStateStore

router = APIRouter(tags=["Race State"])


@router.get(
    "/race-state",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Get current race state for live polling",
    description="Returns current simulator standings, track progress, gaps, battery level, and flags."
)
def get_current_race_state() -> Dict[str, Any]:
    step = RaceStateStore.get_latest_step()
    sim = RaceStateStore.get_simulation()

    return {
        "status": "LIVE_RACE",
        "current_step": step.step,
        "total_steps": sim.total_steps,
        "lap": step.lap,
        "total_laps": sim.total_laps,
        "sector": step.sector,
        "track_progress_pct": step.track_distance_pct,
        "position": sim.ml_metrics.final_position,
        "speed_kmh": step.ml_speed,
        "battery_pct": step.ml_battery_pct,
        "gap_ahead_s": step.ml_gap_ahead,
        "deployment_budget_remaining_mj": step.ml_budget_remaining_mj,
        "active_recommendation": {
            "action": step.ml_decision.action.value,
            "confidence": step.ml_decision.confidence,
            "expected_cost_mj": step.ml_decision.expected_energy_cost,
            "reason": step.ml_decision.reason,
            "rule_compliant": step.ml_decision.rule_compliant
        },
        "overtake_in_progress": step.ml_overtake_successful,
        "flag": "GREEN"
    }
