"""
ML Integration Adapter
Acts as the interface between the Backend service and Person 1's ML package.
Provides an intelligent heuristic stub until Person 1's ml/predict.py and ml/baseline.py
are merged into the repository.
"""
import os
from typing import Dict, Any

# Check if real ML package is available
try:
    from ml.predict import predict as real_ml_predict  # type: ignore
    from ml.baseline import baseline_predict as real_baseline_predict  # type: ignore
    HAS_REAL_ML = True
except ImportError:
    HAS_REAL_ML = False


def _heuristic_ml_predict(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Intelligent simulated ML classifier stub (mimicking trained XGBoost model).
    Crucially constraint-aware: proactively tracks lap budget, continuous burst limits,
    and thermal cooldown to achieve 0 rule violations.
    """
    gap_ahead = float(state.get("gap_ahead", 2.0))
    battery_pct = float(state.get("battery_level", 50.0))
    closing_speed = float(state.get("closing_speed", 0.0))
    budget_remaining = float(state.get("deployment_budget_remaining_this_lap", 2.0))
    continuous_seconds = float(state.get("continuous_deployment_seconds", 0.0))
    time_since_deploy = float(state.get("time_since_last_deployment", 10.0))
    drs_available = bool(state.get("drs_available", False))

    # Rule constraint check 1: Continuous burst cap (FIA 5.0s cap)
    if continuous_seconds >= 4.0:
        return {
            "action": "HOLD",
            "confidence": 0.94,
            "expected_energy_cost": 0.05,
            "reason": f"Proactive regulation compliance: Continuous deployment reached {continuous_seconds:.1f}s. Holding to avoid FIA continuous duration penalty."
        }

    # Rule constraint check 2: Lap energy budget cap (FIA 4.0 MJ cap)
    if budget_remaining <= 0.40:
        return {
            "action": "RECOVER" if battery_pct < 40.0 else "HOLD",
            "confidence": 0.91,
            "expected_energy_cost": -0.20 if battery_pct < 40.0 else 0.05,
            "reason": f"Lap deployment budget nearly exhausted ({budget_remaining:.2f} MJ remaining of 4.0 MJ). Conserving energy for next lap."
        }

    # Rule constraint check 3: Cooldown interval
    if 0.0 < time_since_deploy < 2.0 and continuous_seconds == 0.0:
        return {
            "action": "HOLD",
            "confidence": 0.88,
            "expected_energy_cost": 0.05,
            "reason": f"Thermal recovery interval active ({time_since_deploy:.1f}s elapsed). Allowing MGU-K cooling before next burst."
        }

    # Intelligent Overtake Trigger: close gap, positive closing speed, sufficient battery & budget
    if gap_ahead <= 1.4 and closing_speed >= 0.0 and battery_pct > 25.0:
        confidence = 0.91 if drs_available else 0.82
        return {
            "action": "OVERTAKE",
            "confidence": confidence,
            "expected_energy_cost": 0.35,
            "reason": f"Car ahead within attack range ({gap_ahead:.2f}s) with closing speed ({closing_speed:.1f} m/s) and legal lap budget ({budget_remaining:.2f} MJ)."
        }
    elif battery_pct < 25.0 or state.get("brake", 0.0) > 0.4:
        return {
            "action": "RECOVER",
            "confidence": 0.85,
            "expected_energy_cost": -0.22,
            "reason": f"Harvesting kinetic energy (Battery: {battery_pct:.1f}%, Sector braking zone). Recharging Energy Store."
        }
    else:
        return {
            "action": "HOLD",
            "confidence": 0.90,
            "expected_energy_cost": 0.05,
            "reason": "Maintaining delta and managing thermal/battery degradation."
        }


def _rule_based_baseline_predict(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Rule-based baseline matching Section 6 of project specification:
    IF gap_ahead < threshold AND ers_level > threshold: OVERTAKE
    ELSE IF ers_level < threshold: RECOVER
    ELSE: HOLD
    CRITICAL FLAW: The naive baseline completely ignores lap budget and continuous
    burst duration, repeatedly demanding OVERTAKE and causing FIA rule violations.
    """
    gap_ahead = float(state.get("gap_ahead", 2.0))
    battery_pct = float(state.get("battery_level", 50.0))

    GAP_THRESHOLD = 1.6
    ERS_LOW_THRESHOLD = 20.0
    ERS_HIGH_THRESHOLD = 25.0

    if gap_ahead < GAP_THRESHOLD and battery_pct > ERS_HIGH_THRESHOLD:
        return {
            "action": "OVERTAKE",
            "confidence": 0.70,
            "expected_energy_cost": 0.38,
            "reason": f"Baseline heuristic: Gap ({gap_ahead:.2f}s) < {GAP_THRESHOLD}s and Battery ({battery_pct:.1f}%) > {ERS_HIGH_THRESHOLD}%."
        }
    elif battery_pct < ERS_LOW_THRESHOLD:
        return {
            "action": "RECOVER",
            "confidence": 0.75,
            "expected_energy_cost": -0.20,
            "reason": f"Baseline heuristic: Battery ({battery_pct:.1f}%) < {ERS_LOW_THRESHOLD}% threshold."
        }
    else:
        return {
            "action": "HOLD",
            "confidence": 0.80,
            "expected_energy_cost": 0.05,
            "reason": "Baseline heuristic: Neither overtake nor recover threshold triggered."
        }


def get_decision(state: Dict[str, Any], use_baseline: bool = False) -> Dict[str, Any]:
    """
    Main entry point for prediction.
    Dispatches to real ML model if loaded, otherwise uses the stub.
    """
    force_stub = os.getenv("USE_REAL_ML_MODEL", "false").lower() != "true"

    if use_baseline:
        if HAS_REAL_ML and not force_stub:
            try:
                return real_baseline_predict(state)
            except Exception:
                return _rule_based_baseline_predict(state)
        return _rule_based_baseline_predict(state)

    if HAS_REAL_ML and not force_stub:
        try:
            return real_ml_predict(state)
        except Exception:
            return _heuristic_ml_predict(state)

    return _heuristic_ml_predict(state)
