import os
import pandas as pd
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from ai.src.data_processing import load_and_clean_data

def generate(year: int = 2023, event: str = 'Monza', session: str = 'R', driver: str = '1', lap_number: float = 5.0, out_filename: str = 'monza_2023_telemetry.csv') -> str:
    print(f"Loading FastF1 data for {year} {event} {session}...")
    sessions_config = [{'year': year, 'event': event, 'session': session}]
    df = load_and_clean_data(sessions_config)
    
    # FastF1 uses string IDs for drivers, '1' is Verstappen
    print(f"Filtering for driver '{driver}'...")
    driver_df = df[df['Driver'] == str(driver)].copy()
    
    if driver_df.empty:
        msg = f"Error: Empty dataframe for driver '{driver}'. Ensure FastF1 loaded correctly."
        print(msg)
        raise ValueError(msg)
        
    # Extract a single continuous lap to avoid Frankenstein data
    print(f"Filtering for continuous Lap {lap_number}...")
    lap_df = driver_df[driver_df['LapNumber'] == lap_number].copy()
    
    if lap_df.empty:
        # Fallback to the first available full lap if requested lap is missing
        fallback_lap = driver_df['LapNumber'].mode().iloc[0] if not driver_df.empty else 1.0
        print(f"Warning: Lap {lap_number} not found. Falling back to Lap {fallback_lap}.")
        lap_df = driver_df[driver_df['LapNumber'] == fallback_lap].copy()
        
    if lap_df.empty:
        msg = "Error: No valid laps found in the data."
        print(msg)
        raise ValueError(msg)
        
    lap_df['Time_s_int'] = lap_df['Time_s'].astype(int)
    grouped = lap_df.groupby('Time_s_int').first().reset_index()
    
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'backend', 'data')
    os.makedirs(output_dir, exist_ok=True)
    out_path = os.path.join(output_dir, out_filename)
    
    grouped.to_csv(out_path, index=False)
    print(f"Successfully wrote {len(grouped)} rows to {out_path}")
    return out_path

if __name__ == '__main__':
    generate()
