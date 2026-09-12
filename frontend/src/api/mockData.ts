/**
 * SAZI Mock Data Layer
 *
 * ⚠️  DEMO / MOCK DATA — Backend not yet connected.
 * All data here is synthetic, generated for this demo.
 *
 * This module is the ONLY place mock data lives.
 * When Person 2's backend is ready, replace the callers
 * in hooks/ to use api/client.ts instead.
 */

import type {
  RaceState,
  PredictResponse,
  TelemetryPoint,
  DecisionPoint,
  SimulateResponse,
  ComparisonResponse,
} from './client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

const rand = (min: number, max: number) =>
  Math.random() * (max - min) + min;

// ─── Race state generator ─────────────────────────────────────────────────────

let _lap = 1;
let _pos = 7;
let _ers = 72;
let _gapAhead = 1.2;
let _gapBehind = 0.8;
let _speed = 285;
let _energyDeployed = 0.6;
const TOTAL_LAPS = 57;
const BUDGET_MJ = 4.0;

export function resetMockState() {
  _lap = 1;
  _pos = 7;
  _ers = 72;
  _gapAhead = 1.2;
  _gapBehind = 0.8;
  _speed = 285;
  _energyDeployed = 0.6;
}

export function generateRaceState(): RaceState {
  // Drift values slightly each tick
  _ers = clamp(_ers + rand(-2, 1), 5, 100);
  _gapAhead = clamp(_gapAhead + rand(-0.15, 0.15), 0.1, 4.0);
  _gapBehind = clamp(_gapBehind + rand(-0.1, 0.1), 0.05, 5.0);
  _speed = clamp(_speed + rand(-8, 8), 240, 330);
  _energyDeployed = clamp(_energyDeployed + rand(0, 0.08), 0, BUDGET_MJ);

  return {
    lap: _lap,
    total_laps: TOTAL_LAPS,
    position: _pos,
    speed_kph: Math.round(_speed),
    ers_pct: Math.round(_ers),
    gap_ahead_s: parseFloat(_gapAhead.toFixed(2)),
    gap_behind_s: parseFloat(_gapBehind.toFixed(2)),
    energy_deployed_mj: parseFloat(_energyDeployed.toFixed(2)),
    deployment_budget_mj: BUDGET_MJ,
    timestamp: Date.now(),
  };
}

export function advanceLap() {
  if (_lap < TOTAL_LAPS) {
    _lap++;
    // Occasionally improve position
    if (Math.random() < 0.15 && _pos > 1) _pos--;
  }
}

// ─── Prediction generator ─────────────────────────────────────────────────────

const ACTIONS: PredictResponse['action'][] = ['OVERTAKE', 'HOLD', 'RECOVER'];
const REASONS: Record<PredictResponse['action'], string[]> = {
  OVERTAKE: [
    'Car ahead is within attack range and sufficient ERS is available.',
    'Gap ahead is below 1.0s — optimal overtake window detected.',
    'High deployment budget remaining. Attack opportunity is high.',
  ],
  HOLD: [
    'ERS reserves are insufficient for a clean overtake attempt.',
    'Gap ahead is closing but deployment budget is limited.',
    'Maintain position — pace delta does not justify energy expenditure.',
  ],
  RECOVER: [
    'ERS critically low — recovery phase required to restore deployment capacity.',
    'Battery below 30% — prioritise regeneration to preserve strategic options.',
    'Energy conservation mode activated to rebuild deployment budget.',
  ],
};

export function generatePrediction(state: RaceState): PredictResponse {
  let action: PredictResponse['action'];
  if (state.ers_pct > 60 && state.gap_ahead_s < 1.0) {
    action = 'OVERTAKE';
  } else if (state.ers_pct < 30) {
    action = 'RECOVER';
  } else {
    action = ACTIONS[Math.floor(Math.random() * 3)];
  }

  const reasons = REASONS[action];
  const reason = reasons[Math.floor(Math.random() * reasons.length)];
  const confidence = action === 'OVERTAKE'
    ? parseFloat(rand(0.78, 0.95).toFixed(2))
    : parseFloat(rand(0.65, 0.88).toFixed(2));

  const energyCost = action === 'OVERTAKE'
    ? parseFloat(rand(0.28, 0.45).toFixed(2))
    : action === 'RECOVER'
    ? 0
    : parseFloat(rand(0.05, 0.15).toFixed(2));

  const budgetUsed = parseFloat(Math.min(state.energy_deployed_mj, BUDGET_MJ).toFixed(2));
  const budgetLeft = parseFloat(Math.max(0, BUDGET_MJ - budgetUsed).toFixed(2));

  return {
    action,
    confidence,
    expected_energy_cost: energyCost,
    reason,
    risk: parseFloat(rand(0.2, 0.7).toFixed(2)),
    reward: parseFloat(rand(0.4, 0.9).toFixed(2)),
    attack_opportunity_score: action === 'OVERTAKE'
      ? parseFloat(rand(0.65, 0.95).toFixed(2))
      : parseFloat(rand(0.1, 0.4).toFixed(2)),
    rule_compliant: budgetUsed < BUDGET_MJ,
    deployment_used_mj: budgetUsed,
    deployment_budget_mj: budgetLeft,
    violations: budgetUsed >= BUDGET_MJ ? 1 : 0,
  };
}

