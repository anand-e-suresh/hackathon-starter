"""
Predict Router
Exposes the real-time energy deployment decision endpoint.
Supports both ML strategy recommendations and naive baseline evaluation.
"""

import time
from fastapi import APIRouter, Query, status
from schemas import TelemetryState, DecisionResponse, ActionType
from ml_adapter import get_decision

router = APIRouter(tags=["Decision Engine"])


@router.post(
    "/predict",
    response_model=DecisionResponse,
    status_code=status.HTTP_200_OK,
    summary="Recommend optimal energy deployment mode",
    description=(
        "Evaluates the current F1 race state and recommends an energy deployment action "
        "(OVERTAKE, HOLD, or RECOVER) with confidence, expected energy cost, and an "
        "explainable rationale. Supports comparing against the naive rule-based baseline via ?use_baseline=true."
    )
)
def predict_energy_action(
    state: TelemetryState,
    use_baseline: bool = Query(
        False,
        description="If True, evaluates with the naive rule-based baseline instead of ML strategy"
    )
) -> DecisionResponse:
    # Measure execution time to guarantee < 50ms latency
    start_time = time.perf_counter()

    state_dict = state.model_dump()
    raw_decision = get_decision(state_dict, use_baseline=use_baseline)

    latency_ms = (time.perf_counter() - start_time) * 1000.0

    return DecisionResponse(
        action=ActionType(raw_decision["action"]),
        confidence=float(raw_decision["confidence"]),
        expected_energy_cost=float(raw_decision["expected_energy_cost"]),
        reason=str(raw_decision["reason"]),
        rule_compliant=bool(raw_decision.get("rule_compliant", True)),
        violation_reason=raw_decision.get("violation_reason"),
        enforced_action=ActionType(raw_decision["enforced_action"]) if raw_decision.get("enforced_action") else None
    )
