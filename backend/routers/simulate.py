"""
Simulate Router
Triggers multi-lap F1 race simulations comparing ML strategy against baseline.
"""

from fastapi import APIRouter, status
from schemas import SimulateRequest, SimulateResponse
from simulator import RaceSimulator
from state_store import RaceStateStore

router = APIRouter(tags=["Simulation"])


@router.post(
    "/simulate",
    response_model=SimulateResponse,
    status_code=status.HTTP_200_OK,
    summary="Run full multi-lap race simulation",
    description=(
        "Executes a synchronized multi-lap race simulation running both the ML Strategy "
        "and the Naive Rule-Based Baseline on identical track and telemetry conditions. "
        "Returns side-by-side timeseries logs and strategy-level scorecard metrics."
    )
)
def run_race_simulation(request: SimulateRequest = SimulateRequest()) -> SimulateResponse:
    simulator = RaceSimulator(request)
    result = simulator.run()
    RaceStateStore.set_simulation(result)
    return result
