"""
Results Router
Returns aggregated race strategy evaluation metrics comparing ML Strategy vs Baseline.
"""

from typing import Dict, Any
from fastapi import APIRouter, status
from schemas import StrategyMetrics
from state_store import RaceStateStore

router = APIRouter(tags=["Results & Metrics"])


@router.get(
    "/results",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Get aggregated strategy comparison results",
    description=(
        "Returns the final scorecard comparing the ML Optimizer against the Rule-Based Baseline: "
        "total overtakes, positions gained, avg lap times, final battery SoC, energy efficiency, "
        "and FIA rule compliance violations count."
    )
)
def get_simulation_results() -> Dict[str, Any]:
    sim = RaceStateStore.get_simulation()

    return {
        "scenario_seed": sim.scenario_seed,
        "total_laps": sim.total_laps,
        "total_steps": sim.total_steps,
        "ml_strategy": sim.ml_metrics.model_dump(),
        "baseline_strategy": sim.baseline_metrics.model_dump(),
        "comparison_summary": sim.comparison_summary
    }
