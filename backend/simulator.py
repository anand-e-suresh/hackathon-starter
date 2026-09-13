import math
import random
import time
import logging
import os
import pandas as pd
from typing import List, Dict, Any

from schemas import (
    ActionType,
    DecisionResponse,
    SimulateRequest,
    SimulateResponse,
    StepRecord,
    StrategyMetrics,
    TelemetryState,
    SimulationUpdateResponse,
    SimulationCarState
)
from ml_adapter import get_decision
from energy_model import (
    update_energy,
    percentage_to_mj,
    mj_to_percentage,
    calculate_action_energy_delta,
    MAX_BATTERY_CAPACITY_MJ
)
from rules import check_compliance, MAX_DEPLOYMENT_PER_LAP_MJ

logger = logging.getLogger(__name__)

class CarSimulationState:
    """State of an individual car in the simulation."""
    def __init__(
        self,
        strategy_name: str,
        initial_battery_pct: float = 70.0,
        initial_gap_ahead: float = 1.5,
        starting_position: int = 4
    ):
        self.strategy_name = strategy_name
        self.position = starting_position
        self.battery_mj = percentage_to_mj(initial_battery_pct)
        self.gap_ahead = initial_gap_ahead
        self.gap_behind = 2.5
        self.speed = 0.0
        self.throttle = 0.0
        self.brake = 0.0
        self.x = 0.0
        self.y = 0.0
        self.gear = 1
        self.drs_available = False
        self.drs_active = False

        # Regulatory & telemetry state tracking
        self.lap_deployment_used_mj = 0.0
        self.continuous_deployment_seconds = 0.0
        self.time_since_last_deployment = 8.0
        self.current_lap_time = 0.0

        # Aggregated metrics
        self.total_overtakes = 0
        self.positions_gained = 0
        self.rule_violations_count = 0
        self.total_energy_deployed_mj = 0.0
        self.total_energy_recovered_mj = 0.0
        self.lap_times: List[float] = []

    def get_budget_remaining(self) -> float:
        return max(0.0, MAX_DEPLOYMENT_PER_LAP_MJ - self.lap_deployment_used_mj)


