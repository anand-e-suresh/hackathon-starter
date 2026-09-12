"""
Shared In-Memory State Store
Caches the latest race simulation results, live telemetry snapshots,
and race states for frontend polling and inspection.
"""

from typing import Optional, Dict, Any
from backend.schemas import SimulateRequest, SimulateResponse, TelemetryState, StepRecord
from backend.simulator import RaceSimulator


class RaceStateStore:
    _latest_simulation: Optional[SimulateResponse] = None
    _active_step_index: int = 0

    @classmethod
    def get_simulation(cls) -> SimulateResponse:
        """Returns the cached simulation response or generates a default 5-lap race."""
        if cls._latest_simulation is None:
            default_request = SimulateRequest(
                total_laps=5,
                steps_per_lap=20,
                initial_battery_pct=70.0,
                initial_gap_ahead=1.5,
                random_seed=42
            )
            cls._latest_simulation = RaceSimulator(default_request).run()
            cls._active_step_index = len(cls._latest_simulation.steps) - 1
        return cls._latest_simulation

    @classmethod
    def set_simulation(cls, simulation: SimulateResponse) -> None:
        """Stores a newly executed simulation."""
        cls._latest_simulation = simulation
        cls._active_step_index = len(simulation.steps) - 1

    @classmethod
    def get_latest_step(cls) -> StepRecord:
        """Returns the latest step record from the active simulation."""
        sim = cls.get_simulation()
        idx = max(0, min(cls._active_step_index, len(sim.steps) - 1))
        return sim.steps[idx]

    @classmethod
    def advance_step(cls) -> StepRecord:
        """Advances the step index for live streaming/polling effect."""
        sim = cls.get_simulation()
        cls._active_step_index = (cls._active_step_index + 1) % len(sim.steps)
        return sim.steps[cls._active_step_index]
