import asyncio
import logging
from fastapi import APIRouter, status, HTTPException
from pydantic import BaseModel

from ...scripts.generate_telemetry_csv import generate
from state_store import RaceStateStore

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Sessions"])

class LoadSessionRequest(BaseModel):
    year: int = 2023
    event: str = "Monza"
    session: str = "R"
    driver: str = "1"
    lap_number: float = 5.0

class LoadSessionResponse(BaseModel):
    status: str
    message: str
    csv_file: str

@router.post(
    "/load-session",
    response_model=LoadSessionResponse,
    status_code=status.HTTP_200_OK,
    summary="Dynamically load a FastF1 Session"
)
async def load_session(request: LoadSessionRequest = LoadSessionRequest()):
    logger.info(f"Loading session data for {request.year} {request.event} {request.session}")
    
    out_filename = f"{request.event.lower()}_{request.year}_telemetry.csv".replace(" ", "_")
    
    try:
        # Run the heavy FastF1 data ingestion in a separate thread so we don't block Uvicorn
        out_path = await asyncio.to_thread(
            generate,
            year=request.year,
            event=request.event,
            session=request.session,
            driver=request.driver,
            lap_number=request.lap_number,
            out_filename=out_filename
        )
        
        # Now hot-reload the simulator memory
        simulator = RaceStateStore.get_simulator()
        simulator.load_session(out_filename)
        
        return LoadSessionResponse(
            status="success",
            message=f"Successfully loaded and mounted {out_filename}",
            csv_file=out_filename
        )
        
    except Exception as e:
        logger.error(f"Failed to load session: {e}")
        raise HTTPException(status_code=500, detail=str(e))
