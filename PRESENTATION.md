# 🏎️ F1 Energy Strategy Decision Engine

**An end-to-end, real-time ML decision engine and 3D telemetry visualization suite designed to optimize Formula 1 Energy Recovery System (ERS) deployment.**

---

## 🌟 Executive Summary

In modern Formula 1, managing the 160 HP (120 kW) electrical MGU-K energy over the course of a race is the difference between a podium finish and a mid-field struggle. Our hackathon project tackles this problem by combining **Real-time Machine Learning** with an **Immersive 3D Digital Twin** to calculate and visualize the optimal moment to strike, hold, or recover energy.

---

## 🛠️ System Architecture

Our solution is built across three decoupled, high-performance tiers:

### 1. 🧠 AI & Machine Learning (`/ai`)
A predictive engine trained to recommend tactical ERS modes (**OVERTAKE**, **HOLD**, **RECOVER**) on a lap-by-lap basis.
*   **Data Pipeline:** Leverages the `FastF1` library to ingest real-world historic telemetry data (e.g. 2023 Monza, Zandvoort).
*   **Feature Engineering:** Since real ERS data is proprietary, we synthetically map acceleration/throttle/braking signatures to proxy ERS depletion and recovery characteristics.
*   **Model:** A `RandomForestClassifier` handles the complex, non-linear relationships between track position, closing speed, battery State-of-Charge (SoC), and slipstream effects.
*   **Explainability:** Incorporates SHAP values (`src/explain.py`) to provide human-readable justification for every strategic recommendation.

### 2. ⚡ Streaming Backend (`/backend`)
A high-throughput telemetry simulation server.
*   **Framework:** Built on Python `FastAPI` and `uvicorn`.
*   **Stateful Simulation:** Tracks temporal data points such as battery degradation, MGU-K thermal load, and gap-to-car-ahead over time.
*   **Real-time WebSockets:** Pushes synchronous telemetry and ML classification updates to connected clients at high frequencies (60+ Hz).

### 3. 🏁 Interactive 3D Frontend (`/frontend`)
An ultra-smooth, WebGL-powered telemetry dashboard rendering live data directly onto a digital twin.
*   **Tech Stack:** React, TypeScript, Vite, and raw `Three.js` (no heavy abstraction libraries).
*   **Procedural Aerodynamics:** The F1 car model (Ferrari SF-25 spec) is procedurally constructed using segmented geometries (Monocoque, Nosecone, Sidepods, Rear Wing) to maintain low draw-calls and high FPS.
*   **Dynamic Exploded View:** Users can seamlessly trigger an "X-Ray" disassembly mode. The chassis expands outward in real-time, allowing engineers to peek under the hood at internal subsystems (MGU-K, radiators, suspension).
*   **Physical Telemetry Anchoring:** The UI overlays (Speed, Battery SoC, Gap Ahead) utilize `getWorldPosition()` dynamically, allowing the HUD stat-cards to perfectly track 3D meshes seamlessly as they disassemble or rotate.
*   **Overtake Simulation:** When the AI triggers an `OVERTAKE` recommendation, the 3D viewer simulates a full wheel-to-wheel passing maneuver in the slipstream complete with dynamic DRS actuation, wheel synchronization, and particle spark physics.

---

## 🚀 Key Technical Achievements

1.  **Zero-Jitter React/ThreeJS Bridge:** Bypassed React state reconciliation during the `requestAnimationFrame` loop, dynamically pushing telemetry direct to the DOM for perfect 60fps/120fps sync.
2.  **Robust Mesh Tracking:** Fixed severe camera-lag and CSS transform desyncs by shifting mesh `getWorldPosition()` logic to execute strictly *after* the `renderer.render()` cycle, guaranteeing perfectly accurate 3D-to-2D coordinates.
3.  **Real Data Integration:** Successfully integrated standard FastF1 telemetry into a usable, continuous real-time simulated stream.
4.  **Cinematic Transitions:** Developed smooth spherical damping interpolation (`THREE.MathUtils.damp`) to glide the camera between sub-system focus areas (Cockpit, Nose, Cooling, ERS).

---

## 🔮 Future Roadmap

*   **Live Broadcast Integration:** Adapt the WebSocket ingestion to handle live timing screens or direct UDP feeds from F1 games (like F1 23/F1 24).
*   **Advanced Degradation Models:** Implement non-linear tire thermal wear maps into the AI features.
*   **Driver Persona AI:** Train distinct models that mimic aggressive drivers (early energy deployment) versus smooth drivers (late race conservation).

---
*Created for the 2026 AI Hackathon.*
