from typing import Optional
from backend.simulator import RaceSimulator

class RaceStateStore:
    _active_simulator: Optional[RaceSimulator] = None

    @classmethod
    def get_simulator(cls) -> RaceSimulator:
        """Returns the global interactive RaceSimulator."""
        if cls._active_simulator is None:
            cls._active_simulator = RaceSimulator()
        return cls._active_simulator
