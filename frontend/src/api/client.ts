/**
 * SAZI API Client
 * Single source of truth for all backend communication.
 *
 * Base URL: VITE_API_BASE_URL env var, falling back to http://localhost:8000
 *
 * When the backend is not yet deployed, functions fall through to mock data.
 * Mock mode is clearly labeled in the UI via the `isMock` flag on responses.
 */

export const API_BASE_URL =
  ((import.meta as { env?: { VITE_BASE_URL?: string } }).env?.VITE_BASE_URL ??
  'http://localhost:8000').replace(/\/$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RaceState {
  lap: number;
  total_laps: number;
  position: number;
  speed_kph: number;
  ers_pct: number;          // 0–100
  gap_ahead_s: number;
  gap_behind_s: number;
  x?: number;
  y?: number;
  energy_deployed_mj: number;
  deployment_budget_mj: number;
  timestamp: number;
  // Optional telemetry extensions (auto-calculated when not provided by backend)
  engine_rpm?: number;      // Real-world F1 V6 Turbo Hybrid operating RPM (9,600 - 12,850 RPM; 4,200 idle)
  gear?: number;            // Transmission gear (1-8)
  tyre_deg_pct?: number;
  battery_soc_pct?: number;
  efficiency_pct?: number;
  discharge_rate_kw?: number;
  recharge_rate_kw?: number;
  battery_percent?: number;
  tire_wear_percent?: number;
}

export interface PredictResponse {
  action: 'OVERTAKE' | 'HOLD' | 'RECOVER';
  confidence: number;         // 0–1
  expected_energy_cost: number; // MJ
  reason: string;
  risk?: number;              // 0–1, optional
  reward?: number;            // 0–1, optional
  attack_opportunity_score?: number; // 0–1, optional
  rule_compliant: boolean;
  deployment_used_mj?: number;
  deployment_budget_mj?: number;
  violations?: number;
}

export interface SimulateResponse {
  telemetry: TelemetryPoint[];
  final_position: number;
  energy_remaining_pct: number;
  overtakes: number;
  rule_violations: number;
  decisions: DecisionPoint[];
}

export interface TelemetryPoint {
  lap: number;
  step: number;
  ers_pct: number;
  position: number;
  gap_ahead_s: number;
  gap_behind_s: number;
  speed_kph: number;
  energy_deployed_mj: number;
  engine_rpm?: number;
  gear?: number;
}

export interface DecisionPoint {
  lap: number;
  step: number;
  action: 'OVERTAKE' | 'HOLD' | 'RECOVER';
  confidence: number;
  rule_compliant: boolean;
  adjusted: boolean;
}

export interface ComparisonResponse {
  ml: SimulateResponse & { strategy_label: string };
  baseline: SimulateResponse & { strategy_label: string };
  divergence_lap?: number;
  ml_action_at_divergence?: string;
  baseline_action_at_divergence?: string;
  ml_reason?: string;
  baseline_reason?: string;
}

export interface HealthResponse {
  status: string;
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Public API functions ─────────────────────────────────────────────────────

/** Check if the backend is alive */
export async function checkHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/');
}

/** Get the current live race state */
export async function getRaceState(): Promise<RaceState> {
  return apiFetch<RaceState>('/race-state');
}

/** Get an ML prediction for the current race state */
export async function predict(raceState?: Partial<RaceState>): Promise<PredictResponse> {
  return apiFetch<PredictResponse>('/predict', {
    method: 'POST',
    body: JSON.stringify(raceState ?? {}),
  });
}

/** Run a full simulation */
export async function simulate(): Promise<SimulateResponse> {
  return apiFetch<SimulateResponse>('/simulate', { method: 'POST', body: '{}' });
}

/** Get simulation results */
export async function getResults(): Promise<SimulateResponse> {
  return apiFetch<SimulateResponse>('/results');
}

/** Get telemetry history */
export async function getTelemetry(): Promise<TelemetryPoint[]> {
  return apiFetch<TelemetryPoint[]>('/telemetry');
}

/** Run ML vs rule-based comparison */
export async function runComparison(): Promise<ComparisonResponse> {
  return apiFetch<ComparisonResponse>('/compare', { method: 'POST', body: '{}' });
}