class RaceSimulator:
    """
    Orchestrates the multi-lap race session for both ML and Baseline strategies.
    Uses pre-generated CSV telemetry data instead of real-time FastF1 parsing.
    """
    def __init__(self, request: SimulateRequest = SimulateRequest()):
        self.request = request
        self.rng = random.Random(request.random_seed or 42)
        self.step_duration_s = 1.0  # 1 simulated second tick
        
        self.status = "IDLE"
        self.playback_speed = 1.0
        self.csv_path = 'monza_2023_telemetry.csv'
        
        # Load CSV data once into memory
        self._telemetry_records = self._load_csv_telemetry()
        self._max_ticks = len(self._telemetry_records)
        self._current_tick = 0
        
        self.ml_car = None
        self.baseline_car = None
        self.current_lap = 1
        self.simulated_time_s = 0.0
        
        self.ml_decision = None
        self.baseline_decision = None
        
        self.reset()

    def _load_csv_telemetry(self) -> List[Dict[str, Any]]:
        csv_path = os.path.join(os.path.dirname(__file__), 'data', self.csv_path)
        try:
            if not os.path.exists(csv_path):
                logger.warning(f"CSV not found at {csv_path}. Generating mock telemetry.")
                return self._generate_mock_telemetry()
                
            df = pd.read_csv(csv_path)
            records = df.to_dict(orient='records')
            logger.info(f"Successfully loaded {len(records)} telemetry ticks from CSV.")
            return records
        except Exception as e:
            logger.error(f"Error reading CSV: {e}")
            return self._generate_mock_telemetry()

    def _generate_mock_telemetry(self) -> List[Dict[str, Any]]:
        records = []
        for i in range(200):
            records.append({
                "Speed": 250.0 + math.sin(i * 0.1) * 50.0,
                "Throttle": 100.0 if math.sin(i * 0.1) > 0 else 20.0,
                "Brake": 50.0 if math.sin(i * 0.1) < -0.5 else 0.0,
                "nGear": 6,
                "Time_s_int": i
            })
        return records

    def reset(self):
        """Resets all cars and metrics to starting conditions."""
        self.status = "STOPPED"
        self._current_tick = 0
        self.current_lap = 1
        self.simulated_time_s = 0.0
        
        self.ml_car = CarSimulationState(
            strategy_name="ML Intelligent Strategy",
            initial_battery_pct=self.request.initial_battery_pct,
            initial_gap_ahead=self.request.initial_gap_ahead
        )
        self.baseline_car = CarSimulationState(
            strategy_name="Rule-Based Baseline",
            initial_battery_pct=self.request.initial_battery_pct,
            initial_gap_ahead=self.request.initial_gap_ahead
        )
        self.status = "IDLE"

    def load_session(self, filename: str):
        """Dynamically switch to a new telemetry CSV session."""
        logger.info(f"RaceSimulator loading new session: {filename}")
        self.csv_path = filename
        self._telemetry_records = self._load_csv_telemetry()
        self._max_ticks = len(self._telemetry_records)
        self.reset()

    def start(self):
        if self.status in ["IDLE", "FINISHED", "STOPPED", "ERROR"]:
            self.reset()
        self.status = "RUNNING"

    def pause(self):
        if self.status == "RUNNING":
            self.status = "PAUSED"

    def resume(self):
        if self.status == "PAUSED":
            self.status = "RUNNING"
            
    def stop(self):
        self.status = "STOPPED"

    def get_state(self) -> SimulationUpdateResponse:
        """Returns the current structured simulation state for the WebSocket."""
        # Provide defaults if not initialized
        ml_car_state = SimulationCarState(
            strategy="ML Intelligent Strategy",
            position=self.ml_car.position if self.ml_car else 4,
            speed=self.ml_car.speed if self.ml_car else 0.0,
            gap_ahead=self.ml_car.gap_ahead if self.ml_car else 0.0,
            gap_behind=self.ml_car.gap_behind if self.ml_car else 0.0,
            x=self.ml_car.x if self.ml_car else 0.0,
            y=self.ml_car.y if self.ml_car else 0.0,
            battery_pct=mj_to_percentage(self.ml_car.battery_mj) if self.ml_car else 0.0,
            budget_remaining_mj=self.ml_car.get_budget_remaining() if self.ml_car else 0.0
        )
        
        base_car_state = SimulationCarState(
            strategy="Rule-Based Baseline",
            position=self.baseline_car.position if self.baseline_car else 4,
            speed=self.baseline_car.speed if self.baseline_car else 0.0,
            gap_ahead=self.baseline_car.gap_ahead if self.baseline_car else 0.0,
            gap_behind=self.baseline_car.gap_behind if self.baseline_car else 0.0,
            x=self.baseline_car.x if self.baseline_car else 0.0,
            y=self.baseline_car.y if self.baseline_car else 0.0,
            battery_pct=mj_to_percentage(self.baseline_car.battery_mj) if self.baseline_car else 0.0,
            budget_remaining_mj=self.baseline_car.get_budget_remaining() if self.baseline_car else 0.0
        )
        
        empty_dec = DecisionResponse(
            action=ActionType.HOLD, 
            confidence=1.0, 
            expected_energy_cost=0.0, 
            reason="Waiting for simulation."
        )

        sector = 1
        if self._current_tick > 0 and self._max_ticks > 0:
            pct = self._current_tick / float(self._max_ticks)
            if pct > 0.66: sector = 3
            elif pct > 0.33: sector = 2
        
        return SimulationUpdateResponse(
            time=self.simulated_time_s,
            lap=self.current_lap,
            sector=sector,
            status=self.status,
            ml_car=ml_car_state,
            baseline_car=base_car_state,
            ml_decision=self.ml_decision if self.ml_decision else empty_dec,
            baseline_decision=self.baseline_decision if self.baseline_decision else empty_dec
        )

    def _simulate_single_car_step(
        self,
        car: CarSimulationState,
        track: Dict[str, Any],
        use_baseline: bool
    ) -> DecisionResponse:
        """Advances an individual car by one timestep based on base CSV telemetry."""
        budget_remaining = car.get_budget_remaining()
        base_speed = track.get("Speed", 250.0)
        throttle = track.get("Throttle", 100.0) / 100.0
        brake = track.get("Brake", 0.0) / 100.0
        gear = track.get("nGear", 7)
        car.x = track.get("X", 0.0)
        car.y = track.get("Y", 0.0)
        
        # Pull real gap from telemetry
        distance_ahead = track.get("DistanceToDriverAhead")
        if pd.isna(distance_ahead) or distance_ahead is None:
            distance_ahead = 50.0
        
        # Ensure simulated delta is initialized
        if not hasattr(car, "simulated_distance_ahead_delta_m"):
            car.simulated_distance_ahead_delta_m = 0.0

        speed_ms = max(0.1, base_speed / 3.6)
        car.gap_ahead = float(distance_ahead) / speed_ms
        
        drs_available = (base_speed > 280) and (car.gap_ahead < 1.0)
        drs_active = drs_available and (throttle > 0.9)

        closing_speed = (car.speed - base_speed) * 0.2778  # m/s
        
        sector = 1
        pct = self._current_tick / float(max(1, self._max_ticks))
        if pct > 0.66: sector = 3
        elif pct > 0.33: sector = 2

        # Pull LapNumber from telemetry if available
        lap_num = track.get("LapNumber")
        if lap_num is not None and not pd.isna(lap_num):
            self.current_lap = int(float(lap_num))
            
        state_dict = {
            "speed": car.speed if car.speed > 0 else base_speed,
            "throttle": throttle,
            "brake": brake,
            "gear": gear,
            "drs_available": drs_available,
            "drs_active": drs_active,
            "battery_level": mj_to_percentage(car.battery_mj),
            "energy_deployment": 0.35 if car.continuous_deployment_seconds > 0 else 0.0,
            "energy_recovery": 0.20 if brake > 0.3 else 0.0,
            "gap_ahead": car.gap_ahead,
            "gap_behind": car.gap_behind,
            "lap": self.current_lap,
            "sector": sector,
            "lap_time": car.current_lap_time,
            "closing_speed": round(closing_speed, 2),
            "deployment_budget_remaining_this_lap": round(budget_remaining, 3),
            "continuous_deployment_seconds": round(car.continuous_deployment_seconds, 1),
            "time_since_last_deployment": round(car.time_since_last_deployment, 1),
            "TrackTemp": track.get("TrackTemp", 35.0),
            "Rainfall": track.get("Rainfall", False),
            "Distance": track.get("Distance", 0.0),
            "Compound": track.get("Compound", "UNKNOWN"),
            "TyreLife": track.get("TyreLife", 1.0),
            "Opponent_Compound": track.get("Opponent_Compound", "UNKNOWN"),
            "Opponent_TyreLife": track.get("Opponent_TyreLife", 1.0)
        }

        # Query AI Decision
        raw_decision = get_decision(state_dict, use_baseline=use_baseline)
        proposed_action = ActionType(raw_decision["action"])
        expected_cost = float(raw_decision["expected_energy_cost"])

        # Rule Compliance
        rule_check = check_compliance(state_dict, proposed_action, expected_cost)
        violation_occurred = not rule_check.allowed

        if violation_occurred:
            car.rule_violations_count += 1

        effective_action = rule_check.capped_action if violation_occurred else proposed_action

        # Energy Accounting
        deployed_mj, recovered_mj = calculate_action_energy_delta(effective_action, throttle=throttle, brake=brake)
        car.battery_mj = update_energy(car.battery_mj, deployed_mj, recovered_mj)
        car.lap_deployment_used_mj += deployed_mj
        car.total_energy_deployed_mj += deployed_mj
        car.total_energy_recovered_mj += recovered_mj

        if effective_action == ActionType.OVERTAKE:
            car.continuous_deployment_seconds += self.step_duration_s
            car.time_since_last_deployment = 0.0
        else:
            car.continuous_deployment_seconds = 0.0
            car.time_since_last_deployment += self.step_duration_s

        # Physics Dynamics: Speed & Gaps
        speed_delta = 0.0
        if effective_action == ActionType.OVERTAKE:
            speed_delta += 14.0
            if drs_active:
                speed_delta += 16.0
        elif effective_action == ActionType.RECOVER:
            speed_delta -= 10.0

        car.speed = max(0.0, base_speed + speed_delta)
        gap_closing_rate = (car.speed - base_speed) * 0.015
        
        # We strictly preserve the CSV gap_ahead for the frontend visualization as requested.
        # We just gently update gap_behind based on speed.
        car.gap_behind = max(0.5, car.gap_behind + gap_closing_rate * 0.5)

        if car.gap_ahead <= 0.35 and effective_action == ActionType.OVERTAKE and car.battery_mj > 0.4:
            car.total_overtakes += 1
            car.positions_gained += 1
            car.position = max(1, car.position - 1)

        car.current_lap_time += self.step_duration_s
        
        # When reaching end of the CSV data array, we simulate looping into the next lap
        if self._current_tick >= self._max_ticks - 1:
            car.current_lap_time = 0.0
            car.lap_deployment_used_mj = 0.0
            car.lap_times.append(90.0)

        return DecisionResponse(
            action=proposed_action,
            confidence=float(raw_decision["confidence"]),
            expected_energy_cost=expected_cost,
            reason=str(raw_decision["reason"]),
            rule_compliant=not violation_occurred,
            violation_reason=rule_check.violation_reason,
            enforced_action=rule_check.capped_action
        )

    def step(self):
        """Advances the simulation by 1 tick."""
        if self.status != "RUNNING":
            return
            
        if self._current_tick >= self._max_ticks:
            # We hit the end of the CSV dataset. Let's automatically loop it as a new lap!
            self._current_tick = 0
            self.current_lap += 1
            
        track = self._telemetry_records[self._current_tick]
        
        # Step both cars through identical track state
        self.ml_decision = self._simulate_single_car_step(self.ml_car, track, use_baseline=False)
        self.baseline_decision = self._simulate_single_car_step(self.baseline_car, track, use_baseline=True)
        
        self.simulated_time_s += self.step_duration_s
        self._current_tick += 1

    def run(self) -> SimulateResponse:
        pass
