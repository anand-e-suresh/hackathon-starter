"""
Pydantic Schemas and API Data Contracts
Defines all input telemetry, decision outputs, rule-checking results,
and simulation comparison models for the AI Motorsport Intelligence engine.
"""

from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ActionType(str, Enum):
    OVERTAKE = "OVERTAKE"
    HOLD = "HOLD"
    RECOVER = "RECOVER"


class TelemetryState(BaseModel):
    """
    Standardized F1 Telemetry & Engineered Feature Input Vector.
    Matches the ML model's expected feature list.
    """
    speed: float = Field(..., description="Car speed in km/h", ge=0.0, le=400.0, examples=[295.4])
    throttle: float = Field(..., description="Throttle position 0.0 to 1.0", ge=0.0, le=1.0, examples=[0.95])
    brake: float = Field(0.0, description="Brake position 0.0 to 1.0", ge=0.0, le=1.0, examples=[0.0])
    gear: int = Field(..., description="Current gear (1-8)", ge=1, le=8, examples=[7])
    drs_available: bool = Field(False, description="DRS detection zone triggered and wing available")
    drs_active: bool = Field(False, description="DRS wing flap currently open")
    battery_level: float = Field(..., description="Battery state-of-charge percentage (0.0 to 100.0)", ge=0.0, le=100.0, examples=[65.0])
    energy_deployment: float = Field(0.0, description="Current instantaneous energy deployment in MJ", ge=0.0, examples=[0.35])
    energy_recovery: float = Field(0.0, description="Current instantaneous energy recovery (harvesting) in MJ", ge=0.0, examples=[0.0])
    gap_ahead: float = Field(..., description="Gap to car ahead in seconds", ge=0.0, examples=[0.85])
    gap_behind: float = Field(2.5, description="Gap to car behind in seconds", ge=0.0, examples=[2.5])
    lap: int = Field(1, description="Current lap number", ge=1, examples=[12])
    sector: int = Field(1, description="Current track sector (1, 2, or 3)", ge=1, le=3, examples=[2])
    lap_time: float = Field(0.0, description="Current lap time in seconds", ge=0.0, examples=[48.2])

    # Engineered Features (Rule Compliance & Attack Potential)
    closing_speed: float = Field(0.0, description="Speed delta relative to car ahead in m/s (positive = closing in)", examples=[4.2])
    deployment_budget_remaining_this_lap: float = Field(
        4.0, 
        description="Remaining FIA legal deployment budget for current lap in MJ (max 4.0 MJ/lap)",
        ge=0.0,
        le=4.0,
        examples=[2.8]
    )
    continuous_deployment_seconds: float = Field(
        0.0, 
        description="Consecutive duration of high energy deployment in seconds",
        ge=0.0,
        examples=[1.5]
    )
    time_since_last_deployment: float = Field(
        10.0, 
        description="Time elapsed since previous boost deployment in seconds",
        ge=0.0,
        examples=[8.0]
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "speed": 298.5,
                "throttle": 0.98,
                "brake": 0.0,
                "gear": 7,
                "drs_available": True,
                "drs_active": True,
                "battery_level": 64.5,
                "energy_deployment": 0.35,
                "energy_recovery": 0.0,
                "gap_ahead": 0.72,
                "gap_behind": 3.1,
                "lap": 14,
                "sector": 2,
                "lap_time": 42.1,
                "closing_speed": 5.4,
                "deployment_budget_remaining_this_lap": 2.45,
                "continuous_deployment_seconds": 1.2,
                "time_since_last_deployment": 6.5
            }
        }
    }


class DecisionResponse(BaseModel):
    """
    Standard output contract for energy deployment recommendations.
    Matches the required project schema exactly.
    """
    action: ActionType = Field(..., description="Recommended deployment mode: OVERTAKE, HOLD, or RECOVER")
    confidence: float = Field(..., description="Model confidence score between 0.0 and 1.0", ge=0.0, le=1.0)
    expected_energy_cost: float = Field(..., description="Predicted net energy consequence in MJ (positive=consumption, negative=recovery)")
    reason: str = Field(..., description="Explainable rationale derived from feature importances/telemetry")

    # Rule compliance metadata (first-class theme pillar)
    rule_compliant: bool = Field(True, description="Whether the recommended action complies with FIA deployment limits")
    violation_reason: Optional[str] = Field(None, description="Explanation if action was modified or flagged due to rule limits")
    enforced_action: Optional[ActionType] = Field(None, description="Capped action if original action breached FIA regulations")


class RuleCheckResult(BaseModel):
    """Result of FIA Technical Regulation check."""
    allowed: bool
    violation_reason: Optional[str] = None
    capped_action: Optional[ActionType] = None
    remaining_lap_budget_mj: float


class SimulateRequest(BaseModel):
    """Parameters to run a multi-lap race simulation comparing ML vs Baseline."""
    total_laps: int = Field(5, description="Number of laps to simulate", ge=1, le=20)
    steps_per_lap: int = Field(20, description="Telemetry resolution steps per lap", ge=5, le=50)
    initial_battery_pct: float = Field(70.0, description="Starting battery state of charge (0-100%)", ge=10.0, le=100.0)
    initial_gap_ahead: float = Field(1.5, description="Initial gap in seconds to lead car", ge=0.2, le=10.0)
    random_seed: Optional[int] = Field(42, description="Random seed for reproducible race scenario")


class StepRecord(BaseModel):
    """Single timestep in the race simulation showing ML vs Baseline decisions side-by-side."""
    step: int
    lap: int
    sector: int
    track_distance_pct: float

    # ML Car State & Action
    ml_speed: float
    ml_battery_pct: float
    ml_gap_ahead: float
    ml_budget_remaining_mj: float
    ml_decision: DecisionResponse
    ml_rule_violation: bool
    ml_overtake_successful: bool

    # Baseline Car State & Action (Identical race state input)
    baseline_speed: float
    baseline_battery_pct: float
    baseline_gap_ahead: float
    baseline_budget_remaining_mj: float
    baseline_decision: DecisionResponse
    baseline_rule_violation: bool
    baseline_overtake_successful: bool


class StrategyMetrics(BaseModel):
    """Aggregated strategy evaluation metrics (Evaluation Layer 2)."""
    strategy_name: str
    total_overtakes: int
    positions_gained: int
    final_position: int
    average_lap_time_s: float
    total_race_time_s: float
    final_battery_pct: float
    total_energy_deployed_mj: float
    total_energy_recovered_mj: float
    energy_efficiency_score: float  # km per MJ deployed
    rule_violations_count: int      # Theme pillar: hard metric


class SimulateResponse(BaseModel):
    """Complete simulation response with side-by-side timeseries and strategy metrics."""
    total_steps: int
    total_laps: int
    scenario_seed: int
    steps: List[StepRecord]
    ml_metrics: StrategyMetrics
    baseline_metrics: StrategyMetrics
    comparison_summary: str
