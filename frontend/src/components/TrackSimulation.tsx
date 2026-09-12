/**
 * TrackSimulation.tsx
 * Ultra-Realistic 2D Grand Prix Live Circuit Simulation with 3D-styled F1 Cars & Advanced Telemetry.
 *
 * Explicit telemetry features:
 * - Throttle Inputs & Brake Inputs (live percentages, pedal bars, and telemetry trace)
 * - Gear Change Statistics (gear 1-8, upshift/downshift indicators, and total shifts/lap)
 * - Comprehensive DRS Intelligence (wing state, speed delta +12.8kph, drag reduction, gap threshold)
 * - Detailed ERS Hybrid Power (MGU-K deployment kW, battery storage %, FIA 4MJ budget, regeneration)
 * - F1 TV Broadcast Onboard Telemetry Halo Graphic floating on circuit canvas
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import { Zap, Eye, Flag, ChevronDown, ChevronUp, Gauge, Wind, ArrowUp, ArrowDown, Timer, BatteryMedium, Disc, Cpu, RefreshCw } from 'lucide-react';
import type { RaceState, PredictResponse } from '../api/client';
import './TrackSimulation.css';

interface Props {
  raceState: RaceState | null;
  prediction: PredictResponse | null;
  isRunning: boolean;
  isSimpleMode?: boolean;
  onToggleUiMode?: () => void;
}

// Circuit dimensions
const TRACK_WIDTH = 1000;
const TRACK_HEIGHT = 480;

// Grand Prix Circuit SVG Path (Smooth continuous closed racing loop)
const CIRCUIT_PATH =
  'M 220 410 ' +
  'L 740 410 ' +
  'C 840 410, 910 370, 910 290 ' +
  'C 910 210, 840 170, 770 170 ' +
  'L 680 170 ' +
  'C 630 170, 610 120, 650 80 ' +
  'C 680 50, 650 30, 590 30 ' +
  'L 260 30 ' +
  'C 180 30, 120 70, 120 140 ' +
  'C 120 210, 180 230, 260 230 ' +
  'L 450 230 ' +
  'C 510 230, 530 280, 480 320 ' +
  'C 440 340, 380 340, 310 340 ' +
  'L 220 340 ' +
  'C 140 340, 90 370, 110 405 ' +
  'C 125 410, 160 410, 220 410 Z';

// Apex curb locations
const CURBS = [
  { x: 740, y: 402, w: 70, h: 16, rot: 5 },
  { x: 902, y: 275, w: 16, h: 80, rot: 0 },
  { x: 765, y: 160, w: 60, h: 16, rot: 0 },
  { x: 640, y: 70, w: 45, h: 16, rot: -30 },
  { x: 250, y: 18, w: 75, h: 16, rot: 0 },
  { x: 108, y: 125, w: 16, h: 70, rot: 0 },
  { x: 445, y: 218, w: 60, h: 16, rot: 0 },
  { x: 475, y: 310, w: 50, h: 16, rot: 40 },
  { x: 105, y: 395, w: 45, h: 16, rot: -15 },
];

// Silverstone Grand Prix Circuit Telemetry Waypoints
interface TrackWaypoint {
  p: number;
  speed: number;    // calibrated speed in km/h
  throttle: number; // 0 to 100
  brake: number;    // 0 to 100
  latG: number;     // lateral G force
}

const CIRCUIT_WAYPOINTS: TrackWaypoint[] = [
  { p: 0.00, speed: 268, throttle: 100, brake: 0,  latG: 0.2 }, // Hamilton Straight
  { p: 0.12, speed: 320, throttle: 100, brake: 0,  latG: 0.3 }, // Approach Abbey
  { p: 0.16, speed: 275, throttle: 80,  brake: 12, latG: 3.2 }, // Abbey Turn 1
  { p: 0.21, speed: 250, throttle: 55,  brake: 25, latG: 2.8 }, // Farm Turn 2
  { p: 0.25, speed: 170, throttle: 0,   brake: 90, latG: 1.4 }, // Heavy braking into Village
  { p: 0.27, speed: 88,  throttle: 15,  brake: 60, latG: 2.2 }, // The Loop hairpin
  { p: 0.31, speed: 118, throttle: 85,  brake: 0,  latG: 1.8 }, // Aintree exit
  { p: 0.36, speed: 245, throttle: 100, brake: 0,  latG: 0.3 }, // Wellington Straight
  { p: 0.39, speed: 308, throttle: 100, brake: 0,  latG: 0.2 }, // End Wellington Straight
  { p: 0.42, speed: 165, throttle: 0,   brake: 88, latG: 1.5 }, // Brooklands braking
  { p: 0.46, speed: 128, throttle: 55,  brake: 15, latG: 3.1 }, // Luffield cornering
  { p: 0.49, speed: 175, throttle: 90,  brake: 0,  latG: 2.4 }, // Woodcote exit
  { p: 0.55, speed: 292, throttle: 100, brake: 0,  latG: 0.4 }, // Approach Copse
  { p: 0.58, speed: 282, throttle: 88,  brake: 8,  latG: 5.1 }, // Copse Corner
  { p: 0.63, speed: 260, throttle: 78,  brake: 18, latG: 4.6 }, // Maggotts
  { p: 0.67, speed: 212, throttle: 65,  brake: 28, latG: 4.2 }, // Becketts
  { p: 0.71, speed: 248, throttle: 95,  brake: 0,  latG: 2.1 }, // Chapel exit
  { p: 0.77, speed: 318, throttle: 100, brake: 0,  latG: 0.2 }, // Hangar Straight
  { p: 0.83, speed: 336, throttle: 100, brake: 0,  latG: 0.2 }, // End Hangar Straight
  { p: 0.86, speed: 182, throttle: 0,   brake: 94, latG: 2.6 }, // Stowe braking
  { p: 0.90, speed: 92,  throttle: 0,   brake: 96, latG: 1.6 }, // Vale Chicane
  { p: 0.93, speed: 138, throttle: 85,  brake: 0,  latG: 2.9 }, // Club entry
  { p: 0.97, speed: 235, throttle: 100, brake: 0,  latG: 1.1 }, // Club exit onto straight
];

export default function TrackSimulation({
  raceState,
  prediction,
  isRunning,
  isSimpleMode = false,
  onToggleUiMode,
}: Props) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [totalLength, setTotalLength] = useState<number>(1);
  const [carProgress, setCarProgress] = useState<number>(0.15); // 0 to 1
  const [cameraFollow, setCameraFollow] = useState<boolean>(false);
  const [showDetailedStats, setShowDetailedStats] = useState<boolean>(true);
  const [overtakeProgress, setOvertakeProgress] = useState<number>(-1.0); // -1.0 = trailing in slipstream, 0 = wheel-to-wheel, +1.0 = ahead of rival

  // Measure path length on mount
  useEffect(() => {
    if (pathRef.current) {
      setTotalLength(pathRef.current.getTotalLength());
    }
  }, []);

  // Update car progress and overtake dynamics continuously when running
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (isRunning) {
        const speedKph = raceState?.speed_kph ?? 285;
        const speedDelta = (speedKph / 300) * 0.045 * dt;
        setCarProgress((prev) => (prev + speedDelta) % 1);

        // Overtake vs energy preservation dynamics
        const isOvertakeMode = prediction?.action === 'OVERTAKE';
        const targetOvertake = isOvertakeMode ? 1.0 : -1.0;
        const transitionSpeed = isOvertakeMode ? 0.38 : 0.42; // ~2.5s to complete pass or tuck back

        setOvertakeProgress((prev) => {
          if (prev < targetOvertake) {
            return Math.min(targetOvertake, prev + transitionSpeed * dt);
          } else if (prev > targetOvertake) {
            return Math.max(targetOvertake, prev - transitionSpeed * dt);
          }
          return prev;
        });
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, raceState, prediction]);

  // Compute positions & heading angles for cars with realistic overtaking lanes
  const carState = useMemo(() => {
    if (!pathRef.current || totalLength <= 1) {
      return {
        sazi: { x: 400, y: 410, angle: 0, latOffset: 0 },
        rival: { x: 470, y: 410, angle: 0, latOffset: 0 },
        field: { x: 260, y: 30, angle: 180 },
      };
    }

    const path = pathRef.current;

    // Base battle position along the Silverstone lap
    const rivalBaseDist = (carProgress * totalLength) % totalLength;

    // SAZI's longitudinal distance relative to rival:
    // When overtakeProgress = -1.0: trailing by ~24m (-0.038 of circuit)
    // When overtakeProgress = 0.0: side-by-side wheel-to-wheel
    // When overtakeProgress = +1.0: leading by ~24m (+0.038 of circuit)
    const saziRelativeDelta = overtakeProgress * 0.038;
    const saziDist = ((carProgress + saziRelativeDelta + 1) * totalLength) % totalLength;

    // Lateral steering offset (perpendicular to racing line):
    // When cars are within passing proximity (|overtakeProgress| < 0.75), SAZI dives inside (-8.5px), rival holds outside (+4.0px)
    const proximity = Math.max(0, 1 - Math.abs(overtakeProgress) / 0.75);
    const saziLatOffset = -proximity * 8.5; // Inside lane dive
    const rivalLatOffset = proximity * 4.0; // Outside defense line

    // SAZI point & normal vector
    const p1 = path.getPointAtLength(saziDist);
    const p2 = path.getPointAtLength((saziDist + 2) % totalLength);
    const saziRad = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const saziAngle = saziRad * (180 / Math.PI);
    const snx = -Math.sin(saziRad);
    const sny = Math.cos(saziRad);
    const saziX = p1.x + snx * saziLatOffset;
    const saziY = p1.y + sny * saziLatOffset;

    // Rival point & normal vector
    const rp1 = path.getPointAtLength(rivalBaseDist);
    const rp2 = path.getPointAtLength((rivalBaseDist + 2) % totalLength);
    const rivalRad = Math.atan2(rp2.y - rp1.y, rp2.x - rp1.x);
    const rivalAngle = rivalRad * (180 / Math.PI);
    const rnx = -Math.sin(rivalRad);
    const rny = Math.cos(rivalRad);
    const rivalX = rp1.x + rnx * rivalLatOffset;
    const rivalY = rp1.y + rny * rivalLatOffset;

    // Midfield car
    const fieldDist = ((carProgress - 0.24 + 1) * totalLength) % totalLength;
    const fp1 = path.getPointAtLength(fieldDist);
    const fp2 = path.getPointAtLength((fieldDist + 2) % totalLength);
    const fieldAngle = Math.atan2(fp2.y - fp1.y, fp2.x - fp1.x) * (180 / Math.PI);

    return {
      sazi: { x: saziX, y: saziY, angle: saziAngle, latOffset: saziLatOffset },
      rival: { x: rivalX, y: rivalY, angle: rivalAngle, latOffset: rivalLatOffset },
      field: { x: fp1.x, y: fp1.y, angle: fieldAngle },
    };
  }, [carProgress, totalLength, overtakeProgress]);

  // Telemetry attributes
  const action = prediction?.action ?? 'HOLD';
  const ers = raceState?.ers_pct ?? 65;
  const gapAhead = raceState?.gap_ahead_s ?? 1.34;
  const currentLap = raceState?.lap ?? 1;
  const totalLaps = raceState?.total_laps ?? 57;

  // Sector calculation
  const sector = carProgress < 0.35 ? 'SECTOR 1' : carProgress < 0.72 ? 'SECTOR 2' : 'SECTOR 3';
  const isDrsZone = carProgress > 0.88 || carProgress < 0.14;
  const isDrsActive = isDrsZone && (action === 'OVERTAKE' || gapAhead <= 1.0);

  // Dynamic Telemetry: Throttle, Brake, Gear, Shifts, RPM, G-Force based on realistic Silverstone circuit profile
  const telemetryDynamics = useMemo(() => {
    if (!isRunning) {
      return {
        speed: raceState?.speed_kph ?? 0,
        throttle: 0,
        brake: 0,
        gear: 1,
        rpm: 4200,
        activeLeds: 0,
        latG: 0,
        lonG: 0,
        brakeTemp: 450,
        shiftState: 'NEUTRAL' as const,
        totalShifts: 0,
      };
    }

    // Find enclosing waypoints along Silverstone circuit
    const n = CIRCUIT_WAYPOINTS.length;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      if (CIRCUIT_WAYPOINTS[i].p <= carProgress) {
        idx = i;
      }
    }
    const nextIdx = (idx + 1) % n;
    const w0 = CIRCUIT_WAYPOINTS[idx];
    const w1 = CIRCUIT_WAYPOINTS[nextIdx];

    let span = w1.p - w0.p;
    if (span <= 0) span += 1;
    let offset = carProgress - w0.p;
    if (offset < 0) offset += 1;
    const t = Math.max(0, Math.min(1, offset / span));
    const s = 0.5 - 0.5 * Math.cos(t * Math.PI);

    let speed = Math.round(w0.speed + (w1.speed - w0.speed) * s);
    let throttle = Math.round(w0.throttle + (w1.throttle - w0.throttle) * s);
    let brake = Math.round(w0.brake + (w1.brake - w0.brake) * s);
    const latG = parseFloat((w0.latG + (w1.latG - w0.latG) * s).toFixed(1));

    if (isDrsActive && throttle > 90) {
      speed += 12;
    }

    const speedDelta = w1.speed - w0.speed;
    const isAccelerating = speedDelta >= 0;
    const lonG = parseFloat((isAccelerating ? Math.min(2.4, (throttle / 100) * 2.2) : -Math.min(5.2, (brake / 100) * 5.0)).toFixed(1));

    // Gear envelopes for authentic progressive rev build-up & shift points
    const GEARS_ACCEL = [
      { gear: 2, vMin: 72,  vMax: 118 },
      { gear: 3, vMin: 110, vMax: 158 },
      { gear: 4, vMin: 150, vMax: 202 },
      { gear: 5, vMin: 194, vMax: 248 },
      { gear: 6, vMin: 238, vMax: 288 },
      { gear: 7, vMin: 278, vMax: 320 },
      { gear: 8, vMin: 310, vMax: 350 },
    ];

    const GEARS_DECEL = [
      { gear: 2, vMin: 70,  vMax: 110 },
      { gear: 3, vMin: 100, vMax: 150 },
      { gear: 4, vMin: 140, vMax: 195 },
      { gear: 5, vMin: 185, vMax: 240 },
      { gear: 6, vMin: 230, vMax: 280 },
      { gear: 7, vMin: 270, vMax: 315 },
      { gear: 8, vMin: 305, vMax: 350 },
    ];

    const gears = isAccelerating ? GEARS_ACCEL : GEARS_DECEL;
    let gInfo = gears[0];
    for (let i = 0; i < gears.length; i++) {
      if (speed >= gears[i].vMin) {
        gInfo = gears[i];
      }
    }

    const revRatio = Math.max(0, Math.min(1, (speed - gInfo.vMin) / (gInfo.vMax - gInfo.vMin)));

    // Accurate 15-LED progressive activation (all 15 light up sequentially until upshift)
    let activeLeds = Math.min(15, Math.floor(revRatio * 15.8));
    let rpm = Math.round(9800 + revRatio * 3050);
    let shiftState: 'UPSHIFT' | 'DOWNSHIFT' | 'HOLD' | 'NEUTRAL' = 'HOLD';

    if (isAccelerating) {
      if (activeLeds >= 14 || revRatio >= 0.93) {
        shiftState = 'UPSHIFT';
        activeLeds = 15; // Max out at shift point
      } else {
        shiftState = 'HOLD';
      }
    } else {
      if (brake > 35) {
        shiftState = 'DOWNSHIFT';
        // Throttle blip on downshift (realistic F1 rev match)
        rpm = 10800 + ((gInfo.gear % 2) * 500);
        activeLeds = gInfo.gear % 2 === 0 ? 8 : 7;
      }
    }

    const brakeTemp = brake > 50 ? 840 : 640;
    const totalShifts = Math.min(52, Math.max(6, Math.round(50 * (carProgress || 0.1))));

    return {
      speed,
      throttle,
      brake,
      gear: gInfo.gear,
      rpm,
      activeLeds,
      latG,
      lonG,
      brakeTemp,
      shiftState,
      totalShifts,
    };
  }, [carProgress, isDrsActive, isRunning, raceState?.speed_kph]);

  const speed = isRunning ? telemetryDynamics.speed : (raceState?.speed_kph ?? 0);
  const activeLeds = telemetryDynamics.activeLeds;

  // Dynamic SVG ViewBox for Camera Follow Mode
  const viewBox = cameraFollow
    ? `${Math.max(0, Math.min(carState.sazi.x - 220, TRACK_WIDTH - 440))} ${Math.max(0, Math.min(carState.sazi.y - 150, TRACK_HEIGHT - 300))} 440 300`
    : `0 0 ${TRACK_WIDTH} ${TRACK_HEIGHT}`;

  // ── Advanced Telemetry Derivations ──────────────────────────────────────────
  // 1. Tyre Degradation (Silverstone front-right loaded)
  const tyreDeg = raceState?.tyre_deg_pct ?? Math.min(88, parseFloat((((currentLap - 1) + carProgress) * 0.42 + 5.8).toFixed(1)));
  const flDeg = Math.min(95, parseFloat((tyreDeg * 0.96).toFixed(1)));
  const frDeg = Math.min(98, parseFloat((tyreDeg * 1.18).toFixed(1))); // Silverstone high-load front right
  const rlDeg = Math.min(90, parseFloat((tyreDeg * 0.88).toFixed(1)));
  const rrDeg = Math.min(92, parseFloat((tyreDeg * 0.94).toFixed(1)));
  const gripRemaining = Math.max(68, parseFloat((100 - tyreDeg * 0.52).toFixed(1)));

  // 2. Battery Percent Left & Usable Energy
  const batteryPercentLeft = raceState?.battery_soc_pct ?? Math.round(ers);
  const usableBatteryMj = ((batteryPercentLeft / 100) * 4.0).toFixed(2);
  const boostTimeRemainingS = ((batteryPercentLeft / 100 * 4000) / 120).toFixed(1);

  // 3. Discharge & Recharge Rates
  const isHighThrottle = telemetryDynamics.throttle > 80;
  const isBraking = telemetryDynamics.brake > 40;

  const dischargeRateKw = action === 'OVERTAKE' || isHighThrottle
    ? (raceState?.discharge_rate_kw ?? 120.0)
    : isBraking
    ? 0.0
    : 38.5;

  const rechargeRateKw = action === 'RECOVER' || isBraking
    ? (raceState?.recharge_rate_kw ?? 120.0)
    : isHighThrottle
    ? 0.0
    : 32.0;

  const netPowerFlowKw = rechargeRateKw - dischargeRateKw; // Negative = Discharging, Positive = Recharging

  // 4. Efficiency
  const ersEfficiency = raceState?.efficiency_pct ?? 94.2;
  const iceThermalEfficiency = 51.8;
  const aiDeploymentOptimality = 96.5;
  const kineticHarvestEfficiency = 89.4;

  return (
    <div className={`track-sim track-sim--${action.toLowerCase()}`} role="region" aria-label="Live 2D Track Simulation">
      {/* ── Top Header / HUD Bar ────────────────────────────────────────── */}
      <div className="track-sim__header">
        <div className="track-sim__title-group">
          <div className="track-sim__live-badge">
            <span className={`track-sim__pulse-dot ${isRunning ? 'track-sim__pulse-dot--active' : ''}`} />
            LIVE 2D CIRCUIT
          </div>
          <span className="track-sim__circuit-name">
            SILVERSTONE GRAND PRIX CIRCUIT • UK • 5.891 KM • LAP RECORD: 1:27.097 (M. VERSTAPPEN)
          </span>
        </div>

        {/* Primary telemetry pills */}
        <div className="track-sim__hud-metrics">
          <div className="track-sim__hud-item">
            <span className="track-sim__hud-label"><Flag size={9} /> LAP</span>
            <span className="track-sim__hud-val">{currentLap}<small>/{totalLaps}</small></span>
          </div>

          {/* Detailed Sector & Mini Inputs (Hidden in Simple Mode) */}
          {!isSimpleMode && (
            <>
              <div className="track-sim__hud-item">
                <span className="track-sim__hud-label">SECTOR</span>
                <span className="track-sim__hud-val track-sim__hud-sector">{sector}</span>
              </div>

              {/* Throttle & Brake quick gauge */}
              <div className="track-sim__hud-item">
                <span className="track-sim__hud-label">INPUTS (THR/BRK)</span>
                <div className="track-sim__hud-inputs-mini">
                  <div className="track-sim__mini-bar-track">
                    <div className="track-sim__mini-bar-fill track-sim__mini-bar-fill--thr" style={{ height: `${telemetryDynamics.throttle}%` }} />
                  </div>
                  <div className="track-sim__mini-bar-track">
                    <div className="track-sim__mini-bar-fill track-sim__mini-bar-fill--brk" style={{ height: `${telemetryDynamics.brake}%` }} />
                  </div>
                  <span className="track-sim__mini-text mono">
                    T:<strong>{telemetryDynamics.throttle}%</strong> B:<strong>{telemetryDynamics.brake}%</strong>
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Gear and Shift (Shown in both Simple & Detailed modes) */}
          <div className="track-sim__hud-item">
            <span className="track-sim__hud-label">GEAR</span>
            <span className="track-sim__hud-val track-sim__hud-gear">
              G{telemetryDynamics.gear}
              {telemetryDynamics.shiftState === 'UPSHIFT' && <ArrowUp size={11} className="shift-icon shift-icon--up" />}
              {telemetryDynamics.shiftState === 'DOWNSHIFT' && <ArrowDown size={11} className="shift-icon shift-icon--down" />}
            </span>
          </div>

          {/* Speed (Shown in both Simple & Detailed modes) */}
          <div className="track-sim__hud-item">
            <span className="track-sim__hud-label">SPEED</span>
            <span className="track-sim__hud-val track-sim__hud-speed">{Math.round(speed)} <small>KM/H</small></span>
          </div>

          {/* DRS Wing (Hidden in Simple Mode) */}
          {!isSimpleMode && (
            <div className="track-sim__hud-item">
              <span className="track-sim__hud-label">DRS WING</span>
              <span className={`track-sim__hud-val track-sim__drs ${isDrsActive ? 'track-sim__drs--open' : isDrsZone ? 'track-sim__drs--avail' : ''}`}>
                {isDrsActive ? 'OPEN (+13.4kph)' : isDrsZone ? 'ARMED (<1.0s)' : 'CLOSED'}
              </span>
            </div>
          )}

          {/* Battery % Left (Shown in both modes) */}
          <div className="track-sim__hud-item">
            <span className="track-sim__hud-label"><BatteryMedium size={9} /> BATT LEFT</span>
            <span className="track-sim__hud-val track-sim__hud-ers mono">
              {batteryPercentLeft}% <small>({usableBatteryMj}MJ)</small>
            </span>
          </div>

          {/* Detailed Power Flow, Tyre Deg & Efficiency (Hidden in Simple Mode) */}
          {!isSimpleMode && (
            <>
              {/* Rate of Discharge & Recharge Flow */}
              <div className="track-sim__hud-item">
                <span className="track-sim__hud-label"><RefreshCw size={9} /> POWER FLOW</span>
                <span className={`track-sim__hud-val mono ${netPowerFlowKw < 0 ? 'track-sim__hud-flow--disch' : netPowerFlowKw > 0 ? 'track-sim__hud-flow--rech' : 'track-sim__hud-flow--bal'}`}>
                  {netPowerFlowKw < 0 ? `-${Math.abs(netPowerFlowKw).toFixed(0)} kW` : netPowerFlowKw > 0 ? `+${netPowerFlowKw.toFixed(0)} kW` : '0 kW'}
                  <small>({netPowerFlowKw < 0 ? 'DISCH' : netPowerFlowKw > 0 ? 'RECH' : 'BAL'})</small>
                </span>
              </div>

              {/* Tyre Degradation in Header */}
              <div className="track-sim__hud-item">
                <span className="track-sim__hud-label"><Disc size={9} /> TYRE DEG</span>
                <span className="track-sim__hud-val mono" style={{ color: tyreDeg > 60 ? '#ef4444' : tyreDeg > 30 ? '#f59e0b' : '#10e782' }}>
                  {tyreDeg.toFixed(1)}% <small>(C3)</small>
                </span>
              </div>

              {/* Efficiency in Header */}
              <div className="track-sim__hud-item">
                <span className="track-sim__hud-label"><Cpu size={9} /> EFFICIENCY</span>
                <span className="track-sim__hud-val mono" style={{ color: 'var(--accent)' }}>
                  {ersEfficiency.toFixed(1)}%
                </span>
              </div>
            </>
          )}

          {/* Gap & Strategy Mode (Shown in both modes) */}
          <div className="track-sim__hud-item">
            <span className="track-sim__hud-label">GAP P{(raceState?.position ?? 2) - 1 > 0 ? (raceState?.position ?? 2) - 1 : 1}</span>
            <span className="track-sim__hud-val track-sim__hud-gap">+{gapAhead.toFixed(2)}s</span>
          </div>

          <div className={`track-sim__mode-chip track-sim__mode-chip--${action.toLowerCase()}`}>
            <Zap size={11} />
            {action}
          </div>

          {/* Camera toggle */}
          <button
            type="button"
            className={`track-sim__cam-btn ${cameraFollow ? 'track-sim__cam-btn--active' : ''}`}
            onClick={() => setCameraFollow(!cameraFollow)}
            title={cameraFollow ? 'Switch to Full Circuit' : 'Zoom to Follow SAZI Car'}
            aria-label="Toggle camera view"
          >
            <Eye size={12} />
            <span>{cameraFollow ? 'FULL CIRCUIT' : 'FOLLOW CAR'}</span>
          </button>

          {/* Toggle Detailed Telemetry Stats or Switch Mode */}
          {!isSimpleMode ? (
            <button
              type="button"
              className={`track-sim__cam-btn ${showDetailedStats ? 'track-sim__cam-btn--active' : ''}`}
              onClick={() => setShowDetailedStats(!showDetailedStats)}
              title="Toggle live telemetry statistics drawer"
              aria-label="Toggle telemetry statistics"
            >
              <Gauge size={12} />
              <span>TELEMETRY STATS</span>
              {showDetailedStats ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          ) : (
            onToggleUiMode && (
              <button
                type="button"
                className="track-sim__cam-btn"
                onClick={onToggleUiMode}
                title="Switch to Detailed Analysis view"
                aria-label="Switch to Detailed Analysis view"
              >
                <Gauge size={12} />
                <span>DETAILED ANALYSIS</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Realistic Circuit SVG Canvas ───────────────────────────────── */}
      <div className="track-sim__canvas-wrapper">
        <svg
          viewBox={viewBox}
          className="track-sim__svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Real Asphalt Gradient */}
            <linearGradient id="realAsphalt" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#252a32" />
              <stop offset="50%" stopColor="#1e2228" />
              <stop offset="100%" stopColor="#191c22" />
            </linearGradient>

            {/* Asphalt Grain Texture Pattern */}
            <pattern id="asphaltGrain" width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="#1d2127" />
              <circle cx="2" cy="2" r="0.8" fill="#292f38" opacity="0.6" />
              <circle cx="6" cy="5" r="0.9" fill="#14171c" opacity="0.8" />
              <circle cx="4" cy="7" r="0.6" fill="#323843" opacity="0.4" />
            </pattern>

            {/* Gravel Runoff Pattern */}
            <pattern id="gravelPattern" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="#ba9663" />
              <circle cx="2" cy="2" r="1" fill="#9c7a4a" />
              <circle cx="5" cy="4" r="0.8" fill="#d9b682" />
            </pattern>

            {/* Red and White Kerb Pattern */}
            <pattern id="kerbPattern" width="12" height="12" patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="6" height="12" fill="#dc2626" />
              <rect x="6" y="0" width="6" height="12" fill="#ffffff" />
            </pattern>

            {/* 3D Car Body Gradients */}
            <linearGradient id="saziChassis3D" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="35%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="65%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="#042a42" />
            </linearGradient>

            <linearGradient id="rivalChassis3D" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="30%" stopColor="#ffffff" stopOpacity="0.5" />
              <stop offset="70%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </linearGradient>

            {/* Carbon Fiber Wing Gradient */}
            <linearGradient id="carbonWing" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="50%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>

            {/* 3D Tire Rim & Shading */}
            <radialGradient id="tire3D" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="50%" stopColor="#0f172a" />
              <stop offset="85%" stopColor="#020617" />
              <stop offset="100%" stopColor="#334155" />
            </radialGradient>

            {/* Helmet Visor Gloss */}
            <linearGradient id="visorGloss" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>

            {/* Car Ground-Effect Shadow */}
            <filter id="f1GroundShadow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.65 0"/>
              <feOffset dx="0" dy="3" />
              <feBlend in="SourceGraphic" in2="blurOut" mode="normal" />
            </filter>

            {/* ERS Kinetic Harvest Pulse */}
            <radialGradient id="ersHarvestHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--recover)" stopOpacity="0.8" />
              <stop offset="60%" stopColor="var(--recover)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* ── Environment / Landscape Ground ───────────────────────── */}
          <rect x="0" y="0" width={TRACK_WIDTH} height={TRACK_HEIGHT} className="track-sim__ground" />

          {/* Grass Runoff / Infield Grounds */}
          <path
            d="M 180 380 C 180 250, 240 180, 480 180 C 660 180, 800 240, 800 320 C 800 400, 550 440, 320 440 Z"
            className="track-sim__infield-grass"
          />

          {/* Gravel Traps (Turn 1 exit and Hairpin) */}
          <path
            d="M 750 445 C 870 445, 945 390, 945 290 C 945 220, 885 170, 810 170"
            fill="none"
            stroke="url(#gravelPattern)"
            strokeWidth="50"
            strokeLinecap="round"
          />
          <path
            d="M 260 5 C 150 5, 80 55, 80 140 C 80 220, 140 265, 220 265"
            fill="none"
            stroke="url(#gravelPattern)"
            strokeWidth="50"
            strokeLinecap="round"
          />

          {/* ── Normal Real Asphalt Road Surface with Border Markings ── */}
          {/* Outer Road Base Shoulder */}
          <path
            d={CIRCUIT_PATH}
            className="track-sim__road-bed"
            strokeWidth="46"
          />

          {/* Black & White Road Border Markings along Edges (Base Black + Dashed White) */}
          <path
            d={CIRCUIT_PATH}
            fill="none"
            stroke="#090d14"
            strokeWidth="42"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={CIRCUIT_PATH}
            fill="none"
            stroke="#ffffff"
            strokeWidth="42"
            strokeDasharray="12 12"
            strokeLinecap="butt"
            strokeLinejoin="round"
            opacity="0.95"
          />

          {/* Red & White FIA Apex Road Border Markings along Curves (Red Base + Dashed White) */}
          <path
            d={CIRCUIT_PATH}
            fill="none"
            stroke="#dc2626"
            strokeWidth="42"
            strokeDasharray="100 180"
            strokeDashoffset="40"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={CIRCUIT_PATH}
            fill="none"
            stroke="#ffffff"
            strokeWidth="42"
            strokeDasharray="8 8"
            strokeDashoffset="40"
            strokeLinecap="butt"
            strokeLinejoin="round"
            opacity="0.95"
          />

          {/* Real Asphalt Surface (Clean, smooth dark tarmac sitting on top, leaving 4px border markings on each side) */}
          <path
            d={CIRCUIT_PATH}
            className="track-sim__asphalt-base"
            stroke="url(#realAsphalt)"
            strokeWidth="34"
          />

          {/* Natural Asphalt Tarmac Grain Texture */}
          <path
            d={CIRCUIT_PATH}
            stroke="url(#asphaltGrain)"
            strokeWidth="34"
            fill="none"
            opacity="0.35"
          />

          {/* Clean Rubbered-in Driving Line */}
          <path
            d={CIRCUIT_PATH}
            className="track-sim__rubber-line"
            strokeWidth="12"
          />

          {/* Normal Road Centerline (Longitudinal Dashed Marking Along the Road) */}
          <path
            d={CIRCUIT_PATH}
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeDasharray="16 16"
            opacity="0.4"
          />

          {/* Red & White FIA Apex Curbs Along Corner Edges */}
          {CURBS.map((c, idx) => (
            <g key={idx} transform={`rotate(${c.rot}, ${c.x + c.w / 2}, ${c.y + c.h / 2})`}>
              <rect
                x={c.x}
                y={c.y}
                width={c.w}
                height={c.h}
                rx="2"
                fill="url(#kerbPattern)"
                stroke="#111827"
                strokeWidth="1"
                className="track-sim__curb-shadow"
              />
            </g>
          ))}

          {/* Detailed Track Markings & Corner Annotations (Hidden in Simple Mode) */}
          {!isSimpleMode && (
            <>
              {/* Brake Distance Boards Off-Track (150m, 100m, 50m approaching Turn 1) */}
              <g className="track-sim__brake-boards">
                <g transform="translate(710, 442)">
                  <rect x="-10" y="-8" width="20" height="12" rx="1" fill="#0f172a" stroke="#ffffff" strokeWidth="1" />
                  <text x="0" y="1" textAnchor="middle" fill="#ffffff" fontSize="7" fontWeight="bold" fontFamily="monospace">150</text>
                </g>
                <g transform="translate(740, 442)">
                  <rect x="-10" y="-8" width="20" height="12" rx="1" fill="#0f172a" stroke="#ffffff" strokeWidth="1" />
                  <text x="0" y="1" textAnchor="middle" fill="#ffffff" fontSize="7" fontWeight="bold" fontFamily="monospace">100</text>
                </g>
                <g transform="translate(770, 442)">
                  <rect x="-10" y="-8" width="20" height="12" rx="1" fill="#0f172a" stroke="#ffffff" strokeWidth="1" />
                  <text x="0" y="1" textAnchor="middle" fill="#ffffff" fontSize="7" fontWeight="bold" fontFamily="monospace">50</text>
                </g>
              </g>

              {/* Trackside Sector Labels (Placed Off-Track, Not Cutting Across the Road) */}
              <text x="770" y="130" className="track-sim__sector-split-text">INT 1 (SECTOR 1)</text>
              <text x="260" y="190" className="track-sim__sector-split-text">INT 2 (SECTOR 2)</text>

              {/* Silverstone Iconic Corners & Straights (Clean Off-Track Labels) */}
              <g className="track-sim__corner-annotations">
                {/* Start / Finish & Hamilton Straight */}
                <text x="450" y="445" className="track-sim__corner-label">HAMILTON STRAIGHT (START/FINISH)</text>

                {/* Abbey & Farm (T1 - T2) */}
                <text x="815" y="442" className="track-sim__corner-label track-sim__corner-label--apex">ABBEY & FARM (T1-T2)</text>

                {/* Village & The Loop (T3 - T4) */}
                <text x="880" y="270" className="track-sim__corner-label track-sim__corner-label--apex">THE LOOP (T4 • 78 KM/H)</text>

                {/* Wellington Straight (DRS Zone 1) */}
                <text x="770" y="98" className="track-sim__corner-label track-sim__corner-label--drs">WELLINGTON STRAIGHT (DRS 1)</text>

                {/* Brooklands & Luffield (T6 - T7) */}
                <text x="590" y="112" className="track-sim__corner-label track-sim__corner-label--apex">BROOKLANDS & LUFFIELD (T6-T7)</text>

                {/* Copse Corner (T9 - High Speed) */}
                <text x="475" y="202" className="track-sim__corner-label track-sim__corner-label--apex">COPSE (T9 • 290 KM/H • 5.2G)</text>

                {/* Maggotts & Becketts (T10 - T13) */}
                <text x="235" y="18" className="track-sim__corner-label track-sim__corner-label--apex">MAGGOTTS & BECKETTS (T10-T13)</text>

                {/* Chapel Curve (T14) */}
                <text x="140" y="18" className="track-sim__corner-label">CHAPEL (T14)</text>

                {/* Hangar Straight (DRS Zone 2) */}
                <text x="42" y="130" transform="rotate(-90 42 130)" className="track-sim__corner-label track-sim__corner-label--drs">
                  HANGAR STRAIGHT (DRS 2 • 335 KM/H)
                </text>

                {/* Stowe Corner (T15) */}
                <text x="40" y="235" className="track-sim__corner-label track-sim__corner-label--apex">STOWE (T15 • -4.8G)</text>

                {/* Vale & Club (T16 - T18) */}
                <text x="230" y="312" className="track-sim__corner-label track-sim__corner-label--apex">VALE (T16)</text>
                <text x="495" y="375" className="track-sim__corner-label track-sim__corner-label--apex">CLUB (T18)</text>
              </g>
            </>
          )}

          {/* Hidden reference path for exact coordinate sampling */}
          <path ref={pathRef} d={CIRCUIT_PATH} fill="none" stroke="none" />

          {/* ── CAR 3: Field / Midfield Car (Realistic 3D Top-Down) ───── */}
          <g
            transform={`translate(${carState.field.x}, ${carState.field.y}) rotate(${carState.field.angle})`}
            filter="url(#f1GroundShadow)"
          >
            <rect x="-18" y="-7" width="36" height="14" rx="4" fill="#0f172a" />
            <path d="M -18 -6 L 8 -6 L 18 -3 L 23 0 L 18 3 L 8 6 L -18 6 Z" fill="#64748b" />
            <rect x="20" y="-9" width="3" height="18" rx="1" fill="#334155" />
            <rect x="-20" y="-9" width="3" height="18" rx="1" fill="#334155" />
            <rect x="-16" y="-12" width="9" height="5" rx="1.5" fill="url(#tire3D)" stroke="#94a3b8" strokeWidth="0.5" />
            <rect x="-16" y="7" width="9" height="5" rx="1.5" fill="url(#tire3D)" stroke="#94a3b8" strokeWidth="0.5" />
            <rect x="9" y="-11" width="8" height="4.5" rx="1.5" fill="url(#tire3D)" stroke="#94a3b8" strokeWidth="0.5" />
            <rect x="9" y="6.5" width="8" height="4.5" rx="1.5" fill="url(#tire3D)" stroke="#94a3b8" strokeWidth="0.5" />
            <path d="M -2 -4 L 8 0 L -2 4" stroke="#94a3b8" strokeWidth="2" fill="none" />
            <circle cx="2" cy="0" r="2.5" fill="#f8fafc" />
          </g>

          {/* Aerodynamic Slipstream Low-Pressure Tow (energy preservation when trailing) */}
          {overtakeProgress < 0.1 && (
            <g className="track-sim__slipstream-flow">
              <line
                x1={carState.rival.x}
                y1={carState.rival.y}
                x2={carState.sazi.x}
                y2={carState.sazi.y}
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeDasharray="8 6"
                opacity="0.65"
                className="track-sim__slipstream-line"
              />
              <line
                x1={carState.rival.x}
                y1={carState.rival.y}
                x2={carState.sazi.x}
                y2={carState.sazi.y}
                stroke="#10e782"
                strokeWidth="1.2"
                strokeDasharray="4 6"
                opacity="0.5"
                className="track-sim__slipstream-anim-fast"
              />
            </g>
          )}

          {/* ── CAR 2: Rival Competitor (Realistic 3D F1 Model) ───────── */}
          <g
            transform={`translate(${carState.rival.x}, ${carState.rival.y}) rotate(${carState.rival.angle})`}
            className="track-sim__car-rival"
            filter="url(#f1GroundShadow)"
          >
            <path d="M -19 -8 L 10 -8 L 22 -4 L 26 0 L 22 4 L 10 8 L -19 8 Z" fill="#090d16" />
            <rect x="-22" y="-11" width="4" height="22" rx="1" fill="url(#carbonWing)" />
            <rect x="-22" y="-11" width="5" height="3" fill="#ef4444" />
            <rect x="-22" y="8" width="5" height="3" fill="#ef4444" />

            <path
              d="M -19 -6.5 L 6 -6.5 L 18 -4 L 24 0 L 18 4 L 6 6.5 L -19 6.5 Z"
              fill="url(#rivalChassis3D)"
              stroke="#7f1d1d"
              strokeWidth="0.8"
            />

            <rect x="-3" y="-7.5" width="8" height="2" rx="1" fill="#020617" />
            <rect x="-3" y="5.5" width="8" height="2" rx="1" fill="#020617" />
            <rect x="22" y="-11" width="3" height="22" rx="1" fill="url(#carbonWing)" />
            <line x1="24" y1="-10" x2="24" y2="10" stroke="#ef4444" strokeWidth="1" />

            <rect x="-16" y="-12.5" width="9" height="5" rx="1.5" fill="url(#tire3D)" stroke="#ef4444" strokeWidth="0.8" />
            <rect x="-16" y="7.5" width="9" height="5" rx="1.5" fill="url(#tire3D)" stroke="#ef4444" strokeWidth="0.8" />
            <rect x="10" y="-11.5" width="8" height="4.5" rx="1.5" fill="url(#tire3D)" stroke="#ef4444" strokeWidth="0.8" />
            <rect x="10" y="7" width="8" height="4.5" rx="1.5" fill="url(#tire3D)" stroke="#ef4444" strokeWidth="0.8" />

            <path d="M -3 -4.5 L 9 0 L -3 4.5" stroke="#475569" strokeWidth="2.5" fill="none" />
            <circle cx="2" cy="0" r="3" fill="#fbbf24" />
            <path d="M 2 -2 L 5 0 L 2 2" stroke="#0f172a" strokeWidth="1.5" fill="none" />

            {/* Dynamic Label Based on Actual On-Track Position */}
            <text x="0" y="-16" className="track-sim__car-label track-sim__car-label--rival">
              {overtakeProgress >= 0.15
                ? `P2 RIVAL (+0.65s)`
                : `P1 RIVAL (LEADER)`}
            </text>
          </g>

          {/* ── CAR 1: SAZI AI F1 Car (Ultra-Realistic 3D Flagship) ───── */}
          <g
            transform={`translate(${carState.sazi.x}, ${carState.sazi.y}) rotate(${carState.sazi.angle})`}
            className={`track-sim__car-sazi track-sim__car-sazi--${action.toLowerCase()}`}
            filter="url(#f1GroundShadow)"
          >
            {/* RECOVER Mode: Kinetic MGU-K Energy Regeneration Field & Orbit */}
            {(action === 'RECOVER' || telemetryDynamics.brake > 30) && (
              <g className="track-sim__regen-field">
                <circle cx="-12" cy="0" r="26" fill="url(#ersHarvestHalo)" className="track-sim__ers-harvest-ring" />
                <circle cx="-12" cy="0" r="18" stroke="#10e782" strokeWidth="1" fill="none" strokeDasharray="4 4" className="track-sim__regen-orbit" />
              </g>
            )}

            {/* Ground-Effect Diffuser & Carbon Underside Floor */}
            <path d="M -20 -8.5 L 11 -8.5 L 23 -4.5 L 27 0 L 23 4.5 L 11 8.5 L -20 8.5 Z" fill="#040914" />

            {/* Rear Wing Assembly (DRS Flap Opens in Overtake) */}
            <rect
              x={isDrsActive ? -25 : -23}
              y="-12"
              width="4.5"
              height="24"
              rx="1.2"
              className={`track-sim__f1-rear-wing ${isDrsActive ? 'track-sim__f1-rear-wing--open' : ''}`}
              fill="url(#carbonWing)"
              stroke="var(--accent)"
              strokeWidth="0.8"
            />
            <rect x="-24" y="-12" width="6" height="3" rx="0.5" fill="var(--accent)" />
            <rect x="-24" y="9" width="6" height="3" rx="0.5" fill="var(--accent)" />

            {/* High-Intensity FIA Rear Rain / Regen Flashing LED */}
            <circle
              cx="-23"
              cy="0"
              r="2.5"
              fill={action === 'RECOVER' ? '#10e782' : '#ef4444'}
              className={action === 'RECOVER' ? 'track-sim__rear-regen-light' : ''}
              filter={action === 'RECOVER' ? 'drop-shadow(0 0 6px #10e782)' : 'none'}
            />

            {/* 3D Main Aerodynamic Chassis Body */}
            <path
              d="M -20 -7 L 7 -7 L 19 -4.2 L 25 0 L 19 4.2 L 7 7 L -20 7 Z"
              fill="url(#saziChassis3D)"
              stroke="var(--accent)"
              strokeWidth="1"
            />

            <path d="M -5 -8 L 5 -8 L 7 -6 L -5 -6 Z" fill="#060e1a" />
            <path d="M -5 6 L 7 6 L 5 8 L -5 8 Z" fill="#060e1a" />
            <line x1="-16" y1="0" x2="2" y2="0" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" />

            <rect x="23" y="-12" width="3.5" height="24" rx="1.2" fill="url(#carbonWing)" stroke="var(--accent)" strokeWidth="0.6" />
            <line x1="25" y1="-11" x2="25" y2="11" stroke="var(--accent)" strokeWidth="1.2" />

            <rect x="-17" y="-13" width="9.5" height="5.5" rx="1.8" fill="url(#tire3D)" stroke="var(--accent)" strokeWidth="1" />
            <rect x="-17" y="7.5" width="9.5" height="5.5" rx="1.8" fill="url(#tire3D)" stroke="var(--accent)" strokeWidth="1" />
            <rect x="11" y="-12" width="8.5" height="5" rx="1.8" fill="url(#tire3D)" stroke="var(--accent)" strokeWidth="1" />
            <rect x="11" y="7" width="8.5" height="5" rx="1.8" fill="url(#tire3D)" stroke="var(--accent)" strokeWidth="1" />

            <path d="M -3 -5 L 10 0 L -3 5" stroke="var(--accent)" strokeWidth="3" fill="none" strokeLinecap="round" />
            <circle cx="3" cy="0" r="3.2" fill="url(#visorGloss)" />
            <rect x="-6" y="-1" width="3" height="2" rx="0.5" fill="#facc15" />

            {/* Dynamic Label Based on Actual On-Track Position */}
            <text x="0" y="-17" className="track-sim__car-label track-sim__car-label--sazi">
              {overtakeProgress >= 0.15
                ? `P1 SAZI AI (LEADER • ATTACK MODE)`
                : `P2 SAZI AI (${action === 'RECOVER' ? 'HARVESTING +120kW' : action === 'HOLD' ? 'SLIPSTREAM TOW' : 'ATTACKING'})`}
            </text>
          </g>
        </svg>

        {/* ── On-Canvas Live Broadcast Maneuver Banner ────────────────── */}
        <div className={`track-sim__canvas-banner track-sim__canvas-banner--${action.toLowerCase()}`}>
          {action === 'OVERTAKE' && (
            <>
              <span className="banner-icon">⚔️</span>
              <span className="banner-text">
                <strong>OVERTAKE MANEUVER ACTIVE:</strong> INSIDE LINE DIVE • MGU-K FULL DEPLOY (-120kW) • DRS OPEN
              </span>
            </>
          )}
          {action === 'RECOVER' && (
            <>
              <span className="banner-icon">🔋</span>
              <span className="banner-text">
                <strong>ENERGY PRESERVATION ACTIVE:</strong> TACTICAL SLIPSTREAM TOW • MGU-K REGEN (+120kW) • TYRE SAVING
              </span>
            </>
          )}
          {action === 'HOLD' && (
            <>
              <span className="banner-icon">🛡️</span>
              <span className="banner-text">
                <strong>STRATEGIC ENERGY MANAGEMENT:</strong> MAINTAINING TACTICAL GAP (1.3s) • PRESERVING 4.0MJ BUDGET
              </span>
            </>
          )}
        </div>

        {/* ── F1 TV Broadcast Onboard Telemetry Graphic (Floating HUD - Hidden in Simple Mode) ── */}
        {!isSimpleMode && (
          <div className="track-sim__onboard-hud">
            <div className="track-sim__onboard-header">
              <span className="track-sim__onboard-title">F1 LIVE TELEMETRY</span>
              <span className={`track-sim__onboard-status ${isRunning ? 'active' : ''}`}>{isRunning ? 'TRANSMITTING' : 'STANDBY'}</span>
            </div>

            <div className="track-sim__onboard-main">
              {/* Speed & Gear Cluster */}
              <div className="track-sim__onboard-cluster">
                <div className="track-sim__onboard-speed">
                  <span className="track-sim__onboard-speed-val mono">{Math.round(speed)}</span>
                  <span className="track-sim__onboard-speed-unit">KM/H</span>
                </div>
                <div className="track-sim__onboard-gear">
                  <span className="track-sim__onboard-gear-val mono">{telemetryDynamics.gear}</span>
                  <span className="track-sim__onboard-gear-lbl">GEAR</span>
                </div>
              </div>

              {/* Vertical Throttle & Brake Bars */}
              <div className="track-sim__onboard-pedals">
                <div className="track-sim__pedal-meter">
                  <div className="track-sim__pedal-bar-vert">
                    <div className="track-sim__pedal-fill-vert track-sim__pedal-fill-vert--thr" style={{ height: `${telemetryDynamics.throttle}%` }} />
                  </div>
                  <span className="track-sim__pedal-text mono">{telemetryDynamics.throttle}%</span>
                  <span className="track-sim__pedal-tag">THR</span>
                </div>

                <div className="track-sim__pedal-meter">
                  <div className="track-sim__pedal-bar-vert">
                    <div className="track-sim__pedal-fill-vert track-sim__pedal-fill-vert--brk" style={{ height: `${telemetryDynamics.brake}%` }} />
                  </div>
                  <span className="track-sim__pedal-text mono">{telemetryDynamics.brake}%</span>
                  <span className="track-sim__pedal-tag">BRK</span>
                </div>
              </div>

              {/* DRS & ERS Broadcast Indicators */}
              <div className="track-sim__onboard-systems">
                <div className={`track-sim__sys-badge ${isDrsActive ? 'track-sim__sys-badge--drs-on' : ''}`}>
                  <span className="sys-name">DRS</span>
                  <span className="sys-state">{isDrsActive ? 'ACTIVE' : isDrsZone ? 'ARMED' : 'CLOSED'}</span>
                </div>

                <div className={`track-sim__sys-badge track-sim__sys-badge--ers ${action.toLowerCase()}`}>
                  <span className="sys-name">ERS</span>
                  <span className="sys-state">{action === 'OVERTAKE' ? 'BOOST' : action === 'RECOVER' ? 'REGEN' : 'BALANCED'}</span>
                </div>
              </div>
            </div>

            {/* LED Rev Lights (Circular F1 Steering Wheel Array) */}
            <div className={`track-sim__onboard-leds ${activeLeds === 15 ? 'shift-flash' : ''}`}>
              {Array.from({ length: 15 }).map((_, i) => {
                const isLit = i < activeLeds;
                const ledColor = i < 5 ? 'green' : i < 10 ? 'yellow' : i < 13 ? 'red' : 'blue';
                return (
                  <span
                    key={i}
                    className={`track-sim__led track-sim__led--${ledColor} ${isLit ? 'lit' : ''}`}
                  />
                );
              })}
            </div>

            {/* Mini Telemetry Strip: Battery %, Net Power Flow kW, Tyre Deg %, and Efficiency */}
            <div className="track-sim__onboard-strip">
              <div className="track-sim__onboard-pill">
                <span>BATT</span>
                <strong className="mono">{batteryPercentLeft}% ({usableBatteryMj}MJ)</strong>
              </div>
              <div className="track-sim__onboard-pill">
                <span>FLOW</span>
                <strong className={`mono ${netPowerFlowKw < 0 ? 'track-sim__hud-flow--disch' : netPowerFlowKw > 0 ? 'track-sim__hud-flow--rech' : 'track-sim__hud-flow--bal'}`}>
                  {netPowerFlowKw < 0 ? `-${Math.abs(netPowerFlowKw).toFixed(0)}kW` : netPowerFlowKw > 0 ? `+${netPowerFlowKw.toFixed(0)}kW` : '0kW'}
                </strong>
              </div>
              <div className="track-sim__onboard-pill">
                <span>TYRE</span>
                <strong className="mono" style={{ color: tyreDeg > 60 ? '#ef4444' : tyreDeg > 30 ? '#f59e0b' : '#10e782' }}>
                  {tyreDeg.toFixed(1)}%
                </strong>
              </div>
              <div className="track-sim__onboard-pill">
                <span>EFF</span>
                <strong className="mono" style={{ color: 'var(--accent)' }}>{ersEfficiency.toFixed(1)}%</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Cockpit Bar: LED Rev Indicator, Throttle & Brake, and Gear (Positioned Below Track) ── */}
      <div className="track-sim__cockpit-bar" role="region" aria-label="Cockpit Rev and Pedal Telemetry">
        {/* Gear Indicator */}
        <div className="track-sim__cockpit-gear-cluster">
          <span className="track-sim__cockpit-gear-lbl">GEAR</span>
          <div className="track-sim__cockpit-gear-display">
            <span className="track-sim__cockpit-gear-val mono">
              {isRunning ? telemetryDynamics.gear : 'N'}
            </span>
            <div className="track-sim__cockpit-shift-badge">
              {telemetryDynamics.shiftState === 'UPSHIFT' && <span className="shift-pill shift-pill--up"><ArrowUp size={9} /> UP</span>}
              {telemetryDynamics.shiftState === 'DOWNSHIFT' && <span className="shift-pill shift-pill--down"><ArrowDown size={9} /> DN</span>}
              {telemetryDynamics.shiftState === 'HOLD' && <span className="shift-pill">OPT</span>}
              {telemetryDynamics.shiftState === 'NEUTRAL' && <span className="shift-pill">NEUT</span>}
            </div>
          </div>
        </div>

        {/* Center: F1 Steering Wheel LED Rev Indicator + RPM */}
        <div className="track-sim__cockpit-rev-cluster">
          <div className="track-sim__cockpit-rev-header">
            <span className="track-sim__cockpit-rpm-lbl">REV LIGHTS</span>
            <div className={`track-sim__cockpit-led-strip ${activeLeds === 15 ? 'shift-flash' : ''}`}>
              {Array.from({ length: 15 }).map((_, i) => {
                const isLit = i < activeLeds;
                const ledColor = i < 5 ? 'green' : i < 10 ? 'yellow' : i < 13 ? 'red' : 'blue';
                return (
                  <span
                    key={i}
                    className={`track-sim__cockpit-led track-sim__cockpit-led--${ledColor} ${isLit ? 'lit' : ''}`}
                  />
                );
              })}
            </div>
            <span className="track-sim__cockpit-rpm-val mono">
              {isRunning ? telemetryDynamics.rpm.toLocaleString() : '0'} <small>RPM</small>
            </span>
          </div>
        </div>

        {/* Pedal Inputs: Throttle & Brake Horizontal Bars */}
        <div className="track-sim__cockpit-pedals-cluster">
          {/* Throttle Input */}
          <div className="track-sim__cockpit-pedal-row">
            <span className="track-sim__cockpit-pedal-tag track-sim__cockpit-pedal-tag--thr">THR</span>
            <div className="track-sim__cockpit-pedal-track">
              <div
                className="track-sim__cockpit-pedal-fill track-sim__cockpit-pedal-fill--thr"
                style={{ width: `${telemetryDynamics.throttle}%` }}
              />
            </div>
            <span className="track-sim__cockpit-pedal-pct mono">{telemetryDynamics.throttle}%</span>
          </div>

          {/* Brake Input */}
          <div className="track-sim__cockpit-pedal-row">
            <span className="track-sim__cockpit-pedal-tag track-sim__cockpit-pedal-tag--brk">BRK</span>
            <div className="track-sim__cockpit-pedal-track">
              <div
                className="track-sim__cockpit-pedal-fill track-sim__cockpit-pedal-fill--brk"
                style={{ width: `${telemetryDynamics.brake}%` }}
              />
            </div>
            <span className="track-sim__cockpit-pedal-pct mono">{telemetryDynamics.brake}%</span>
          </div>
        </div>
      </div>

      {/* ── Advanced Detailed Telemetry Statistics Drawer ─────────────── */}
      {!isSimpleMode && showDetailedStats && (
        <div className="track-sim__telemetry-drawer">
          {/* Card 1: Throttle Inputs, Brake Inputs & Gear Change */}
          <div className="track-sim__drawer-card">
            <div className="track-sim__drawer-header">
              <Gauge size={13} />
              <span>THROTTLE, BRAKE & GEAR SHIFTS</span>
            </div>
            <div className="track-sim__drawer-body">
              {/* Throttle Input */}
              <div className="track-sim__pedal-row">
                <span className="track-sim__pedal-label">THROTTLE:</span>
                <div className="track-sim__pedal-bar">
                  <div
                    className="track-sim__pedal-fill track-sim__pedal-fill--throttle"
                    style={{ width: `${telemetryDynamics.throttle}%` }}
                  />
                </div>
                <span className="track-sim__pedal-val mono">{telemetryDynamics.throttle}%</span>
              </div>

              {/* Brake Input */}
              <div className="track-sim__pedal-row">
                <span className="track-sim__pedal-label">BRAKE:</span>
                <div className="track-sim__pedal-bar">
                  <div
                    className="track-sim__pedal-fill track-sim__pedal-fill--brake"
                    style={{ width: `${telemetryDynamics.brake}%` }}
                  />
                </div>
                <span className="track-sim__pedal-val mono">{telemetryDynamics.brake}%</span>
              </div>

              {/* Gear Change Telemetry */}
              <div className="track-sim__stat-pair">
                <span>GEAR ENGAGEMENT:</span>
                <strong className="mono track-sim__gear-callout">
                  GEAR {telemetryDynamics.gear} &nbsp;
                  {telemetryDynamics.shiftState === 'UPSHIFT' && <span className="shift-pill shift-pill--up">▲ UPSHIFT</span>}
                  {telemetryDynamics.shiftState === 'DOWNSHIFT' && <span className="shift-pill shift-pill--down">▼ DOWNSHIFT</span>}
                  {telemetryDynamics.shiftState === 'HOLD' && <span className="shift-pill">OPTIMAL GEAR</span>}
                </strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>GEAR SHIFTS THIS LAP:</span>
                <strong className="mono">{telemetryDynamics.totalShifts} SHIFTS COMPLETED (SEAMLESS SHIFT)</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>FULL THROTTLE DUTY:</span>
                <strong className="mono">71.4% LAP INJECTION (WOT)</strong>
              </div>
            </div>
          </div>

          {/* Card 2: DRS (Drag Reduction System) Mentions & Aerodynamics */}
          <div className="track-sim__drawer-card">
            <div className="track-sim__drawer-header">
              <Wind size={13} />
              <span>DRS (DRAG REDUCTION SYSTEM)</span>
            </div>
            <div className="track-sim__drawer-body">
              <div className="track-sim__stat-pair">
                <span>REAR WING STATUS:</span>
                <strong className="mono" style={{ color: isDrsActive ? 'var(--success)' : 'var(--text-primary)' }}>
                  {isDrsActive ? 'OPEN (HYDRAULIC FLAP DEPLOYED)' : isDrsZone ? 'ARMED (< 1.00s DETECTION)' : 'CLOSED (HIGH DOWNFORCE)'}
                </strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>DRS SPEED ADVANTAGE:</span>
                <strong className="mono" style={{ color: 'var(--accent)' }}>
                  +13.4 KM/H DELTA (335 KM/H HANGAR STRAIGHT TRAP)
                </strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>DRAG REDUCTION RATIO:</span>
                <strong className="mono">-30.5% AERODYNAMIC RESISTANCE</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>DETECTION POINT GAP:</span>
                <strong className="mono">
                  {gapAhead <= 1.0 ? `+${gapAhead.toFixed(2)}s (DRS PERMITTED)` : `+${gapAhead.toFixed(2)}s (> 1.0s LIMIT)`}
                </strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>DRS ACTIVATION ZONES:</span>
                <strong className="mono">ZONE 1: WELLINGTON (480M) • ZONE 2: HANGAR (750M)</strong>
              </div>
            </div>
          </div>

          {/* Card 3: Battery % Left & Usable Energy */}
          <div className="track-sim__drawer-card">
            <div className="track-sim__drawer-header">
              <BatteryMedium size={13} />
              <span>BATTERY SOC & USABLE RESERVE</span>
            </div>
            <div className="track-sim__drawer-body">
              {/* Large Battery Gauge */}
              <div className="track-sim__battery-meter">
                <div className="track-sim__battery-meter-header">
                  <span>STATE OF CHARGE (SOC):</span>
                  <span className="track-sim__battery-soc-val">{batteryPercentLeft}%</span>
                </div>
                <div className="track-sim__battery-bar-large">
                  <div
                    className="track-sim__battery-fill-large"
                    style={{ width: `${Math.min(100, Math.max(0, batteryPercentLeft))}%` }}
                  />
                </div>
              </div>

              <div className="track-sim__stat-pair">
                <span>USABLE CAPACITY REMAINING:</span>
                <strong className="mono" style={{ color: 'var(--accent)' }}>
                  {usableBatteryMj} MJ / 4.00 MJ USABLE
                </strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>CONTINUOUS 120kW BOOST:</span>
                <strong className="mono">{boostTimeRemainingS}s FULL-POWER TIME LEFT</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>ENERGY DEPLOYED THIS LAP:</span>
                <strong className="mono">
                  {(raceState?.energy_deployed_mj ?? 1.85).toFixed(2)} MJ / 4.00 MJ (FIA ALLOWANCE)
                </strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>CELL OPERATING TEMP:</span>
                <strong className="mono" style={{ color: '#10e782' }}>48.2°C (OPTIMUM 45–55°C)</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>SAFETY RESERVE BUFFER:</span>
                <strong className="mono">10.0% FIA CRITICAL SHUTOFF BUFFER</strong>
              </div>
            </div>
          </div>

          {/* Card 4: Rate of Discharge & Recharge (Live Power Flow) */}
          <div className="track-sim__drawer-card">
            <div className="track-sim__drawer-header">
              <RefreshCw size={13} />
              <span>RATE OF DISCHARGE & RECHARGE</span>
            </div>
            <div className="track-sim__drawer-body">
              {/* Discharge Rate Row */}
              <div className="track-sim__flow-row">
                <span className="track-sim__flow-label">DISCHARGE:</span>
                <div className="track-sim__flow-bar">
                  <div
                    className="track-sim__flow-fill track-sim__flow-fill--disch"
                    style={{ width: `${Math.min(100, (dischargeRateKw / 120) * 100)}%` }}
                  />
                </div>
                <span className="track-sim__flow-val track-sim__flow-val--disch mono">
                  {dischargeRateKw.toFixed(1)} kW
                </span>
              </div>

              {/* Recharge Rate Row */}
              <div className="track-sim__flow-row">
                <span className="track-sim__flow-label">RECHARGE:</span>
                <div className="track-sim__flow-bar">
                  <div
                    className="track-sim__flow-fill track-sim__flow-fill--rech"
                    style={{ width: `${Math.min(100, (rechargeRateKw / 120) * 100)}%` }}
                  />
                </div>
                <span className="track-sim__flow-val track-sim__flow-val--rech mono">
                  +{rechargeRateKw.toFixed(1)} kW
                </span>
              </div>

              <div className="track-sim__stat-pair">
                <span>NET POWERTRAIN FLOW:</span>
                <strong className="mono" style={{ color: netPowerFlowKw < 0 ? '#f97316' : netPowerFlowKw > 0 ? '#10e782' : 'var(--text-muted)' }}>
                  {netPowerFlowKw < 0 ? `-${Math.abs(netPowerFlowKw).toFixed(1)} kW (HIGH DISCHARGE)` : netPowerFlowKw > 0 ? `+${netPowerFlowKw.toFixed(1)} kW (HIGH RECHARGE)` : '0.0 kW (BALANCED CRUISE)'}
                </strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>KINETIC BRAKING REGEN:</span>
                <strong className="mono">+{isBraking ? '85.0' : '0.0'} kW (MGU-K REAR AXLE)</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>THERMAL TURBO HARVEST:</span>
                <strong className="mono">+{rechargeRateKw > 0 ? '35.0' : '0.0'} kW (MGU-H CONTINUOUS)</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>FLOW RATE ENERGY DUTY:</span>
                <strong className="mono">
                  {dischargeRateKw > 50 ? '-2.40 MJ/MIN DISCHARGE RATE' : rechargeRateKw > 50 ? '+2.40 MJ/MIN HARVEST RATE' : '0.70 MJ/MIN CRUISE FLOW'}
                </strong>
              </div>
            </div>
          </div>

          {/* Card 5: Powertrain & Strategy Efficiency */}
          <div className="track-sim__drawer-card">
            <div className="track-sim__drawer-header">
              <Cpu size={13} />
              <span>SYSTEM & THERMAL EFFICIENCY</span>
            </div>
            <div className="track-sim__drawer-body">
              <div className="track-sim__stat-pair">
                <span>MGU-K ROUND-TRIP EFFICIENCY:</span>
                <strong className="mono" style={{ color: 'var(--accent)' }}>
                  {ersEfficiency.toFixed(1)}% (BATTERY ⟷ MOTOR)
                </strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>ICE V6 TURBO THERMAL EFFICIENCY:</span>
                <strong className="mono" style={{ color: '#10e782' }}>
                  {iceThermalEfficiency}% (BENCHMARK &gt;50%)
                </strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>AI STRATEGY OPTIMALITY SCORE:</span>
                <strong className="mono" style={{ color: '#fbbf24' }}>
                  {aiDeploymentOptimality}% (HAMILTON TRACE)
                </strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>KINETIC RECOVERY EFFICIENCY:</span>
                <strong className="mono">{kineticHarvestEfficiency}% AXLE CAPTURE</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>SPECIFIC ENERGY CONSUMPTION:</span>
                <strong className="mono">0.82 MJ / KM (TARGET: 0.85)</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>FIA RULE COMPLIANCE:</span>
                <strong className="mono" style={{ color: 'var(--success)' }}>
                  ARTICLE 5.2.2 ENERGY PASS
                </strong>
              </div>
            </div>
          </div>

          {/* Card 6: Tyre Degradation & 4-Corner Wear */}
          <div className="track-sim__drawer-card">
            <div className="track-sim__drawer-header">
              <Disc size={13} />
              <span>TYRE DEGRADATION & WEAR</span>
            </div>
            <div className="track-sim__drawer-body">
              {/* Compound spec */}
              <div className="track-sim__stat-pair">
                <span>COMPOUND:</span>
                <strong className="mono" style={{ color: '#fbbf24' }}>PIRELLI P-ZERO C3 MEDIUM (YELLOW)</strong>
              </div>

              {/* 4 Corner Degradation Meters */}
              <div className="track-sim__tyre-deg-grid">
                <div className="track-sim__tyre-deg-item">
                  <div className="track-sim__tyre-deg-header">
                    <span className="track-sim__tyre-deg-pos">FL (FRONT LEFT)</span>
                    <span className="track-sim__tyre-deg-pct mono">{flDeg}%</span>
                  </div>
                  <div className="track-sim__tyre-deg-bar">
                    <div
                      className={`track-sim__tyre-deg-fill ${flDeg > 60 ? 'track-sim__tyre-deg-fill--worn' : flDeg > 30 ? 'track-sim__tyre-deg-fill--medium' : 'track-sim__tyre-deg-fill--fresh'}`}
                      style={{ width: `${flDeg}%` }}
                    />
                  </div>
                </div>

                <div className="track-sim__tyre-deg-item">
                  <div className="track-sim__tyre-deg-header">
                    <span className="track-sim__tyre-deg-pos">FR (FRONT RIGHT)</span>
                    <span className="track-sim__tyre-deg-pct mono" style={{ color: '#f59e0b' }}>{frDeg}%</span>
                  </div>
                  <div className="track-sim__tyre-deg-bar">
                    <div
                      className={`track-sim__tyre-deg-fill ${frDeg > 60 ? 'track-sim__tyre-deg-fill--worn' : frDeg > 30 ? 'track-sim__tyre-deg-fill--medium' : 'track-sim__tyre-deg-fill--fresh'}`}
                      style={{ width: `${frDeg}%` }}
                    />
                  </div>
                </div>

                <div className="track-sim__tyre-deg-item">
                  <div className="track-sim__tyre-deg-header">
                    <span className="track-sim__tyre-deg-pos">RL (REAR LEFT)</span>
                    <span className="track-sim__tyre-deg-pct mono">{rlDeg}%</span>
                  </div>
                  <div className="track-sim__tyre-deg-bar">
                    <div
                      className={`track-sim__tyre-deg-fill ${rlDeg > 60 ? 'track-sim__tyre-deg-fill--worn' : rlDeg > 30 ? 'track-sim__tyre-deg-fill--medium' : 'track-sim__tyre-deg-fill--fresh'}`}
                      style={{ width: `${rlDeg}%` }}
                    />
                  </div>
                </div>

                <div className="track-sim__tyre-deg-item">
                  <div className="track-sim__tyre-deg-header">
                    <span className="track-sim__tyre-deg-pos">RR (REAR RIGHT)</span>
                    <span className="track-sim__tyre-deg-pct mono">{rrDeg}%</span>
                  </div>
                  <div className="track-sim__tyre-deg-bar">
                    <div
                      className={`track-sim__tyre-deg-fill ${rrDeg > 60 ? 'track-sim__tyre-deg-fill--worn' : rrDeg > 30 ? 'track-sim__tyre-deg-fill--medium' : 'track-sim__tyre-deg-fill--fresh'}`}
                      style={{ width: `${rrDeg}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="track-sim__stat-pair">
                <span>STINT DEGRADATION RATE:</span>
                <strong className="mono">+0.42% WEAR PER LAP</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>MECHANICAL GRIP REMAINING:</span>
                <strong className="mono" style={{ color: gripRemaining > 85 ? '#10e782' : '#f59e0b' }}>
                  {gripRemaining.toFixed(1)}% (-{(100 - gripRemaining).toFixed(1)}% DROP)
                </strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>STINT PROGRESSION:</span>
                <strong className="mono">LAP {currentLap} / 26 TARGET STINT</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>RECOMMENDED PIT WINDOW:</span>
                <strong className="mono" style={{ color: 'var(--accent)' }}>LAPS 22 – 26 (BOX FOR HARD C2)</strong>
              </div>
            </div>
          </div>

          {/* Card 7: Silverstone Grand Prix Circuit Benchmarks & Weather */}
          <div className="track-sim__drawer-card">
            <div className="track-sim__drawer-header">
              <Timer size={13} />
              <span>SILVERSTONE GP BENCHMARKS</span>
            </div>
            <div className="track-sim__drawer-body">
              <div className="track-sim__stat-pair">
                <span>CIRCUIT SPEC:</span>
                <strong className="mono">5.891 KM • 18 TURNS • 52 LAPS</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>OFFICIAL LAP RECORD:</span>
                <strong className="mono" style={{ color: 'var(--accent)' }}>1:27.097 (M. VERSTAPPEN, 2020)</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>SECTOR BENCHMARKS:</span>
                <strong className="mono">S1: 27.84s | S2: 34.91s | S3: 24.34s</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>CONDITIONS:</span>
                <strong className="mono">TRACK: 34.2°C • AIR: 22.8°C • DRY</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>FIA FUEL FLOW:</span>
                <strong className="mono">98.4 KG/H (100.0 KG/H REGULATION CAP)</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom Telemetry Legend / Bar ───────────────────────────────── */}
      <div className="track-sim__footer">
        <div className="track-sim__legend">
          <div className="track-sim__legend-item">
            <span className="track-sim__legend-dot track-sim__legend-dot--sazi" />
            <span>SAZI AI RACER (P{raceState?.position ?? 1})</span>
          </div>
          <div className="track-sim__legend-item">
            <span className="track-sim__legend-dot track-sim__legend-dot--rival" />
            <span>RIVAL (+{gapAhead.toFixed(2)}s)</span>
          </div>
          <div className="track-sim__legend-item">
            <span className="track-sim__legend-dot track-sim__legend-dot--drs" />
            <span>DRS DETECTION & ACTIVATION ZONE</span>
          </div>
          <div className="track-sim__legend-item">
            <span className="track-sim__legend-dot track-sim__legend-dot--curb-rw" />
            <span>RED-WHITE APEX BORDERS</span>
          </div>
          <div className="track-sim__legend-item">
            <span className="track-sim__legend-dot track-sim__legend-dot--curb-bw" />
            <span>BLACK-WHITE ROAD BORDERS</span>
          </div>
        </div>

        <div className="track-sim__live-ers">
          <span className="track-sim__ers-label">ERS BATTERY RESERVE:</span>
          <div className="track-sim__ers-bar">
            <div
              className={`track-sim__ers-fill track-sim__ers-fill--${action.toLowerCase()}`}
              style={{ width: `${Math.min(100, Math.max(0, ers))}%` }}
            />
          </div>
          <span className="track-sim__ers-val mono">{ers.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
