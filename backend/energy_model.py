"""
F1 ERS (Energy Recovery System) Accounting Model
Simulates battery state-of-charge dynamics, energy deployment (MGU-K boost),
and energy harvesting (MGU-K kinetic braking / MGU-H turbo recovery).

Note on Engineering Abstraction:
This model is an algorithmic simulation abstraction inspired by FIA Formula 1
Technical Regulations (simplified Article 5 Power Unit regulations). It models
energy transfer in Megajoules (MJ) with hard physical bounds, rather than
micro-level electrochemical cell degradation or thermal thermodynamics.
"""

from typing import Tuple
from backend.schemas import ActionType

# Constants (FIA-inspired ERS specifications)
MAX_BATTERY_CAPACITY_MJ: float = 4.0     # Standard F1 Energy Store (ES) capacity: 4.0 MJ
MIN_BATTERY_CAPACITY_MJ: float = 0.0     # Complete depletion floor
MAX_DEPLOYMENT_PER_STEP_MJ: float = 0.5  # Max instantaneous discharge rate per simulation step
MAX_RECOVERY_PER_STEP_MJ: float = 0.3    # Max instantaneous MGU-K harvesting rate per simulation step

# Typical mode energy coefficients (in MJ per simulation step)
OVERTAKE_DEPLOYMENT_BASE_MJ: float = 0.35
HOLD_DEPLOYMENT_BASE_MJ: float = 0.05
RECOVER_HARVEST_BASE_MJ: float = 0.22


def mj_to_percentage(mj: float) -> float:
    """Converts energy in Megajoules (MJ) to battery State of Charge percentage (0.0% to 100.0%)."""
    pct = (mj / MAX_BATTERY_CAPACITY_MJ) * 100.0
    return max(0.0, min(100.0, round(pct, 2)))


def percentage_to_mj(pct: float) -> float:
    """Converts battery State of Charge percentage (0.0% to 100.0%) to energy in Megajoules (MJ)."""
    clamped_pct = max(0.0, min(100.0, pct))
    return round((clamped_pct / 100.0) * MAX_BATTERY_CAPACITY_MJ, 4)


def update_energy(
    current_mj: float,
    deployed_mj: float = 0.0,
    recovered_mj: float = 0.0
) -> float:
    """
    Updates the car's Energy Store (ES) battery level based on deployment and recovery.

    Formula:
        E_new = E_current - E_deployed + E_recovered
        Subject to:
        0.0 MJ <= E_new <= MAX_BATTERY_CAPACITY_MJ (4.0 MJ)
        0.0 <= E_deployed <= MAX_DEPLOYMENT_PER_STEP_MJ
        0.0 <= E_recovered <= MAX_RECOVERY_PER_STEP_MJ

    Args:
        current_mj: Current energy in battery (MJ)
        deployed_mj: Energy deployed (discharged) during this step (MJ)
        recovered_mj: Energy recovered (harvested) during this step (MJ)

    Returns:
        new_mj: Updated battery energy level, strictly bounded in [0.0, 4.0] MJ.
    """
    # Clamp input rates to physical limits
    eff_deployed = max(0.0, min(MAX_DEPLOYMENT_PER_STEP_MJ, float(deployed_mj)))
    eff_recovered = max(0.0, min(MAX_RECOVERY_PER_STEP_MJ, float(recovered_mj)))

    # Ensure deployment cannot exceed available energy
    eff_deployed = min(eff_deployed, max(0.0, current_mj))

    # Calculate net state
    net_energy = current_mj - eff_deployed + eff_recovered

    # Strictly clamp between 0.0 and MAX_BATTERY_CAPACITY_MJ (no overflow, no underflow)
    clamped_energy = max(MIN_BATTERY_CAPACITY_MJ, min(MAX_BATTERY_CAPACITY_MJ, net_energy))

    return round(clamped_energy, 4)


def calculate_action_energy_delta(
    action: ActionType,
    throttle: float = 1.0,
    brake: float = 0.0
) -> Tuple[float, float]:
    """
    Calculates the expected (deployed_mj, recovered_mj) tuple based on the recommended
    action and driver pedal inputs.

    Args:
        action: Recommended mode (OVERTAKE, HOLD, or RECOVER)
        throttle: Throttle position between 0.0 and 1.0
        brake: Brake position between 0.0 and 1.0

    Returns:
        Tuple of (deployed_mj, recovered_mj)
    """
    clamped_throttle = max(0.0, min(1.0, throttle))
    clamped_brake = max(0.0, min(1.0, brake))

    if action == ActionType.OVERTAKE:
        # High power deployment, no harvesting
        deployed = OVERTAKE_DEPLOYMENT_BASE_MJ * max(0.6, clamped_throttle)
        recovered = 0.0
    elif action == ActionType.RECOVER:
        # Heavy regeneration under braking or coasting, minimal base consumption
        deployed = 0.0
        harvest_intensity = max(0.5, clamped_brake)
        recovered = RECOVER_HARVEST_BASE_MJ * harvest_intensity
    else:  # ActionType.HOLD
        # Nominal maintain-pace deployment, slight coasting recovery if off-throttle
        deployed = HOLD_DEPLOYMENT_BASE_MJ * clamped_throttle
        recovered = 0.04 * (1.0 - clamped_throttle)

    return (round(deployed, 4), round(recovered, 4))
