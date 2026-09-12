import pytest
import pandas as pd
import numpy as np

from src.data_processing import clean_telemetry
from src.feature_engineering import engineer_features
from src.labeling import generate_labels
from src.predict import _estimate_energy_cost, _generate_reason
from src.baseline import predict_baseline

def test_clean_telemetry():
    # Mock data
    df = pd.DataFrame({
        'Speed': [300, -10, 0],
        'Throttle': [100, -5, 120],
        'Brake': [0, 150, -10],
        'nGear': [8, 1, 0],
        'RPM': [11000, 1000, 0],
        'Time': pd.to_timedelta([1, 2, 3], unit='s'),
        'Driver': ['VER', 'VER', 'VER'],
        'Year': [2023]*3,
        'Event': ['Monza']*3
    })
    
    cleaned = clean_telemetry(df)
    
    assert cleaned['Speed'].min() >= 0
    assert cleaned['Throttle'].min() >= 0
    assert cleaned['Throttle'].max() <= 100
    assert cleaned['Brake'].min() >= 0
    assert cleaned['Brake'].max() <= 100
    assert 'Time_s' in cleaned.columns

def test_engineer_features():
    df = pd.DataFrame({
        'Speed': [300, 150],
        'Throttle': [100, 0],
        'Brake': [0, 100],
        'nGear': [8, 3],
        'DRS': [10, 0],
        'LapNumber': [1, 1],
        'Time_s': [1.0, 2.0],
        'Driver': ['VER', 'VER'],
        'Year': [2023, 2023],
        'Event': ['Monza', 'Monza']
    })
    
    features = engineer_features(df)
    
    assert 'ers_level' in features.columns
    assert 'gap_ahead' in features.columns
    assert 'attack_opportunity_score' in features.columns
    assert features['speed'].iloc[0] == 300
    assert features['drs_available'].iloc[0] == 1

def test_generate_labels():
    df = pd.DataFrame({
        'attack_opportunity_score': [0.9, 0.1, 0.1],
        'recovery_opportunity_score': [0.1, 0.9, 0.1],
        'ers_level': [80, 10, 50],
        'gap_ahead': [0.5, 5.0, 2.0],
        'closing_speed': [10, -5, 0]
    })
    
    labeled = generate_labels(df)
    
    # 1st row: strong attack, high energy -> OVERTAKE
    assert labeled['action'].iloc[0] == 'OVERTAKE'
    
    # 2nd row: strong recovery, low energy -> RECOVER
    assert labeled['action'].iloc[1] == 'RECOVER'
    
    # 3rd row: average stats -> HOLD
    assert labeled['action'].iloc[2] == 'HOLD'

def test_baseline():
    race_state = {
        'gap_ahead': 0.5,
        'ers_level': 80,
        'drs_available': 1,
        'closing_speed': 5.0
    }
    result = predict_baseline(race_state)
    assert result['action'] == 'OVERTAKE'
    
    race_state['ers_level'] = 10
    result = predict_baseline(race_state)
    assert result['action'] == 'RECOVER'

def test_predict_reason():
    state = {'gap_ahead': 0.5, 'ers_level': 80}
    reason = _generate_reason('OVERTAKE', state)
    assert '0.5' in reason
    
    reason = _generate_reason('RECOVER', state)
    assert '80.0' in reason
