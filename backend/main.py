"""
Main FastAPI Application Entrypoint
AI Motorsport Intelligence Engine
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import predict, simulate, telemetry, race_state, results, simulation_ws, sessions

app = FastAPI(
    title="AI Motorsport Intelligence API",
    description=(
        "Real-time F1 energy deployment decision engine and race simulator. "
        "Balances immediate overtake opportunities against long-term battery management "
        "and strict FIA rule compliance."
    ),
    version="1.0.0"
)

# Enable CORS for frontend integration (React, Next.js, Vite on ports 3000, 5173, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all endpoint routers
app.include_router(predict.router)
app.include_router(simulate.router)
app.include_router(telemetry.router)
app.include_router(race_state.router)
app.include_router(results.router)
app.include_router(simulation_ws.router)
app.include_router(sessions.router)


@app.get("/", tags=["System"])
def read_root():
    return {
        "service": "AI Motorsport Intelligence API",
        "status": "operational",
        "version": "1.0.0",
        "docs_url": "/docs",
        "endpoints": {
            "predict": "POST /predict",
            "simulate": "POST /simulate",
            "telemetry": "GET /telemetry",
            "race_state": "GET /race-state",
            "results": "GET /results",
            "health": "GET /health"
        }
    }


@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "service": "motorsport-intelligence-backend",
        "version": "1.0.0"
    }