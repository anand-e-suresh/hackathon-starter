def predict_baseline(race_state: dict) -> dict:
    """
    Rule-based strategy decision engine.
    This acts as a deterministic baseline to compare against the ML model.
    """
    gap_ahead = race_state.get('gap_ahead', 10.0)
    ers_level = race_state.get('battery_level', race_state.get('ers_level', 50.0))
    drs_available = race_state.get('drs_available', 0)
    closing_speed = race_state.get('closing_speed', 0.0)
    
    action = "HOLD"
    reason = "Maintaining position to conserve energy."
    expected_energy_cost = 0.05
    
    if gap_ahead < 1.0 and drs_available and ers_level > 30 and closing_speed > 0:
        action = "OVERTAKE"
        reason = "Gap is small, DRS is available, and closing speed is positive. Deploying energy to overtake."
        expected_energy_cost = 0.40
    elif ers_level < 20:
        action = "RECOVER"
        reason = "Energy is critically low. Harvesting required."
        expected_energy_cost = -0.20
        
    budget = race_state.get('deployment_budget_remaining_this_lap', 4.0)
    continuous_time = race_state.get('continuous_deployment_seconds', 0.0)
    
    rule_compliant = True
    violation_reason = None
    enforced_action = None
    
    if action == "OVERTAKE":
        if continuous_time >= 5.0:
            rule_compliant = False
            violation_reason = "FIA limit reached: Max 5.0s continuous deployment."
            enforced_action = "HOLD"
        elif expected_energy_cost > budget:
            rule_compliant = False
            violation_reason = f"FIA budget exceeded: Requires {expected_energy_cost}MJ, but only {budget:.2f}MJ remains."
            enforced_action = "HOLD"
            
    return {
        "action": action,
        "confidence": 1.0,  # Baseline is fully deterministic
        "expected_energy_cost": expected_energy_cost,
        "reason": reason,
        "rule_compliant": rule_compliant,
        "violation_reason": violation_reason,
        "enforced_action": enforced_action
    }
