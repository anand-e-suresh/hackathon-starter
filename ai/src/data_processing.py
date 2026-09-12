import pandas as pd
import logging
from src.fastf1_loader import load_session_telemetry

logger = logging.getLogger(__name__)

def load_and_clean_data(sessions_config: list) -> pd.DataFrame:
    """
    Loads and cleans data for multiple sessions.
    
    Args:
        sessions_config: List of dicts, e.g., [{'year': 2023, 'event': 'Monza', 'session': 'R'}]
        
    Returns:
        Cleaned pandas DataFrame containing concatenated telemetry.
    """
    all_data = []
    
    for config in sessions_config:
        try:
            df = load_session_telemetry(
                year=config['year'], 
                event=config['event'], 
                session_type=config['session']
            )
            all_data.append(df)
        except Exception as e:
            logger.error(f"Error processing {config}: {e}")
            
    if not all_data:
        raise ValueError("No data could be loaded from the provided configurations.")
        
    raw_df = pd.concat(all_data, ignore_index=True)
    return clean_telemetry(raw_df)

def clean_telemetry(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans raw FastF1 telemetry data.
    """
    # Make a copy to avoid SettingWithCopyWarning
    df = df.copy()
    
    # 1. Drop rows with missing crucial telemetry
    df = df.dropna(subset=['Speed', 'Throttle', 'Brake', 'nGear', 'RPM', 'Time'])
    
    # 2. Convert Time to total seconds for easier manipulation
    df['Time_s'] = df['Time'].dt.total_seconds()
    
    # 3. Sort chronologically per session and driver
    df = df.sort_values(by=['Year', 'Event', 'Driver', 'Time_s']).reset_index(drop=True)
    
    # 4. Cap impossible values (e.g., speed < 0)
    df.loc[df['Speed'] < 0, 'Speed'] = 0
    df.loc[df['Throttle'] < 0, 'Throttle'] = 0
    df.loc[df['Throttle'] > 100, 'Throttle'] = 100
    df.loc[df['Brake'] < 0, 'Brake'] = 0
    df.loc[df['Brake'] > 100, 'Brake'] = 100
    
    return df
