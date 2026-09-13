import os
import joblib
import pandas as pd
import numpy as np

# Load the model lazily
_model_artifact = None

def get_model():
    global _model_artifact
    if _model_artifact is None:
        model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models', 'xgb_model.joblib')
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model artifact not found at {model_path}. Run train.py first.")
        _model_artifact = joblib.load(model_path)
    return _model_artifact

def predict(race_state: dict) -> dict:
    """
    Predicts the optimal racing action based on the current race state.
    
    Args:
        race_state: A dictionary containing all necessary telemetry features.
    
    Returns:
        A dictionary containing action, confidence, expected_energy_cost, and reason.
    """
    artifact = get_model()
    pipeline = artifact['pipeline']
    le = artifact['label_encoder']
    features = artifact['features']
    
    # Adapt input to model features
    adapted_state = _adapt_state_for_model(race_state)
    
    # Prepare input DataFrame (handle missing keys by filling with safe defaults)
    input_data = {}
    for feature in features:
        input_data[feature] = [adapted_state.get(feature, 0.0)]
        
    df_input = pd.DataFrame(input_data)
    
    # Predict probabilities
    probs = pipeline.predict_proba(df_input)[0]
    
    # Get max probability and corresponding class
    max_prob_idx = np.argmax(probs)
    confidence = float(probs[max_prob_idx])
    action = le.inverse_transform([max_prob_idx])[0]
    
    # Energy cost estimation
    expected_energy_cost = _estimate_energy_cost(action, race_state)
    
    # Generate explanation (Reason)
    reason = _generate_reason(action, race_state)
    
    # Rule compliance metadata
    rule_compliant = True
    violation_reason = None
    enforced_action = None
    
    budget = race_state.get('deployment_budget_remaining_this_lap', 4.0)
    continuous_time = race_state.get('continuous_deployment_seconds', 0.0)
    
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
        "confidence": confidence,
        "expected_energy_cost": expected_energy_cost,
        "reason": reason,
        "rule_compliant": rule_compliant,
        "violation_reason": violation_reason,
        "enforced_action": enforced_action
    }

def _adapt_state_for_model(state: dict) -> dict:
    """Adapts simulator payload to match the model's required features."""
    adapted = {}
    
    # Direct mappings
    adapted['speed'] = state.get('speed', 0.0)
    adapted['throttle'] = state.get('throttle', 0.0)
    adapted['brake'] = state.get('brake', 0.0)
    adapted['gear'] = state.get('gear', 1)
    adapted['drs_available'] = int(state.get('drs_available', False))
    adapted['gap_ahead'] = state.get('gap_ahead', 10.0)
    adapted['gap_behind'] = state.get('gap_behind', 10.0)
    adapted['lap'] = state.get('lap', 1)
    adapted['closing_speed'] = state.get('closing_speed', 0.0)
    
    # Proxy/Renamed mappings
    adapted['ers_level'] = state.get('battery_level', state.get('ers_level', 50.0))
    
    # Derived composite scores
    gap = adapted['gap_ahead']
    cs = adapted['closing_speed']
    drs = adapted['drs_available']
    ers = adapted['ers_level']
    thr = adapted['throttle']
    brk = adapted['brake']
    lap = adapted['lap']
    
    adapted['attack_opportunity_score'] = (
        (1.0 if gap < 1.0 else 0.0) * 0.4 +
        (1.0 if cs > 0 else 0.0) * 0.2 +
        drs * 0.2 +
        (1.0 if ers > 50 else 0.0) * 0.2
    )
    
    adapted['recovery_opportunity_score'] = (
        brk * 0.5 +
        (1.0 - thr) * 0.3 +
        (1.0 if ers < 30 else 0.0) * 0.2
    )
    
    # Derived energy variables
    remaining_laps = max(1, 50 - lap)
    adapted['energy_per_remaining_lap'] = ers / remaining_laps
    adapted['energy_deployment'] = thr * 0.5 if (thr > 0.8 and adapted['speed'] > 200) else 0.0
    adapted['energy_recovery'] = brk * 0.8 if brk > 0 else 0.0
    
    # Optional defaults
    adapted['grid_energy_condition'] = 0.5
    
    # 6. Tyres and Weather
    compound_map = {'SOFT': 3.0, 'MEDIUM': 2.0, 'HARD': 1.0, 'UNKNOWN': 2.0, 'INTERMEDIATE': 4.0, 'WET': 5.0}
    adapted['Tyre_Compound_Encoded'] = compound_map.get(state.get('Compound', 'UNKNOWN'), 2.0)
    
    # Ensure numerical types for proxies
    tyre_life = float(state.get('TyreLife', 1.0))
    adapted['Tyre_Degradation_Proxy'] = tyre_life / adapted['Tyre_Compound_Encoded']
    
    adapted['Track_Temperature'] = float(state.get('TrackTemp', 35.0))
    # Is_Raining is derived from Rainfall boolean/numeric
    rainfall = state.get('Rainfall', False)
    adapted['Is_Raining'] = 1.0 if rainfall else 0.0
    
    # Track Position Normalized
    distance = float(state.get('Distance', 0.0))
    # Hardcode max distance for Monza ~5793m if not provided
    max_dist = 5793.0
    adapted['Track_Position_Normalized'] = distance / max_dist
    
    # 7. Opponent Advantage
    opp_compound = compound_map.get(state.get('Opponent_Compound', 'UNKNOWN'), 2.0)
    opp_tyre_life = float(state.get('Opponent_TyreLife', 1.0))
    
    opp_tyre_deg = opp_tyre_life / opp_compound
    adapted['Opponent_Tyre_Advantage'] = opp_tyre_deg - adapted['Tyre_Degradation_Proxy']
    
    # Opponent Speed
    adapted['Opponent_Speed'] = adapted['speed'] - adapted['closing_speed']
    
    # Modify Attack Score to consider Opponent Tyre Advantage
    adapted['attack_opportunity_score'] += (0.3 if adapted['Opponent_Tyre_Advantage'] > 0 else 0.0)
    
    return adapted

def _estimate_energy_cost(action: str, state: dict) -> float:
    """
    Deterministically estimate energy cost based on the predicted action.
    """
    if action == "OVERTAKE":
        return 0.35  # High cost
    elif action == "RECOVER":
        return -0.25 # Harvesting
    return 0.05      # Hold/neutral

def _generate_reason(action: str, state: dict) -> str:
    """
    Simple fallback reason generation if explain.py is not used directly.
    A more robust version uses SHAP in explain.py.
    """
    if action == "OVERTAKE":
        return f"Overtake recommended: gap ahead is {state.get('gap_ahead', 0):.2f}s and energy is sufficient."
    elif action == "RECOVER":
        return f"Recovery recommended: energy is low ({state.get('battery_level', state.get('ers_level', 0)):.1f}%)."
    return "Hold position recommended: conserve energy for later opportunities."
