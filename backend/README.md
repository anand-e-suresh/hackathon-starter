# AI Motorsport Intelligence — Backend & Simulator Engine

Real-time F1 energy deployment strategy decision engine, FIA technical regulation compliance validator, and dual-car race simulator.

---

## 1. System Architecture

```
F1 Telemetry (Synthetic)
    │
    ▼
[backend/schemas.py] ──> Standardized Telemetry Vector & Contracts
    │
    ├──> [backend/ml_adapter.py] ──> Intelligent ML Classifier / Baseline
    │                                  (Recommends: OVERTAKE | HOLD | RECOVER)
    │
    ├──> [backend/rules.py]      ──> FIA Technical Rule Compliance Engine
    │                                  (Enforces 4.0 MJ/lap cap, burst duration)
    │
    ├──> [backend/energy_model.py]──> F1 ERS Energy Accounting Model
    │                                  (Strict physical bounds [0.0, 4.0 MJ])
    │
    └──> [backend/simulator.py]  ──> Multi-Lap Race Simulator
                                       (Synchronized ML vs Baseline side-by-side)
```

---

## 2. Quickstart & Running Locally

### Prerequisites
- Python 3.12+

### Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### Run the API Server
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive Swagger / OpenAPI documentation is immediately available at:
👉 **`http://localhost:8000/docs`**

### Run Automated Unit & Integration Tests
```bash
pytest backend/tests/
```
All 23 test suites pass in < 0.3 seconds.

---

## 3. REST API Endpoints & Sample `curl` Commands

### 3.1 Health Check (`GET /health`)
```bash
curl -X GET "http://localhost:8000/health"
```
**Response:**
```json
{
  "status": "healthy",
  "service": "motorsport-intelligence-backend",
  "version": "1.0.0"
}
```

---

### 3.2 Real-Time Decision Engine (`POST /predict`)
Evaluates the current F1 telemetry state and recommends an energy deployment mode.
- **ML Strategy**: Evaluates with lap-budget and burst-duration awareness.
- **Baseline Strategy**: Add `?use_baseline=true` to evaluate with the naive heuristic.

```bash
curl -X POST "http://localhost:8000/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "speed": 305.4,
    "throttle": 1.0,
    "brake": 0.0,
    "gear": 8,
    "drs_available": true,
    "drs_active": true,
    "battery_level": 65.0,
    "energy_deployment": 0.35,
    "energy_recovery": 0.0,
    "gap_ahead": 0.75,
    "gap_behind": 2.4,
    "lap": 10,
    "sector": 1,
    "lap_time": 35.8,
    "closing_speed": 4.5,
    "deployment_budget_remaining_this_lap": 2.8,
    "continuous_deployment_seconds": 1.0,
    "time_since_last_deployment": 8.0
  }'
```
**Response:**
```json
{
  "action": "OVERTAKE",
  "confidence": 0.91,
  "expected_energy_cost": 0.35,
  "reason": "Car ahead within attack range (0.75s) with closing speed (4.5 m/s) and legal lap budget (2.80 MJ).",
  "rule_compliant": true,
  "violation_reason": null,
  "enforced_action": null
}
```

---

### 3.3 Full Multi-Lap Race Simulation (`POST /simulate`)
Runs both the **ML Strategy** and **Rule-Based Baseline** on identical track conditions for N laps.

```bash
curl -X POST "http://localhost:8000/simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "total_laps": 5,
    "steps_per_lap": 20,
    "initial_battery_pct": 70.0,
    "initial_gap_ahead": 1.5,
    "random_seed": 42
  }'
```
**Response includes:**
- `steps`: Step-by-step timeseries comparing `ml_speed`, `ml_battery_pct`, `ml_decision` side-by-side with `baseline_speed`, `baseline_battery_pct`, `baseline_decision`.
- `ml_metrics`: Aggregated overtakes, lap time, battery %, and rule violation count for ML.
- `baseline_metrics`: Aggregated metrics for naive baseline.
- `comparison_summary`: Human-readable executive summary.

---

### 3.4 Live Telemetry Snapshot (`GET /telemetry`)
Provides instantaneous telemetry for frontend gauges (speedometer, battery bar, DRS indicator).

```bash
curl -X GET "http://localhost:8000/telemetry"
```

---

### 3.5 Live Race State (`GET /race-state`)
Current position, gaps, active lap, sector, and recommendation for live dashboard polling.

```bash
curl -X GET "http://localhost:8000/race-state"
```

---

### 3.6 Aggregated Strategy Scorecard (`GET /results`)
Returns the latest comparative scorecard and FIA compliance metrics.

```bash
curl -X GET "http://localhost:8000/results"
```
**Sample Output:**
```json
{
  "total_laps": 5,
  "total_steps": 100,
  "ml_strategy": {
    "strategy_name": "ML Motorsport Intelligence",
    "total_overtakes": 2,
    "positions_gained": 2,
    "final_position": 2,
    "average_lap_time_s": 89.2,
    "final_battery_pct": 68.4,
    "energy_efficiency_score": 7.45,
    "rule_violations_count": 0
  },
  "baseline_strategy": {
    "strategy_name": "Rule-Based Baseline",
    "total_overtakes": 1,
    "positions_gained": 1,
    "final_position": 3,
    "average_lap_time_s": 90.1,
    "final_battery_pct": 21.0,
    "energy_efficiency_score": 5.61,
    "rule_violations_count": 3
  },
  "comparison_summary": "ML Strategy achieved 2 overtakes with 0 rule violations, retaining 68.4% battery. Baseline accumulated 3 FIA deployment-limit violations due to lack of lap-budget awareness."
}
```

---

## 4. Integration Guide

### For Person 1 (ML / AI Owner):
- Plug your model into `backend/ml_adapter.py`.
- Expose a `predict(state: dict) -> dict` function returning `action`, `confidence`, `expected_energy_cost`, and `reason`.
- Set `USE_REAL_ML_MODEL=true` in `.env`.

### For Person 3 (Frontend / Dashboard Owner):
- The backend has `CORSMiddleware` enabled for all origins.
- Point your dashboard at `http://localhost:8000`.
- Call `POST /simulate` to fetch both ML and Baseline curves for side-by-side charts.
- Poll `GET /telemetry` or `GET /race-state` every 500ms for live telemetry gauges.
- Display `rule_violations_count` from `GET /results` as a prominent differentiator metric.
