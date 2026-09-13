import asyncio
import logging
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from state_store import RaceStateStore
from schemas import SimulationControlCommand, SimulationStatusResponse

logger = logging.getLogger(__name__)

router = APIRouter()
active_websockets: List[WebSocket] = []
_simulation_task = None

async def broadcast_message(message: dict):
    """Sends a JSON message to all connected clients."""
    for ws in list(active_websockets):
        try:
            await ws.send_json(message)
        except Exception:
            active_websockets.remove(ws)

async def simulation_loop():
    """Background task that ticks the simulator and broadcasts state."""
    logger.info("Starting background simulation loop.")
    simulator = RaceStateStore.get_simulator()
    
    try:
        while True:
            # If no clients are connected, sleep longer to save CPU
            if not active_websockets:
                await asyncio.sleep(0.5)
                continue
                
            if simulator.status == "RUNNING":
                simulator.step()
                state = simulator.get_state()
                await broadcast_message(state.model_dump())
                
                # Base sleep is 1 second, modified by playback_speed
                sleep_time = 1.0 / max(0.1, simulator.playback_speed)
                await asyncio.sleep(sleep_time)
            else:
                await asyncio.sleep(0.5)
                
    except asyncio.CancelledError:
        logger.info("Simulation loop cancelled.")
    except Exception as e:
        logger.error(f"Error in simulation loop: {e}")
        simulator.status = "ERROR"

@router.on_event("startup")
async def startup_event():
    global _simulation_task
    if _simulation_task is None:
        _simulation_task = asyncio.create_task(simulation_loop())

@router.websocket("/ws/simulation")
async def websocket_simulation(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    simulator = RaceStateStore.get_simulator()
    
    # Send initial state immediately
    await websocket.send_json(SimulationStatusResponse(status=simulator.status).model_dump())
    if simulator.status in ["RUNNING", "PAUSED", "STOPPED"]:
        await websocket.send_json(simulator.get_state().model_dump())
        
    try:
        while True:
            # Wait for control commands from frontend
            data = await websocket.receive_json()
            cmd = SimulationControlCommand(**data)
            cmd_type = cmd.type.upper()
            
            if cmd_type == "START":
                simulator.start()
                await broadcast_message(SimulationStatusResponse(status=simulator.status).model_dump())
            elif cmd_type == "PAUSE":
                simulator.pause()
                await broadcast_message(SimulationStatusResponse(status=simulator.status).model_dump())
            elif cmd_type == "RESUME":
                simulator.resume()
                await broadcast_message(SimulationStatusResponse(status=simulator.status).model_dump())
            elif cmd_type == "STOP":
                simulator.stop()
                await broadcast_message(SimulationStatusResponse(status=simulator.status).model_dump())
            elif cmd_type == "RESET":
                simulator.reset()
                await broadcast_message(SimulationStatusResponse(status=simulator.status).model_dump())
                await broadcast_message(simulator.get_state().model_dump())
            elif cmd_type == "SPEED" and cmd.speed is not None:
                simulator.playback_speed = float(cmd.speed)
                
    except WebSocketDisconnect:
        if websocket in active_websockets:
            active_websockets.remove(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if websocket in active_websockets:
            active_websockets.remove(websocket)
