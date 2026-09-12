"""
Telemetry Router
Provides real-time synthetic F1 telemetry snapshots for dashboard gauges and charts.
"""

from fastapi import APIRouter, status
from backend.schemas import TelemetryState
from backend.state_store import RaceStateStore

router = APIRouter(tags=["Telemetry"])


@router.get(
    "/telemetry",
    response_model=TelemetryState,
    status_code=status.HTTP_200_OK,
    summary="Get current/latest telemetry snapshot",
    description="Returns the latest synthetic telemetry frame (speed, throttle, brake, gear, DRS, battery %, gaps, lap, budget)."
)
def get_current_telemetry() -> TelemetryState:
    # Advance to provide realistic streaming telemetry when polled
    step = RaceStateStore.advance_step()

    # Determine throttle and brake from sector and mode
    throttle = 1.0 if step.sector == 1 else (0.50 if step.sector == 2 else 0.88)
    brake = 0.65 if step.sector == 2 else (0.15 if step.sector == 3 else 0.0)
    gear = 8 if step.sector == 1 else (4 if step.sector == 2 else 6)
    drs_avail = step.sector == 1 and step.ml_gap_ahead < 1.0
    drs_active = drs_avail and throttle > 0.9

    return TelemetryState(
        speed=step.ml_speed,
        throttle=throttle,
        brake=brake,
        gear=gear,
        drs_available=drs_avail,
        drs_active=drs_active,
        battery_level=step.ml_battery_pct,
        energy_deployment=0.35 if step.ml_decision.action.value == "OVERTAKE" else 0.05,
        energy_recovery=0.20 if brake > 0.3 else 0.0,
        gap_ahead=step.ml_gap_ahead,
        gap_behind=2.2,
        lap=step.lap,
        sector=step.sector,
        lap_time=float(step.step * 4.5 % 90.0),
        closing_speed=round((step.ml_speed - 280.0) * 0.2778, 2),
        deployment_budget_remaining_this_lap=step.ml_budget_remaining_mj,
        continuous_deployment_seconds=1.5 if step.ml_decision.action.value == "OVERTAKE" else 0.0,
        time_since_last_deployment=0.0 if step.ml_decision.action.value == "OVERTAKE" else 6.0
    )
