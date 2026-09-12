"""
F1 Race Simulator Engine
Simulates multi-lap racing scenarios comparing an intelligent ML energy strategy
against a naive rule-based baseline under identical race conditions.

Key Simulation Pillars:
1. Dynamic telemetry physics (speed, throttle, brake, DRS, gaps).
2. Energy accounting via energy_model.py.
3. Hard constraint checking and violation logging via rules.py.
4. Overtake mechanics based on gap, closing speed, and engine modes.
"""

import math
import random
from typing import List, Dict, Any, Tuple
from backend.schemas import (
    ActionType,
    DecisionResponse,
    SimulateRequest,
    SimulateResponse,
    StepRecord,
    StrategyMetrics,
    TelemetryState
)
from backend.ml_adapter import get_decision
from backend.energy_model import (
    update_energy,
    percentage_to_mj,
    mj_to_percentage,
    calculate_action_energy_delta,
    MAX_BATTERY_CAPACITY_MJ
)
from backend.rules import check_compliance, MAX_DEPLOYMENT_PER_LAP_MJ


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
        self.speed = 280.0
        self.throttle = 0.85
        self.brake = 0.0
        self.gear = 7
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
    """
    def __init__(self, request: SimulateRequest):
        self.request = request
        self.rng = random.Random(request.random_seed or 42)
        self.step_duration_s = 4.5  # average seconds per simulation step

    def _get_track_profile(self, step_in_lap: int, steps_per_lap: int) -> Dict[str, Any]:
        """
        Returns sector characteristics based on position around the lap.
        Sector 1: Main straight & DRS zone (steps 0 to ~33% of lap)
        Sector 2: Twisty corners & heavy braking zones (~33% to ~67% of lap)
        Sector 3: Medium speed flow + final straight (~67% to 100% of lap)
        """
        pct = step_in_lap / float(steps_per_lap)

        if pct < 0.35:
            # Sector 1: Straight, high throttle, DRS zone
            return {
                "sector": 1,
                "base_speed": 315.0,
                "throttle": 1.0,
                "brake": 0.0,
                "gear": 8,
                "drs_zone": True
            }
        elif pct < 0.70:
            # Sector 2: Twisty technical sector, heavy braking & harvesting
            return {
                "sector": 2,
                "base_speed": 175.0,
                "throttle": 0.50,
                "brake": 0.65,
                "gear": 4,
                "drs_zone": False
            }
        else:
            # Sector 3: Medium speed corner exits leading to start/finish straight
            return {
                "sector": 3,
                "base_speed": 265.0,
                "throttle": 0.88,
                "brake": 0.15,
                "gear": 6,
                "drs_zone": False
            }

    def _simulate_single_car_step(
        self,
        car: CarSimulationState,
        track: Dict[str, Any],
        lap: int,
        use_baseline: bool
    ) -> Tuple[DecisionResponse, bool, bool]:
        """
        Advances an individual car by one timestep.
        Returns (DecisionResponse, rule_violation_occurred, overtake_occurred).
        """
        budget_remaining = car.get_budget_remaining()
        drs_available = track["drs_zone"] and (car.gap_ahead < 1.0)
        drs_active = drs_available and (car.throttle > 0.9)

        # 1. Build Telemetry State Vector
        closing_speed = (car.speed - track["base_speed"]) * 0.2778  # m/s
        state_dict = {
            "speed": car.speed,
            "throttle": track["throttle"],
            "brake": track["brake"],
            "gear": track["gear"],
            "drs_available": drs_available,
            "drs_active": drs_active,
            "battery_level": mj_to_percentage(car.battery_mj),
            "energy_deployment": 0.35 if car.continuous_deployment_seconds > 0 else 0.0,
            "energy_recovery": 0.20 if track["brake"] > 0.3 else 0.0,
            "gap_ahead": car.gap_ahead,
            "gap_behind": car.gap_behind,
            "lap": lap,
            "sector": track["sector"],
            "lap_time": car.current_lap_time,
            "closing_speed": round(closing_speed, 2),
            "deployment_budget_remaining_this_lap": round(budget_remaining, 3),
            "continuous_deployment_seconds": round(car.continuous_deployment_seconds, 1),
            "time_since_last_deployment": round(car.time_since_last_deployment, 1)
        }

        # 2. Query Decision from ML Adapter (ML vs Baseline)
        raw_decision = get_decision(state_dict, use_baseline=use_baseline)
        proposed_action = ActionType(raw_decision["action"])
        expected_cost = float(raw_decision["expected_energy_cost"])

        # 3. Check FIA Rule Compliance (deployment limit, burst duration, cooldown)
        rule_check = check_compliance(state_dict, proposed_action, expected_cost)
        violation_occurred = not rule_check.allowed

        if violation_occurred:
            car.rule_violations_count += 1

        # Effective action applied in physics:
        # If violation occurred, cap to HOLD to prevent illegal physical advantage
        effective_action = rule_check.capped_action if violation_occurred else proposed_action

        # 4. Energy Accounting
        deployed_mj, recovered_mj = calculate_action_energy_delta(
            effective_action,
            throttle=track["throttle"],
            brake=track["brake"]
        )

        car.battery_mj = update_energy(car.battery_mj, deployed_mj, recovered_mj)
        car.lap_deployment_used_mj += deployed_mj
        car.total_energy_deployed_mj += deployed_mj
        car.total_energy_recovered_mj += recovered_mj

        # Update deployment timers
        if effective_action == ActionType.OVERTAKE:
            car.continuous_deployment_seconds += self.step_duration_s
            car.time_since_last_deployment = 0.0
        else:
            car.continuous_deployment_seconds = 0.0
            car.time_since_last_deployment += self.step_duration_s

        # 5. Physics Dynamics: Speed, Gaps & Overtake Logic
        speed_delta = 0.0
        if effective_action == ActionType.OVERTAKE:
            speed_delta += 14.0  # +14 km/h electrical boost
            if drs_active:
                speed_delta += 16.0  # +16 km/h DRS drag reduction
        elif effective_action == ActionType.RECOVER:
            speed_delta -= 10.0  # -10 km/h regenerative braking drag

        car.speed = max(100.0, track["base_speed"] + speed_delta)

        # Gap delta calculation
        gap_closing_rate = (car.speed - track["base_speed"]) * 0.015  # seconds closed per step
        car.gap_ahead = max(0.05, car.gap_ahead - gap_closing_rate)
        car.gap_behind = max(0.5, car.gap_behind + gap_closing_rate * 0.5)

        # Check Overtake Success:
        # Conditions: within 0.35s gap, car running OVERTAKE mode, and sufficient battery remaining
        overtake_success = False
        if car.gap_ahead <= 0.35 and effective_action == ActionType.OVERTAKE and car.battery_mj > 0.4:
            overtake_success = True
            car.total_overtakes += 1
            car.positions_gained += 1
            car.position = max(1, car.position - 1)
            # New opponent ahead
            car.gap_ahead = 2.4 + self.rng.uniform(-0.3, 0.4)

        # Advance step time
        car.current_lap_time += self.step_duration_s

        decision_resp = DecisionResponse(
            action=proposed_action,
            confidence=float(raw_decision["confidence"]),
            expected_energy_cost=expected_cost,
            reason=str(raw_decision["reason"]),
            rule_compliant=not violation_occurred,
            violation_reason=rule_check.violation_reason,
            enforced_action=rule_check.capped_action
        )

        return decision_resp, violation_occurred, overtake_success

    def run(self) -> SimulateResponse:
        """Runs the complete side-by-side race simulation."""
        ml_car = CarSimulationState(
            strategy_name="ML Intelligent Strategy",
            initial_battery_pct=self.request.initial_battery_pct,
            initial_gap_ahead=self.request.initial_gap_ahead
        )
        baseline_car = CarSimulationState(
            strategy_name="Rule-Based Baseline",
            initial_battery_pct=self.request.initial_battery_pct,
            initial_gap_ahead=self.request.initial_gap_ahead
        )

        records: List[StepRecord] = []
        step_counter = 0

        for lap in range(1, self.request.total_laps + 1):
            # Reset lap deployment budgets at the start of each lap
            ml_car.lap_deployment_used_mj = 0.0
            baseline_car.lap_deployment_used_mj = 0.0
            ml_car.current_lap_time = 0.0
            baseline_car.current_lap_time = 0.0

            for s in range(self.request.steps_per_lap):
                step_counter += 1
                track = self._get_track_profile(s, self.request.steps_per_lap)
                pct_distance = round((s / float(self.request.steps_per_lap)) * 100.0, 1)

                # Step both cars through identical track state
                ml_decision, ml_viol, ml_pass = self._simulate_single_car_step(
                    ml_car, track, lap, use_baseline=False
                )
                base_decision, base_viol, base_pass = self._simulate_single_car_step(
                    baseline_car, track, lap, use_baseline=True
                )

                records.append(StepRecord(
                    step=step_counter,
                    lap=lap,
                    sector=track["sector"],
                    track_distance_pct=pct_distance,
                    ml_speed=round(ml_car.speed, 1),
                    ml_battery_pct=mj_to_percentage(ml_car.battery_mj),
                    ml_gap_ahead=round(ml_car.gap_ahead, 2),
                    ml_budget_remaining_mj=round(ml_car.get_budget_remaining(), 2),
                    ml_decision=ml_decision,
                    ml_rule_violation=ml_viol,
                    ml_overtake_successful=ml_pass,
                    baseline_speed=round(baseline_car.speed, 1),
                    baseline_battery_pct=mj_to_percentage(baseline_car.battery_mj),
                    baseline_gap_ahead=round(baseline_car.gap_ahead, 2),
                    baseline_budget_remaining_mj=round(baseline_car.get_budget_remaining(), 2),
                    baseline_decision=base_decision,
                    baseline_rule_violation=base_viol,
                    baseline_overtake_successful=base_pass
                ))

            # Record lap time
            ml_car.lap_times.append(ml_car.current_lap_time)
            baseline_car.lap_times.append(baseline_car.current_lap_time)

        # Compute aggregate metrics for both strategies
        total_time_ml = sum(ml_car.lap_times)
        total_time_base = sum(baseline_car.lap_times)
        avg_lap_ml = total_time_ml / max(1, len(ml_car.lap_times))
        avg_lap_base = total_time_base / max(1, len(baseline_car.lap_times))

        total_km = self.request.total_laps * 5.3  # typical 5.3 km F1 circuit
        eff_ml = round(total_km / max(0.1, ml_car.total_energy_deployed_mj), 2)
        eff_base = round(total_km / max(0.1, baseline_car.total_energy_deployed_mj), 2)

        ml_metrics = StrategyMetrics(
            strategy_name="ML Motorsport Intelligence",
            total_overtakes=ml_car.total_overtakes,
            positions_gained=ml_car.positions_gained,
            final_position=ml_car.position,
            average_lap_time_s=round(avg_lap_ml, 2),
            total_race_time_s=round(total_time_ml, 2),
            final_battery_pct=mj_to_percentage(ml_car.battery_mj),
            total_energy_deployed_mj=round(ml_car.total_energy_deployed_mj, 2),
            total_energy_recovered_mj=round(ml_car.total_energy_recovered_mj, 2),
            energy_efficiency_score=eff_ml,
            rule_violations_count=ml_car.rule_violations_count
        )

        base_metrics = StrategyMetrics(
            strategy_name="Rule-Based Baseline",
            total_overtakes=baseline_car.total_overtakes,
            positions_gained=baseline_car.positions_gained,
            final_position=baseline_car.position,
            average_lap_time_s=round(avg_lap_base, 2),
            total_race_time_s=round(total_time_base, 2),
            final_battery_pct=mj_to_percentage(baseline_car.battery_mj),
            total_energy_deployed_mj=round(baseline_car.total_energy_deployed_mj, 2),
            total_energy_recovered_mj=round(baseline_car.total_energy_recovered_mj, 2),
            energy_efficiency_score=eff_base,
            rule_violations_count=baseline_car.rule_violations_count
        )

        summary = (
            f"Simulation finished across {self.request.total_laps} laps. "
            f"ML Strategy achieved {ml_car.total_overtakes} overtakes with {ml_car.rule_violations_count} rule violations, "
            f"retaining {mj_to_percentage(ml_car.battery_mj):.1f}% battery. "
            f"Baseline achieved {baseline_car.total_overtakes} overtakes but accumulated "
            f"{baseline_car.rule_violations_count} FIA deployment-limit violations due to lack of lap-budget awareness."
        )

        return SimulateResponse(
            total_steps=step_counter,
            total_laps=self.request.total_laps,
            scenario_seed=self.request.random_seed or 42,
            steps=records,
            ml_metrics=ml_metrics,
            baseline_metrics=base_metrics,
            comparison_summary=summary
        )
