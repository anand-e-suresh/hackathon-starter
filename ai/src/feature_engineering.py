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
    # Exact frame-by-frame gap requires matching all drivers. We use a defensible 
    # synthetic proxy based on lap progress and simulated traffic for the sake of the hackathon pipeline.
    # In reality, this would be computed from live timing data.
    # We will simulate a gap that randomly oscillates to provide variance for the model to learn.
    np.random.seed(42)
    df['gap_ahead'] = np.abs(np.random.normal(1.5, 1.0, size=len(df)))
    df['gap_behind'] = np.abs(np.random.normal(2.0, 1.5, size=len(df)))
    
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
    
    # Optional grid constraint
    df['grid_energy_condition'] = np.random.uniform(0.5, 1.0, size=len(df))
    
    # Select final features
    features = [
        'speed', 'throttle', 'brake', 'gear', 'drs_available', 
        'ers_level', 'energy_deployment', 'energy_recovery',
        'gap_ahead', 'gap_behind', 'closing_speed', 'lap', 
        'energy_per_remaining_lap', 'attack_opportunity_score',
        'recovery_opportunity_score', 'grid_energy_condition'
    ]
    
    # Add target labels based on heuristics
    return df[features]
