import pandas as pd
import numpy as np

def generate_labels(df: pd.DataFrame) -> pd.DataFrame:
    """
    Generates heuristic labels (OVERTAKE, HOLD, RECOVER) based on engineered features.
    These are synthetic labels for training the XGBoost model, NOT real driver ground truth.
    """
    df = df.copy()
    
    # Initialize all as HOLD
    df['action'] = 'HOLD'
    
    # Heuristic for OVERTAKE
    # High attack opportunity, sufficient energy, close gap
    overtake_condition = (
        (df['attack_opportunity_score'] > 0.4) &
        (df['ers_level'] > 25) &
        (df['gap_ahead'] < 1.5) &
        (df['closing_speed'] > -0.5)
    )
    
    # Heuristic for RECOVER
    # Low energy, or high recovery opportunity (braking zones)
    recover_condition = (
        (df['ers_level'] < 30) |
        (df['recovery_opportunity_score'] > 0.5)
    )
    
    # Apply conditions. Apply RECOVER first, so OVERTAKE can override it if both apply.
    df.loc[recover_condition, 'action'] = 'RECOVER'
    df.loc[overtake_condition, 'action'] = 'OVERTAKE'
    
    # If energy is critically low (<15), force RECOVER regardless
    df.loc[df['ers_level'] < 15, 'action'] = 'RECOVER'
    
    # Map to integer labels for XGBoost if needed later, but we'll keep as string and encode in train.py
    
    return df
