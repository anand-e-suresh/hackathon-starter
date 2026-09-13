from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

class ActionType(str, Enum):
    OVERTAKE = "OVERTAKE"
    HOLD = "HOLD"
    RECOVER = "RECOVER"

class TelemetryState(BaseModel):
    speed: float = Field(..., description="Car speed in km/h")
    throttle: float = Field(..., description="Throttle pedal position 0.0 to 1.0")
    brake: float = Field(..., description="Brake pedal position 0.0 to 1.0")
    gear: int = Field(..., description="Current gear")
    drs_available: bool
    drs_active: bool
    battery_level: float = Field(..., description="State of charge (0 to 100%)")
    energy_deployment: float = Field(0.0)
    energy_recovery: float = Field(0.0)
    gap_ahead: float = Field(..., description="Gap to car ahead in seconds")
    gap_behind: float = Field(..., description="Gap to car behind in seconds")
    lap: int
    sector: int
    lap_time: float
    closing_speed: float
    deployment_budget_remaining_this_lap: float
    continuous_deployment_seconds: float
    time_since_last_deployment: float
    TrackTemp: float = Field(35.0)
    Rainfall: bool = Field(False)
    Distance: float = Field(0.0)
    Compound: str = Field("UNKNOWN")
    TyreLife: float = Field(1.0)
    Opponent_Compound: str = Field("UNKNOWN")
    Opponent_TyreLife: float = Field(1.0)

class DecisionResponse(BaseModel):
    action: ActionType
    confidence: float
    expected_energy_cost: float
    reason: str
    rule_compliant: bool = True
    violation_reason: Optional[str] = None
    enforced_action: Optional[ActionType] = None

class RuleCheckResult(BaseModel):
    allowed: bool
    violation_reason: Optional[str] = None
    capped_action: Optional[ActionType] = None

# WebSocket specific structures
class SimulationControlCommand(BaseModel):
    type: str = Field(..., description="START, PAUSE, RESUME, STOP, RESET, SPEED")
    speed: Optional[float] = None

class SimulationStatusResponse(BaseModel):
    type: str = "simulation_status"
    status: str

class SimulationCarState(BaseModel):
    strategy: str
    position: int
    speed: float
    gap_ahead: float
    gap_behind: float
    x: float = Field(0.0, description="Spatial X coordinate")
    y: float = Field(0.0, description="Spatial Y coordinate")
    battery_pct: float
    budget_remaining_mj: float

class SimulationUpdateResponse(BaseModel):
    type: str = "simulation_update"
    time: float
    lap: int
    sector: int
    status: str
    ml_car: SimulationCarState
    baseline_car: SimulationCarState
    ml_decision: DecisionResponse
    baseline_decision: DecisionResponse

# Legacy (from old REST endpoint logic, for compatibility)
class StepRecord(BaseModel):
    tick: int
    time_s: float
    lap: int
    sector: int
    ml_state: TelemetryState
    ml_decision: DecisionResponse
    base_state: TelemetryState
    base_decision: DecisionResponse

class StrategyMetrics(BaseModel):
    strategy_name: str
    total_overtakes: int
    positions_gained: int
    final_position: int
    average_lap_time_s: float
    total_race_time_s: float
    final_battery_pct: float
    total_energy_deployed_mj: float
    total_energy_recovered_mj: float
    energy_efficiency_score: float
    rule_violations_count: int

class SimulateRequest(BaseModel):
    total_laps: int = 5
    steps_per_lap: int = 20
    initial_battery_pct: float = 70.0
    initial_gap_ahead: float = 1.5
    random_seed: Optional[int] = 42

class SimulateResponse(BaseModel):
    total_steps: int
    total_laps: int
    scenario_seed: int
    steps: List[StepRecord]
    ml_metrics: StrategyMetrics
    baseline_metrics: StrategyMetrics
    comparison_summary: str