// ─── Full simulation ──────────────────────────────────────────────────────────

function buildSimulation(
  startErs: number,
  strategy: 'ml' | 'baseline'
): SimulateResponse {
  const telemetry: TelemetryPoint[] = [];
  const decisions: DecisionPoint[] = [];

  let ers = startErs;
  let pos = 7;
  let gapAhead = 1.5;
  let energyDeployed = 0;
  let violations = 0;
  let overtakes = 0;

  for (let lap = 1; lap <= 57; lap++) {
    const step = lap;
    let action: DecisionPoint['action'];

    if (strategy === 'ml') {
      // ML: smarter deployment
      if (ers > 55 && gapAhead < 1.0) {
        action = 'OVERTAKE';
      } else if (ers < 28) {
        action = 'RECOVER';
      } else {
        action = 'HOLD';
      }
    } else {
      // Rule-based baseline: simple threshold
      action = ers > 50 && gapAhead < 1.2 ? 'OVERTAKE' : ers < 20 ? 'RECOVER' : 'HOLD';
    }

    const conf = strategy === 'ml'
      ? parseFloat(rand(0.72, 0.96).toFixed(2))
      : parseFloat(rand(0.55, 0.75).toFixed(2));

    let adjusted = false;

    if (action === 'OVERTAKE') {
      const cost = parseFloat(rand(0.25, 0.42).toFixed(2));
      energyDeployed += cost;
      ers = clamp(ers - rand(8, 15), 5, 100);
      if (energyDeployed > BUDGET_MJ) {
        adjusted = true;
        violations++;
        action = 'HOLD';
        energyDeployed = BUDGET_MJ;
      } else {
        if (Math.random() < (strategy === 'ml' ? 0.65 : 0.45) && pos > 1) {
          pos--;
          overtakes++;
          gapAhead = rand(0.8, 2.0);
        }
      }
    } else if (action === 'RECOVER') {
      ers = clamp(ers + rand(10, 22), 0, 100);
      gapAhead = clamp(gapAhead + rand(0, 0.2), 0.1, 5);
    } else {
      ers = clamp(ers - rand(1, 4), 0, 100);
      gapAhead = clamp(gapAhead + rand(-0.1, 0.1), 0.1, 5);
    }

    telemetry.push({
      lap,
      step,
      ers_pct: Math.round(ers),
      position: pos,
      gap_ahead_s: parseFloat(gapAhead.toFixed(2)),
      gap_behind_s: parseFloat(rand(0.3, 2.5).toFixed(2)),
      speed_kph: Math.round(rand(260, 325)),
      energy_deployed_mj: parseFloat(Math.min(energyDeployed, BUDGET_MJ).toFixed(2)),
    });

    decisions.push({
      lap,
      step,
      action,
      confidence: conf,
      rule_compliant: !adjusted,
      adjusted,
    });
  }

  return {
    telemetry,
    decisions,
    final_position: pos,
    energy_remaining_pct: Math.round(ers),
    overtakes,
    rule_violations: violations,
  };
}

export function generateSimulation(): SimulateResponse {
  return buildSimulation(72, 'ml');
}

export function generateComparison(): ComparisonResponse {
  resetMockState();
  const mlResult = buildSimulation(72, 'ml');
  resetMockState();
  const baselineResult = buildSimulation(72, 'baseline');

  // Find first divergence
  let divergenceLap: number | undefined;
  for (let i = 0; i < mlResult.decisions.length; i++) {
    if (mlResult.decisions[i].action !== baselineResult.decisions[i].action) {
      divergenceLap = mlResult.decisions[i].lap;
      break;
    }
  }

  return {
    ml: { ...mlResult, strategy_label: 'ML Strategy' },
    baseline: { ...baselineResult, strategy_label: 'Rule Baseline' },
    divergence_lap: divergenceLap,
    ml_action_at_divergence:
      divergenceLap != null
        ? mlResult.decisions.find((d) => d.lap === divergenceLap)?.action
        : undefined,
    baseline_action_at_divergence:
      divergenceLap != null
        ? baselineResult.decisions.find((d) => d.lap === divergenceLap)?.action
        : undefined,
    ml_reason:
      'Attack opportunity detected with sufficient deployment budget remaining.',
    baseline_reason:
      'Gap above threshold — conservative hold decision applied.',
  };
}
