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
const TOTAL_LAPS = 52; // Silverstone Grand Prix race distance (5.891 km x 52 laps = 306.198 km)
const BUDGET_MJ = 4.0;  // FIA Technical Regulation Article 5.2.2 max per-lap ERS deployment limit

// Active strategy action to synchronize battery deployment and recovery with AI strategy
let _lastAction: PredictResponse['action'] = 'HOLD';

export function resetMockState() {
  _lap = 1;
  _pos = 7;
  _ers = 72;
  _gapAhead = 1.2;
  _gapBehind = 0.8;
  _speed = 285;
  _energyDeployed = 0.6;
  _lastAction = 'HOLD';
}

export function setPredictedAction(action: PredictResponse['action']) {
  _lastAction = action;
}

export function generateRaceState(): RaceState {
  // Determine driving mode from current speed dynamics & active AI strategy
  const isHighThrottle = _speed > 280;
  const isBraking = _speed < 245;

  // Real-world Formula 1 ERS Energy Dynamics (FIA Article 5.2.2: 4.00 MJ usable battery capacity):
  // 1. When overtaking / attacking (high speed & full throttle deployment):
  //    MGU-K discharges at peak 120 kW (160 BHP) -> Battery clearly decreases (-3.0% to -6.5% per tick)
  //    Energy deployed increases up towards 4.00 MJ budget.
  // 2. When braking / regenerating (corners, decel, RECOVER mode):
  //    MGU-K captures kinetic energy at up to 120 kW regen -> Battery clearly increases (+2.5% to +5.5% per tick)
  // 3. When holding / tactical cruising:
  //    Gentle drift balancing high-speed drag against MGU-H turbo thermal recovery (-0.5% to +0.5%)
  if (_lastAction === 'OVERTAKE' || isHighThrottle || _speed > 300) {
    // Aggressive attack / overtake discharge
    const dischargeDelta = rand(3.2, 5.8);
    _ers = clamp(_ers - dischargeDelta, 6, 100);
    _energyDeployed = clamp(_energyDeployed + rand(0.18, 0.35), 0, BUDGET_MJ);
  } else if (_lastAction === 'RECOVER' || isBraking || _speed < 245) {
    // Deceleration / Kinetic braking regeneration (MGU-K 120 kW + MGU-H heat harvest)
    const regenDelta = rand(2.8, 5.2);
    _ers = clamp(_ers + regenDelta, 6, 98);
  } else {
    // Tactical hold / cruise: slight balanced thermal drift
    _ers = clamp(_ers + rand(-0.8, 0.4), 6, 100);
    _energyDeployed = clamp(_energyDeployed + rand(0.01, 0.04), 0, BUDGET_MJ);
  }

  // Drift gaps and speeds realistically along racing line
  _gapAhead = clamp(_gapAhead + rand(-0.15, 0.15), 0.1, 4.0);
  _gapBehind = clamp(_gapBehind + rand(-0.1, 0.1), 0.05, 5.0);
  _speed = clamp(_speed + rand(-8, 8), 240, 335);

  const dischargeKw = (_lastAction === 'OVERTAKE' || isHighThrottle) ? 120.0 : isBraking ? 0.0 : 42.5;
  const rechargeKw = (_lastAction === 'RECOVER' || isBraking) ? 120.0 : isHighThrottle ? 0.0 : 35.0;
  const tyreDeg = clamp(parseFloat(((_lap * 0.42) + 5.8).toFixed(1)), 5.0, 95.0);
  const efficiency = parseFloat((94.2 + rand(-0.4, 0.4)).toFixed(1));

  // Real-world Formula 1 1.6L V6 Turbo Hybrid gear & RPM calculation
  // F1 gear ratios (8-speed seamless shift transmission):
  // Gear 1: 0–95 km/h, Gear 2: 75–125 km/h, Gear 3: 115–165 km/h, Gear 4: 155–208 km/h,
  // Gear 5: 198–252 km/h, Gear 6: 242–292 km/h, Gear 7: 282–324 km/h, Gear 8: 314–355+ km/h
  let currentGear = 7;
  let gearMinV = 282;
  let gearMaxV = 324;
  if (_speed < 95) {
    currentGear = 1; gearMinV = 0; gearMaxV = 95;
  } else if (_speed < 125) {
    currentGear = 2; gearMinV = 75; gearMaxV = 125;
  } else if (_speed < 165) {
    currentGear = 3; gearMinV = 115; gearMaxV = 165;
  } else if (_speed < 208) {
    currentGear = 4; gearMinV = 155; gearMaxV = 208;
  } else if (_speed < 252) {
    currentGear = 5; gearMinV = 198; gearMaxV = 252;
  } else if (_speed < 292) {
    currentGear = 6; gearMinV = 242; gearMaxV = 292;
  } else if (_speed < 324) {
    currentGear = 7; gearMinV = 282; gearMaxV = 324;
  } else {
    currentGear = 8; gearMinV = 314; gearMaxV = 355;
  }

  // Real-world F1 operating RPM: 9,600 RPM to 12,850 RPM (FIA 100 kg/h fuel limit at 10,500; peak shift at 12,850 RPM)
  const gearSpan = Math.max(1, gearMaxV - gearMinV);
  const gearRatio = clamp((_speed - gearMinV) / gearSpan, 0, 1);
  const engineRpm = Math.round(9600 + gearRatio * (12850 - 9600));

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
    engine_rpm: engineRpm,
    gear: currentGear,
    tyre_deg_pct: tyreDeg,
    battery_soc_pct: Math.round(_ers),
    efficiency_pct: efficiency,
    discharge_rate_kw: dischargeKw,
    recharge_rate_kw: rechargeKw,
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
    'Hangar Straight DRS enabled + MGU-K 120kW attack mode active. Delta to VER: -0.34s.',
    'Optimal ERS deploy window out of Chapel: 334 km/h speed trap advantage into Stowe.',
    'Battery SOC at 76%. High deployment budget remaining (2.85 MJ) for Wellington Straight overtake.',
    'Slipstream delta -0.42s detected behind NOR. Full 160 BHP hybrid boost deployed into Brooklands.',
  ],
  HOLD: [
    'Turbulent dirty air in Maggotts-Becketts complex (-18% downforce). Holding energy reserve at 3.12 MJ.',
    'Preserving rear Pirelli C3 tire thermals (104°C). Conserving deployment budget for Hangar Straight DRS.',
    'Maintaining 1.2s tactical gap to manage battery core temperatures (52°C) and avoid thermal derate.',
    'Deployment budget limited (0.85 MJ remaining). Holding position until Sector 1 recovery phase.',
  ],
  RECOVER: [
    'MGU-K kinetic energy harvesting (+85 kW) active under -4.8G braking into Brooklands & Vale chicane.',
    'Battery state of charge depleted below 32%. Regenerating 0.45 MJ before Wellington Straight.',
    'Lift-and-coast strategy activated into Turn 15 to maintain FIA Article 5.2.2 compliance (4.0 MJ/lap).',
    'MGU-H heat recovery charging accumulator to rebuild strategic deployment quota for final laps.',
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

  // Update lastAction to drive corresponding MGU-K battery decrease/increase
  _lastAction = action;

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

    const simSpeed = Math.round(rand(260, 325));
    const simGear = simSpeed < 282 ? 6 : simSpeed < 320 ? 7 : 8;
    const simGearMin = simGear === 6 ? 242 : simGear === 7 ? 282 : 314;
    const simGearMax = simGear === 6 ? 292 : simGear === 7 ? 324 : 355;
    const simRatio = clamp((simSpeed - simGearMin) / (simGearMax - simGearMin), 0, 1);
    const simRpm = Math.round(9600 + simRatio * (12850 - 9600));

    telemetry.push({
      lap,
      step,
      ers_pct: Math.round(ers),
      position: pos,
      gap_ahead_s: parseFloat(gapAhead.toFixed(2)),
      gap_behind_s: parseFloat(rand(0.3, 2.5).toFixed(2)),
      speed_kph: simSpeed,
      energy_deployed_mj: parseFloat(Math.min(energyDeployed, BUDGET_MJ).toFixed(2)),
      engine_rpm: simRpm,
      gear: simGear,
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
