"""
Unit tests for the F1 ERS Energy Accounting Model (backend/energy_model.py).
Verifies that energy levels strictly adhere to physical bounds:
0.0 MJ <= Energy <= 4.0 MJ under all edge cases.
"""

import pytest
from backend.schemas import ActionType
from backend.energy_model import (
    update_energy,
    mj_to_percentage,
    percentage_to_mj,
    calculate_action_energy_delta,
    MAX_BATTERY_CAPACITY_MJ,
    MIN_BATTERY_CAPACITY_MJ,
    MAX_DEPLOYMENT_PER_STEP_MJ,
    MAX_RECOVERY_PER_STEP_MJ
)


def test_conversions_accuracy():
    assert mj_to_percentage(4.0) == 100.0
    assert mj_to_percentage(2.0) == 50.0
    assert mj_to_percentage(0.0) == 0.0

    assert percentage_to_mj(100.0) == 4.0
    assert percentage_to_mj(50.0) == 2.0
    assert percentage_to_mj(0.0) == 0.0


def test_standard_energy_update():
    # Deploy 0.3 MJ from 2.5 MJ
    new_energy = update_energy(current_mj=2.5, deployed_mj=0.3, recovered_mj=0.0)
    assert new_energy == 2.2

    # Recover 0.2 MJ from 2.2 MJ
    new_energy = update_energy(current_mj=2.2, deployed_mj=0.0, recovered_mj=0.2)
    assert new_energy == 2.4


def test_energy_cannot_exceed_max_capacity():
    # Attempting to harvest when already at 4.0 MJ
    new_energy = update_energy(current_mj=4.0, deployed_mj=0.0, recovered_mj=0.3)
    assert new_energy == MAX_BATTERY_CAPACITY_MJ
    assert new_energy <= 4.0

    # Near ceiling (3.9 MJ) + 0.3 MJ harvest should cap at 4.0 MJ
    new_energy = update_energy(current_mj=3.9, deployed_mj=0.0, recovered_mj=0.3)
    assert new_energy == MAX_BATTERY_CAPACITY_MJ


def test_energy_cannot_drop_below_zero():
    # Attempting to deploy from empty battery (0.0 MJ)
    new_energy = update_energy(current_mj=0.0, deployed_mj=0.4, recovered_mj=0.0)
    assert new_energy == MIN_BATTERY_CAPACITY_MJ
    assert new_energy >= 0.0

    # Low battery (0.1 MJ) deploying 0.3 MJ should clamp to 0.0 MJ
    new_energy = update_energy(current_mj=0.1, deployed_mj=0.3, recovered_mj=0.0)
    assert new_energy == 0.0


def test_deployment_and_recovery_rate_limits():
    # Excess deployment attempt (> MAX_DEPLOYMENT_PER_STEP_MJ) should be capped
    new_energy = update_energy(current_mj=3.0, deployed_mj=1.5, recovered_mj=0.0)
    expected = 3.0 - MAX_DEPLOYMENT_PER_STEP_MJ
    assert pytest.approx(new_energy, 0.001) == expected

    # Excess recovery attempt (> MAX_RECOVERY_PER_STEP_MJ) should be capped
    new_energy = update_energy(current_mj=1.0, deployed_mj=0.0, recovered_mj=1.0)
    expected = 1.0 + MAX_RECOVERY_PER_STEP_MJ
    assert pytest.approx(new_energy, 0.001) == expected


def test_action_energy_delta_calculations():
    # OVERTAKE
    deployed, recovered = calculate_action_energy_delta(ActionType.OVERTAKE, throttle=1.0, brake=0.0)
    assert deployed > 0.2
    assert recovered == 0.0

    # RECOVER
    deployed, recovered = calculate_action_energy_delta(ActionType.RECOVER, throttle=0.0, brake=0.8)
    assert deployed == 0.0
    assert recovered > 0.1

    # HOLD
    deployed, recovered = calculate_action_energy_delta(ActionType.HOLD, throttle=0.8, brake=0.0)
    assert 0.0 < deployed < 0.1
