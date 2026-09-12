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
        session.load(telemetry=True, laps=True, weather=False, messages=False)
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
                driver_telem_list.append(lap_telem)
                
            if driver_telem_list:
                driver_telemetry = pd.concat(driver_telem_list, ignore_index=True)
                all_telemetry.append(driver_telemetry)
                
        except Exception as e:
            logger.warning(f"Could not load telemetry for driver {driver}: {e}")

    if not all_telemetry:
        raise ValueError("No telemetry data could be loaded for the session.")
        
    return pd.concat(all_telemetry, ignore_index=True)
