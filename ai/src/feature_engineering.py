import pandas as pd
import numpy as np

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Engineers features from cleaned FastF1 telemetry.
    """
    df = df.copy()
    
    # 1. Direct Features Mapping
    df['speed'] = df['Speed']
    df['throttle'] = df['Throttle'] / 100.0
    df['brake'] = df['Brake'] / 100.0
    df['gear'] = df['nGear']
    
    # DRS available proxy: FastF1 DRS > 8 usually means DRS is open/available
    if 'DRS' in df.columns:
        df['drs_available'] = (df['DRS'] >= 8).astype(int)
    else:
        df['drs_available'] = 0
        
    df['lap'] = df['LapNumber']
    
    # 2. ERS / Energy Proxy
    # Since real battery telemetry is not public, we create a synthetic proxy.
    # Energy drains when throttle is high and speed is high.
    # Energy recovers when braking.
    
    def simulate_energy(group):
        energy = np.zeros(len(group))
        current_energy = 100.0  # start at 100%
        
        # Deployment is roughly proportional to throttle at high speed
        deployment = np.where((group['throttle'] > 0.8) & (group['speed'] > 200), group['throttle'] * 0.5, 0.0)
        # Recovery is proportional to brake
        recovery = np.where(group['brake'] > 0, group['brake'] * 0.8, 0.0)
        
        for i in range(len(group)):
            current_energy = current_energy - deployment[i] + recovery[i]
            current_energy = max(0.0, min(100.0, current_energy))
            energy[i] = current_energy
            
        group['ers_level'] = energy
        group['energy_deployment'] = deployment
        group['energy_recovery'] = recovery
        return group
        
    # Apply energy simulation per driver, per event
    # Using sort_values ensures temporal order is maintained
    df = df.groupby(['Year', 'Event', 'Driver'], group_keys=False).apply(simulate_energy)
    
    # 3. Gap & Closing Speed Approximation
    # Convert FastF1 spatial distance (meters) to temporal gap (seconds).
    # Speed is in km/h, convert to m/s.
    speed_ms = (df['speed'] / 3.6).replace(0, 0.1)
    
    # DistanceToDriverAhead is provided by FastF1. If missing or NaN, assume a safe 50 meters.
    distance_ahead = df.get('DistanceToDriverAhead', 50.0).fillna(50.0)
    
    # Calculate real gap based on physics
    df['gap_ahead'] = distance_ahead / speed_ms
    
    # We don't have native rear-radar telemetry in this slice, so assign a neutral 2.0s baseline
    df['gap_behind'] = 2.0
    
    # Closing speed (m/s) = change in gap over time
    # Proxy: negative change in gap means closing in
    df['gap_ahead_diff'] = df.groupby(['Year', 'Event', 'Driver'])['gap_ahead'].diff().fillna(0)
    df['time_diff'] = df.groupby(['Year', 'Event', 'Driver'])['Time_s'].diff().fillna(0.1)
    df['time_diff'] = df['time_diff'].replace(0, 0.1)
    df['closing_speed'] = -(df['gap_ahead_diff'] / df['time_diff'])
    
    # 4. Energy per remaining lap
    # Assume 50 laps total for proxy calculation
    max_laps = 50 
    df['remaining_laps'] = np.maximum(1, max_laps - df['lap'])
    df['energy_per_remaining_lap'] = df['ers_level'] / df['remaining_laps']
    
    # 5. Attack and Recovery Opportunity Scores
    # Attack: small gap ahead, positive closing speed, drs available, high energy
    df['attack_opportunity_score'] = (
        (df['gap_ahead'] < 1.0).astype(float) * 0.4 +
        (df['closing_speed'] > 0).astype(float) * 0.2 +
        df['drs_available'] * 0.2 +
        (df['ers_level'] > 50).astype(float) * 0.2
    )
    
    # Recovery: high brake, low throttle, low energy
    df['recovery_opportunity_score'] = (
        df['brake'] * 0.5 +
        (1.0 - df['throttle']) * 0.3 +
        (df['ers_level'] < 30).astype(float) * 0.2
    )
    
    # Optional grid constraint: proxy based on lap progress rather than random noise
    df['grid_energy_condition'] = 1.0 - (df['lap'] / 50.0).clip(0, 1)
    
    # 6. Tyres and Weather
    compound_map = {'SOFT': 3.0, 'MEDIUM': 2.0, 'HARD': 1.0, 'UNKNOWN': 2.0, 'INTERMEDIATE': 4.0, 'WET': 5.0}
    df['Tyre_Compound_Encoded'] = df.get('Compound', 'UNKNOWN').map(compound_map).fillna(2.0)
    df['Opponent_Compound_Encoded'] = df.get('Opponent_Compound', 'UNKNOWN').map(compound_map).fillna(2.0)
    
    # Tyre Degradation Proxy = TyreLife / GripFactor
    df['Tyre_Degradation_Proxy'] = df.get('TyreLife', 1.0) / df['Tyre_Compound_Encoded']
    
    df['Track_Temperature'] = df.get('TrackTemp', 35.0).astype(float)
    df['Is_Raining'] = df.get('Rainfall', False).astype(float)
    
    # Track Position Normalized
    if 'Distance' in df.columns:
        max_dist = df.groupby(['Year', 'Event'])['Distance'].transform('max')
        df['Track_Position_Normalized'] = df['Distance'] / max_dist.replace(0, 1)
    else:
        df['Track_Position_Normalized'] = 0.5

    # 7. Opponent Advantage
    df['Opponent_Tyre_Degradation'] = df.get('Opponent_TyreLife', 1.0) / df['Opponent_Compound_Encoded']
    df['Opponent_Tyre_Advantage'] = df['Opponent_Tyre_Degradation'] - df['Tyre_Degradation_Proxy']
    
    # Opponent Speed
    df['Opponent_Speed'] = df['speed'] - df['closing_speed']
    
    # Modify Attack Score to consider Opponent Tyre Advantage
    df['attack_opportunity_score'] += (df['Opponent_Tyre_Advantage'] > 0).astype(float) * 0.3

    # Select final features
    features = [
        'speed', 'throttle', 'brake', 'gear', 'drs_available', 
        'ers_level', 'energy_deployment', 'energy_recovery',
        'gap_ahead', 'gap_behind', 'closing_speed', 'lap', 
        'energy_per_remaining_lap', 'attack_opportunity_score',
        'recovery_opportunity_score', 'grid_energy_condition',
        'Track_Temperature', 'Is_Raining', 'Tyre_Compound_Encoded',
        'Tyre_Degradation_Proxy', 'Track_Position_Normalized',
        'Opponent_Speed', 'Opponent_Tyre_Advantage'
    ]
    
    # Add target labels based on heuristics
    return df[features]
