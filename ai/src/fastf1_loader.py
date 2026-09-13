import os
import fastf1
import pandas as pd
import logging

logger = logging.getLogger(__name__)

# Configure FastF1 cache
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'cache')
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

def load_session_telemetry(year: int, event: str, session_type: str) -> pd.DataFrame:
    """
    Loads telemetry data for all drivers in a specified session.
    
    Args:
        year: The year of the championship (e.g., 2023)
        event: The event name or round number (e.g., 'Monza' or 14)
        session_type: The session type (e.g., 'R' for Race, 'Q' for Qualifying)
        
    Returns:
        A pandas DataFrame containing merged telemetry and lap context for all drivers.
    """
    logger.info(f"Loading FastF1 session: {year} {event} {session_type}")
    try:
        session = fastf1.get_session(year, event, session_type)
        session.load(telemetry=True, laps=True, weather=True, messages=False)
    except Exception as e:
        logger.error(f"Failed to load session {year} {event} {session_type}: {e}")
        raise

    all_telemetry = []

    for driver in session.drivers:
        try:
            laps = session.laps.pick_driver(driver)
            if laps.empty:
                continue
                
            # Get telemetry for the driver's laps
            telemetry = laps.get_telemetry()
            
            # Merge lap context into telemetry
            # We can use the 'LapNumber' from telemetry, or merge by distance/time
            # Fortunately, fastf1's get_telemetry on laps usually provides 'SessionTime'
            
            # Add driver identifier
            telemetry['Driver'] = driver
            telemetry['Year'] = year
            telemetry['Event'] = event
            
            # Merge with laps to get lap number and sector times if needed
            # fastf1 telemetry object typically has 'Source', 'Date', 'SessionTime', 'Time', 'Speed', 'RPM', 'Gear', etc.
            # To get LapNumber, we might need to map it based on time.
            
            # fastf1 `laps.get_telemetry()` might not inherently have LapNumber as a clean column for all rows in older versions,
            # but in recent versions, we can map LapNumber using SessionTime.
            # A simpler approach: iterate over laps to safely attach lap number.
            driver_telem_list = []
            for _, lap in laps.iterrows():
                lap_telem = lap.get_telemetry()
                lap_telem['Driver'] = driver
                lap_telem['Year'] = year
                lap_telem['Event'] = event
                lap_telem['LapNumber'] = lap['LapNumber']
                lap_telem['Sector1Time'] = lap['Sector1Time']
                lap_telem['Sector2Time'] = lap['Sector2Time']
                lap_telem['Sector3Time'] = lap['Sector3Time']
                lap_telem['LapTime'] = lap['LapTime']
                lap_telem['Compound'] = lap['Compound']
                lap_telem['TyreLife'] = lap['TyreLife']
                driver_telem_list.append(lap_telem)
                
            if driver_telem_list:
                driver_telemetry = pd.concat(driver_telem_list, ignore_index=True)
                all_telemetry.append(driver_telemetry)
                
        except Exception as e:
            logger.warning(f"Could not load telemetry for driver {driver}: {e}")

    if not all_telemetry:
        raise ValueError("No telemetry data could be loaded for the session.")
        
    final_df = pd.concat(all_telemetry, ignore_index=True)
    
    # Merge weather data
    if hasattr(session, 'weather_data') and not session.weather_data.empty:
        weather_df = session.weather_data[['Time', 'AirTemp', 'TrackTemp', 'Rainfall']].copy()
        weather_df = weather_df.rename(columns={'Time': 'SessionTime'})
        # Ensure sorted for merge_asof
        final_df = final_df.sort_values('SessionTime')
        weather_df = weather_df.sort_values('SessionTime')
        final_df = pd.merge_asof(final_df, weather_df, on='SessionTime', direction='backward')
    else:
        final_df['AirTemp'] = 25.0
        final_df['TrackTemp'] = 35.0
        final_df['Rainfall'] = False

    # Map Opponent Tyre Data
    # Create a lookup mapping from (Driver, LapNumber) -> (Compound, TyreLife)
    # We use drop_duplicates because there are many telemetry rows per lap
    tyre_lookup = final_df[['Driver', 'LapNumber', 'Compound', 'TyreLife']].drop_duplicates().set_index(['Driver', 'LapNumber'])
    
    def get_opponent_compound(row):
        driver_ahead = row['DriverAhead']
        if pd.isna(driver_ahead) or driver_ahead == '':
            return 'UNKNOWN'
        # Sometimes DriverAhead is a float string like '55.0' or just '55'
        # Ensure it's a string matching the driver list format
        if isinstance(driver_ahead, float):
            driver_ahead = str(int(driver_ahead))
        else:
            driver_ahead = str(driver_ahead).replace('.0', '')
            
        try:
            return tyre_lookup.loc[(driver_ahead, row['LapNumber']), 'Compound']
        except KeyError:
            return 'UNKNOWN'
            
    def get_opponent_tyrelife(row):
        driver_ahead = row['DriverAhead']
        if pd.isna(driver_ahead) or driver_ahead == '':
            return 0.0
            
        if isinstance(driver_ahead, float):
            driver_ahead = str(int(driver_ahead))
        else:
            driver_ahead = str(driver_ahead).replace('.0', '')
            
        try:
            return tyre_lookup.loc[(driver_ahead, row['LapNumber']), 'TyreLife']
        except KeyError:
            return 0.0

    logger.info("Mapping opponent tyre data...")
    final_df['Opponent_Compound'] = final_df.apply(get_opponent_compound, axis=1)
    final_df['Opponent_TyreLife'] = final_df.apply(get_opponent_tyrelife, axis=1)

    return final_df
