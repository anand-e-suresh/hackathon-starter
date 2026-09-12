"""
Main FastAPI Application Entrypoint
AI Motorsport Intelligence Engine
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import predict

app = FastAPI(
    title="AI Motorsport Intelligence API",
    description="Real-time F1 energy deployment decision engine and race simulator balancing speed against battery longevity and FIA rule compliance.",
    version="1.0.0"
)

# Enable CORS for frontend integration (React / Vite / Next.js on port 3000 or 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(predict.router)


@app.get("/", tags=["System"])
def read_root():
    return {
        "service": "AI Motorsport Intelligence API",
        "status": "operational",
        "docs_url": "/docs"
    }


@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "service": "motorsport-intelligence-backend",
        "version": "1.0.0"
    }