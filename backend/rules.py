"""
FIA-Style Technical Rule Compliance Engine
Enforces electrical deployment regulations modeled after FIA Formula 1 Article 5.

Regulations Enforced (Simplified Engineering Abstraction):
1. MAX_DEPLOYMENT_PER_LAP_MJ: 4.0 MJ per lap maximum deployment from ES to MGU-K.
2. MAX_CONTINUOUS_DEPLOYMENT_SECONDS: Maximum continuous high-power deployment burst duration.
3. MIN_RECOVERY_COOLDOWN_SECONDS: Mandatory minimum interval between deployment bursts.
"""

import os
from typing import Dict, Any, Optional
from backend.schemas import ActionType, RuleCheckResult

# Configurable regulatory limits
MAX_DEPLOYMENT_PER_LAP_MJ: float = float(os.getenv("MAX_DEPLOYMENT_PER_LAP_MJ", "4.0"))
MAX_CONTINUOUS_DEPLOYMENT_SECONDS: float = float(os.getenv("MAX_CONTINUOUS_DEPLOYMENT_SECONDS", "5.0"))
MIN_RECOVERY_COOLDOWN_SECONDS: float = float(os.getenv("MIN_RECOVERY_COOLDOWN_SECONDS", "2.0"))


def check_compliance(
    state: Dict[str, Any],
    proposed_action: ActionType,
    estimated_cost_mj: float
) -> RuleCheckResult:
    """
    Validates whether the recommended action complies with FIA Technical Regulations.

    Args:
        state: Current telemetry and engineered state dictionary
        proposed_action: The action recommended by ML or Baseline (OVERTAKE, HOLD, RECOVER)
        estimated_cost_mj: Energy expected to be deployed during this step

    Returns:
        RuleCheckResult containing compliance status, violation reason, and capped action.
    """
    remaining_budget = float(state.get("deployment_budget_remaining_this_lap", MAX_DEPLOYMENT_PER_LAP_MJ))
    continuous_seconds = float(state.get("continuous_deployment_seconds", 0.0))
    time_since_deployment = float(state.get("time_since_last_deployment", 10.0))

    # If action is HOLD or RECOVER, it never breaches deployment limits
    if proposed_action != ActionType.OVERTAKE:
        return RuleCheckResult(
            allowed=True,
            violation_reason=None,
            capped_action=None,
            remaining_lap_budget_mj=round(remaining_budget, 3)
        )

    # Constraint 1: Maximum Energy Deployable Per Lap (FIA 4.0 MJ / lap cap)
    if remaining_budget <= 0.01 or estimated_cost_mj > remaining_budget:
        return RuleCheckResult(
            allowed=False,
            violation_reason=(
                f"FIA Regulation Breach: Lap deployment limit reached (remaining budget: {remaining_budget:.2f} MJ, "
                f"requested: {estimated_cost_mj:.2f} MJ). Capping to HOLD."
            ),
            capped_action=ActionType.HOLD,
            remaining_lap_budget_mj=round(remaining_budget, 3)
        )

    # Constraint 2: Maximum Continuous Deployment Burst
    if continuous_seconds >= MAX_CONTINUOUS_DEPLOYMENT_SECONDS:
        return RuleCheckResult(
            allowed=False,
            violation_reason=(
                f"FIA Regulation Breach: Max continuous deployment exceeded ({continuous_seconds:.1f}s >= "
                f"{MAX_CONTINUOUS_DEPLOYMENT_SECONDS:.1f}s cap). Mandatory cooldown required."
            ),
            capped_action=ActionType.HOLD,
            remaining_lap_budget_mj=round(remaining_budget, 3)
        )

    # Constraint 3: Minimum Recovery Cooldown Interval
    # If the car just finished a burst and hasn't waited the minimum interval
    if 0.0 < time_since_deployment < MIN_RECOVERY_COOLDOWN_SECONDS and continuous_seconds == 0.0:
        return RuleCheckResult(
            allowed=False,
            violation_reason=(
                f"Thermal Recovery Limit: Cooldown interval insufficient ({time_since_deployment:.1f}s < "
                f"{MIN_RECOVERY_COOLDOWN_SECONDS:.1f}s). Capping to HOLD."
            ),
            capped_action=ActionType.HOLD,
            remaining_lap_budget_mj=round(remaining_budget, 3)
        )

    # All checks passed
    return RuleCheckResult(
        allowed=True,
        violation_reason=None,
        capped_action=None,
        remaining_lap_budget_mj=round(remaining_budget - estimated_cost_mj, 3)
    )
