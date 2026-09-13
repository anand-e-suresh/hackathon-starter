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
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Zap,
  Eye,
  Flag,
  ChevronDown,
  ChevronUp,
  Gauge,
  Wind,
  ArrowUp,
  ArrowDown,
  Timer,
  BatteryMedium,
  Disc,
  Cpu,
  RefreshCw,
  Sliders,
  Radio,
  Play,
  CornerDownRight,
  X,
} from 'lucide-react';
import type { RaceState, PredictResponse } from '../api/client';
import { setPredictedAction } from '../api/mockData';
import {
  TRACK_WIDTH,
  TRACK_HEIGHT,
  CIRCUIT_PATH,
  CURBS,
  SILVERSTONE_TURNS,
  type CircuitTurnMarker,
  getSilverstoneTelemetry,
} from '../utils/silverstoneTrack';
import './TrackSimulation.css';

interface Props {
  raceState: RaceState | null;
  prediction: PredictResponse | null;
  isRunning: boolean;
  isSimpleMode?: boolean;
  onToggleUiMode?: () => void;
}

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

  // Feature 1: Driver & Pit Wall Strategy Overrides
  const [controlMode, setControlMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [manualAction, setManualAction] = useState<PredictResponse['action']>('OVERTAKE');
  const [engineMode, setEngineMode] = useState<'STRAT 1' | 'STRAT 5' | 'STRAT 12'>('STRAT 1');
  const [pitStatus, setPitStatus] = useState<'ON TRACK' | 'BOX THIS LAP' | 'IN PIT LANE'>('ON TRACK');

  // Active strategy action: Manual user override vs AI Prediction
  const action: PredictResponse['action'] =
    controlMode === 'MANUAL' ? manualAction : (prediction?.action ?? 'HOLD');

  // Feature 2: Interactive Corner Telemetry Inspector
  const [selectedTurn, setSelectedTurn] = useState<CircuitTurnMarker | null>(null);

  // Feature 3: Interactive Lap Progress Scrubber (Playhead)
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);

  // Tactical Actions
  const handleSetManualAction = useCallback((act: PredictResponse['action']) => {
    setControlMode('MANUAL');
    setManualAction(act);
    setPredictedAction(act);
  }, []);

  const handleTogglePitCall = useCallback(() => {
    if (pitStatus === 'ON TRACK') {
      setPitStatus('BOX THIS LAP');
      setTimeout(() => {
        setPitStatus('IN PIT LANE');
        setTimeout(() => {
          setPitStatus('ON TRACK');
        }, 2400); // 2.4s stationary pit stop
      }, 3000);
    } else {
      setPitStatus('ON TRACK');
    }
  }, [pitStatus]);

  const handleScrubberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCarProgress(val);
    setIsScrubbing(true);
  }, []);

  const handleLiveSync = useCallback(() => {
    setIsScrubbing(false);
  }, []);

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
      const dt = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;

      if (isRunning && !isScrubbing) {
        setCarProgress((prev) => {
          // Authentic Silverstone circuit physics:
          // Evaluate instantaneous speed from the 18-turn track profile
          const isDrs = (prev > 0.88 || prev < 0.14) || (prev >= 0.34 && prev <= 0.40);
          const tel = getSilverstoneTelemetry(prev, isDrs);

          // Boost speed slightly if in aggressive engine mode STRAT 1
          const stratMultiplier = engineMode === 'STRAT 1' ? 1.04 : engineMode === 'STRAT 12' ? 0.95 : 1.0;
          const currentSpeed = tel.speed * stratMultiplier;

          // Realistic Silverstone lap speed progression:
          // Average speed across lap is ~243.5 km/h.
          // Visual calibration factor ~0.038 gives ~26.3s per complete lap
          const speedDelta = (currentSpeed / 243.5) * 0.038 * dt;
          return (prev + speedDelta) % 1;
        });

        // Overtake vs energy preservation dynamics
        const isOvertakeMode = action === 'OVERTAKE';
        const targetOvertake = isOvertakeMode ? 1.0 : -1.0;
        const transitionSpeed = isOvertakeMode ? 0.38 : 0.42;

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
  }, [isRunning, isScrubbing, action, engineMode]);

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
        cornerName: 'Hamilton Straight',
      };
    }

    return getSilverstoneTelemetry(carProgress, isDrsActive);
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
  const isHighThrottle = telemetryDynamics.throttle > 75;
  const isBraking = telemetryDynamics.brake > 35;

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
              {/* <div className="track-sim__hud-item">
                <span className="track-sim__hud-label"><Disc size={9} /> TYRE DEG</span>
                <span className="track-sim__hud-val mono" style={{ color: tyreDeg > 60 ? '#ef4444' : tyreDeg > 30 ? '#f59e0b' : '#10e782' }}>
                  {tyreDeg.toFixed(1)}% <small>(C3)</small>
                </span>
              </div> */}

              {/* Efficiency in Header */}
              {/* <div className="track-sim__hud-item">
                <span className="track-sim__hud-label"><Cpu size={9} /> EFFICIENCY</span>
                <span className="track-sim__hud-val mono" style={{ color: 'var(--accent)' }}>
                  {ersEfficiency.toFixed(1)}%
                </span>
              </div> */}
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

      {/* ── Driver & Pit Wall Strategy Deck (Interactive Controls) ─────── */}
      <div className="track-sim__control-deck" role="toolbar" aria-label="Pit Wall & Driver Tactical Overrides">
        {/* Mode Toggle AUTO vs MANUAL */}
        <div className="track-sim__deck-group">
          <span className="track-sim__deck-label"><Radio size={11} /> PIT WALL MODE:</span>
          <div className="track-sim__mode-toggle">
            <button
              type="button"
              className={`track-sim__mode-btn ${controlMode === 'AUTO' ? 'track-sim__mode-btn--active-auto' : ''}`}
              onClick={() => {
                setControlMode('AUTO');
                if (prediction) setPredictedAction(prediction.action);
              }}
              title="Autonomous AI Motorsport Strategy Engine"
            >
              <Cpu size={12} />
              <span>AI AUTO</span>
            </button>
            <button
              type="button"
              className={`track-sim__mode-btn ${controlMode === 'MANUAL' ? 'track-sim__mode-btn--active-manual' : ''}`}
              onClick={() => {
                setControlMode('MANUAL');
                setPredictedAction(manualAction);
              }}
              title="Manual Driver Override (Steering Wheel Tactical Buttons)"
            >
              <Sliders size={12} />
              <span>MANUAL DRIVER</span>
            </button>
          </div>
        </div>

        {/* Tactical Strategy Action Buttons */}
        <div className="track-sim__deck-group">
          <span className="track-sim__deck-label">TACTICAL OVERRIDE:</span>
          <div className="track-sim__tactical-buttons">
            <button
              type="button"
              className={`tactical-btn tactical-btn--attack ${action === 'OVERTAKE' ? 'tactical-btn--active' : ''}`}
              onClick={() => handleSetManualAction('OVERTAKE')}
              title="Deploy full 120kW MGU-K hybrid boost, open DRS, and execute inside lane dive"
            >
              <Zap size={12} />
              <span>⚔️ ATTACK</span>
            </button>
            <button
              type="button"
              className={`tactical-btn tactical-btn--balanced ${action === 'HOLD' ? 'tactical-btn--active' : ''}`}
              onClick={() => handleSetManualAction('HOLD')}
              title="Cruise in slipstream, preserve 4.0MJ lap quota, manage tire thermals"
            >
              <Flag size={12} />
              <span>🛡️ BALANCED</span>
            </button>
            <button
              type="button"
              className={`tactical-btn tactical-btn--harvest ${action === 'RECOVER' ? 'tactical-btn--active' : ''}`}
              onClick={() => handleSetManualAction('RECOVER')}
              title="Lift-and-coast into braking zones, maximize kinetic energy regeneration"
            >
              <RefreshCw size={12} />
              <span>🔋 HARVEST</span>
            </button>
          </div>
        </div>

        {/* PU Engine Map & Pit Command */}
        <div className="track-sim__deck-group">
          <span className="track-sim__deck-label">PU ENGINE MAP:</span>
          <div className="track-sim__engine-maps">
            {(['STRAT 1', 'STRAT 5', 'STRAT 12'] as const).map((map) => (
              <button
                key={map}
                type="button"
                className={`engine-map-btn ${engineMode === map ? 'engine-map-btn--active' : ''}`}
                onClick={() => setEngineMode(map)}
                title={map === 'STRAT 1' ? 'Strat 1: Full Quali Deploy (-120kW)' : map === 'STRAT 5' ? 'Strat 5: Standard Race Pace' : 'Strat 12: Super Harvest'}
              >
                {map}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`tactical-btn tactical-btn--box ${pitStatus !== 'ON TRACK' ? 'tactical-btn--box-active' : ''}`}
            onClick={handleTogglePitCall}
            title="Radio Call: Box this lap for pit stop"
          >
            <Disc size={12} />
            <span>{pitStatus === 'ON TRACK' ? 'BOX THIS LAP' : pitStatus}</span>
          </button>
        </div>
      </div>

      {/* ── Realistic Circuit SVG Canvas ───────────────────────────────── */}
      <div className="track-sim__canvas-wrapper">
        {/* ── Interactive Corner Telemetry Inspector Card ───────────── */}
        {selectedTurn && (
          <div className="track-sim__corner-inspector" role="dialog" aria-label={`Corner Telemetry for ${selectedTurn.name}`}>
            <div className="corner-inspector__header">
              <div className="corner-inspector__title-row">
                <span className="corner-inspector__badge">T{selectedTurn.number}</span>
                <div className="corner-inspector__name-col">
                  <h4 className="corner-inspector__name">{selectedTurn.name}</h4>
                  <span className="corner-inspector__sub">SILVERSTONE SECTOR {selectedTurn.sector}</span>
                </div>
                <span className={`corner-inspector__type-tag tag--${selectedTurn.type}`}>{selectedTurn.type.toUpperCase()}</span>
              </div>
              <button
                type="button"
                className="corner-inspector__close"
                onClick={() => setSelectedTurn(null)}
                aria-label="Close corner inspector"
              >
                <X size={14} />
              </button>
            </div>

            <div className="corner-inspector__grid">
              <div className="corner-stat">
                <span className="corner-stat__lbl">APEX SPEED</span>
                <strong className="corner-stat__val mono">{selectedTurn.apexSpeed} <small>KM/H</small></strong>
              </div>
              <div className="corner-stat">
                <span className="corner-stat__lbl">ENTRY SPEED</span>
                <strong className="corner-stat__val mono">{selectedTurn.entrySpeed} <small>KM/H</small></strong>
              </div>
              <div className="corner-stat">
                <span className="corner-stat__lbl">EXIT SPEED</span>
                <strong className="corner-stat__val mono">{selectedTurn.exitSpeed} <small>KM/H</small></strong>
              </div>
              <div className="corner-stat">
                <span className="corner-stat__lbl">GEAR</span>
                <strong className="corner-stat__val mono corner-stat__gear">G{selectedTurn.gear}</strong>
              </div>
              <div className="corner-stat">
                <span className="corner-stat__lbl">LATERAL LOAD</span>
                <strong className="corner-stat__val mono" style={{ color: selectedTurn.latG > 4.0 ? '#ef4444' : '#f59e0b' }}>
                  {selectedTurn.latG}G
                </strong>
              </div>
              <div className="corner-stat">
                <span className="corner-stat__lbl">BRAKING ZONE</span>
                <strong className="corner-stat__val mono">
                  {selectedTurn.brakingDistanceM > 0 ? `${selectedTurn.brakingDistanceM}m (${selectedTurn.brakingG}G)` : 'FLAT OUT (0m)'}
                </strong>
              </div>
            </div>

            <div className="corner-inspector__meta">
              <div className="meta-item">
                <span>TACTICAL & DRS NOTES:</span>
                <p>{selectedTurn.drsRelevance}</p>
              </div>
              <div className="meta-item-split">
                <span>EXIT FULL THROTTLE: <strong className="mono">{selectedTurn.fullThrottleExitPct}%</strong></span>
                <span>KERB AGGRESSIVENESS: <strong className="mono">{selectedTurn.kerbAggressiveness.toUpperCase()}</strong></span>
              </div>
            </div>

            <div className="corner-inspector__actions">
              <button
                type="button"
                className="corner-btn corner-btn--jump"
                onClick={() => {
                  setCarProgress(selectedTurn.trackProgress);
                  setIsScrubbing(true);
                }}
              >
                <CornerDownRight size={13} />
                <span>JUMP CAR TO APEX ({Math.round(selectedTurn.trackProgress * 100)}% LAP)</span>
              </button>
              <button
                type="button"
                className="corner-btn corner-btn--dismiss"
                onClick={() => setSelectedTurn(null)}
              >
                DISMISS
              </button>
            </div>
          </div>
        )}

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
              <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.65 0" />
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

              {/* DRS Detection Points & Activation Zones */}
              <g className="track-sim__drs-markers">
                {/* DRS Detection 1: Village */}
                <g transform="translate(915, 345)">
                  <line x1="-12" y1="0" x2="12" y2="0" stroke="#00f0ff" strokeWidth="2" strokeDasharray="3 2" />
                  <rect x="-18" y="-12" width="36" height="8" rx="2" fill="#04121e" stroke="#00f0ff" strokeWidth="0.8" />
                  <text x="0" y="-6" textAnchor="middle" fill="#00f0ff" fontSize="5" fontWeight="bold">DRS DET 1</text>
                </g>
                {/* DRS Zone 1: Wellington Straight */}
                <g transform="translate(730, 170)">
                  <line x1="0" y1="-12" x2="0" y2="12" stroke="#10e782" strokeWidth="2.2" />
                  <rect x="-20" y="-19" width="40" height="8" rx="2" fill="#021a10" stroke="#10e782" strokeWidth="0.8" />
                  <text x="0" y="-13" textAnchor="middle" fill="#10e782" fontSize="5" fontWeight="bold">DRS ZONE 1</text>
                </g>
                {/* DRS Detection 2: Becketts */}
                <g transform="translate(365, 30)">
                  <line x1="0" y1="-12" x2="0" y2="12" stroke="#00f0ff" strokeWidth="2" strokeDasharray="3 2" />
                  <rect x="-18" y="-14" width="36" height="8" rx="2" fill="#04121e" stroke="#00f0ff" strokeWidth="0.8" />
                  <text x="0" y="-8" textAnchor="middle" fill="#00f0ff" fontSize="5" fontWeight="bold">DRS DET 2</text>
                </g>
                {/* DRS Zone 2: Chapel Exit */}
                <g transform="translate(120, 110)">
                  <line x1="-12" y1="0" x2="12" y2="0" stroke="#10e782" strokeWidth="2.2" />
                  <rect x="10" y="-4" width="40" height="8" rx="2" fill="#021a10" stroke="#10e782" strokeWidth="0.8" />
                  <text x="30" y="2" textAnchor="middle" fill="#10e782" fontSize="5" fontWeight="bold">DRS ZONE 2</text>
                </g>
                {/* Speed Trap: Hangar Straight */}
                <g transform="translate(120, 175)">
                  <line x1="-12" y1="0" x2="12" y2="0" stroke="#f59e0b" strokeWidth="2" strokeDasharray="2 2" />
                  <rect x="10" y="-4" width="56" height="8" rx="2" fill="#1c1404" stroke="#f59e0b" strokeWidth="0.8" />
                  <text x="38" y="2" textAnchor="middle" fill="#f59e0b" fontSize="5" fontWeight="bold">SPEED TRAP 336</text>
                </g>
                {/* Start / Finish Checkered Gantry */}
                <g transform="translate(360, 410)">
                  <line x1="0" y1="-16" x2="0" y2="16" stroke="#ffffff" strokeWidth="2.5" strokeDasharray="4 4" />
                  <rect x="-30" y="16" width="60" height="8" rx="2" fill="#090d14" stroke="#ffffff" strokeWidth="0.8" />
                  <text x="0" y="22" textAnchor="middle" fill="#ffffff" fontSize="5" fontWeight="bold">FINISH LINE</text>
                </g>
              </g>

              {/* Official FIA Silverstone Turn Markers (T1 to T18) */}
              <g className="track-sim__turn-markers">
                {SILVERSTONE_TURNS.map((t) => (
                  <g
                    key={t.number}
                    transform={`translate(${t.x}, ${t.y})`}
                    className={`track-sim__turn-marker ${selectedTurn?.number === t.number ? 'track-sim__turn-marker--selected' : ''}`}
                    onClick={() => setSelectedTurn(t)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Inspect Turn ${t.number}: ${t.name}`}
                  >
                    {selectedTurn?.number === t.number && (
                      <circle
                        cx="0"
                        cy="0"
                        r="14"
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="1.8"
                        strokeDasharray="4 2"
                        className="track-sim__turn-beacon"
                      />
                    )}
                    <circle
                      cx="0"
                      cy="0"
                      r="7.5"
                      fill="#0b1320"
                      stroke={selectedTurn?.number === t.number ? 'var(--accent)' : t.type === 'high-speed' ? '#00f0ff' : t.type === 'hairpin' ? '#ef4444' : '#10e782'}
                      strokeWidth={selectedTurn?.number === t.number ? '2.2' : '1.2'}
                      className="track-sim__turn-circle"
                    />
                    <text
                      x="0"
                      y="2.6"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="6.8"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      {t.number}
                    </text>
                  </g>
                ))}
              </g>

              {/* Silverstone Iconic Corners & Straights (Clean Off-Track Labels) */}
              <g className="track-sim__corner-annotations">
                {/* Start / Finish & Hamilton Straight */}
                <text x="450" y="445" className="track-sim__corner-label">HAMILTON STRAIGHT (START/FINISH)</text>

                {/* Abbey & Farm (T1 - T2) */}
                <text x="815" y="442" className="track-sim__corner-label track-sim__corner-label--apex">ABBEY & FARM (T1-T2)</text>

                {/* Village & The Loop (T3 - T4) */}
                <text x="880" y="270" className="track-sim__corner-label track-sim__corner-label--apex">THE LOOP (T4 • 88 KM/H)</text>

                {/* Wellington Straight (DRS Zone 1) */}
                <text x="770" y="98" className="track-sim__corner-label track-sim__corner-label--drs">WELLINGTON STRAIGHT (DRS 1)</text>

                {/* Brooklands & Luffield (T6 - T7) */}
                <text x="590" y="112" className="track-sim__corner-label track-sim__corner-label--apex">BROOKLANDS & LUFFIELD (T6-T7)</text>

                {/* Copse Corner (T9 - High Speed) */}
                <text x="475" y="202" className="track-sim__corner-label track-sim__corner-label--apex">COPSE (T9 • 282 KM/H • 5.1G)</text>

                {/* Maggotts & Becketts (T10 - T13) */}
                <text x="235" y="18" className="track-sim__corner-label track-sim__corner-label--apex">MAGGOTTS & BECKETTS (T10-T13)</text>

                {/* Chapel Curve (T14) */}
                <text x="140" y="18" className="track-sim__corner-label">CHAPEL (T14)</text>

                {/* Hangar Straight (DRS Zone 2) */}
                <text x="42" y="130" transform="rotate(-90 42 130)" className="track-sim__corner-label track-sim__corner-label--drs">
                  HANGAR STRAIGHT (DRS 2 • 336 KM/H)
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
              <div className="track-sim__onboard-pill track-sim__onboard-pill--corner">
                <span>APEX</span>
                <strong className="mono" style={{ color: '#fbbf24' }}>{telemetryDynamics.cornerName}</strong>
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

      {/* ── Interactive Lap Progress Scrubber (Playhead) ─────────────── */}
      <div className="track-sim__scrubber-container" role="region" aria-label="Interactive Lap Progress Scrubber">
        <div className="track-sim__scrubber-header">
          <div className="scrubber-left">
            <span className="scrubber-title"><Timer size={11} /> LAP PLAYHEAD:</span>
            <span className="scrubber-track-dist mono">
              {(carProgress * 5.891).toFixed(2)} / 5.891 KM ({Math.round(carProgress * 100)}%)
            </span>
            <span className="scrubber-corner-badge mono">
              {telemetryDynamics.cornerName}
            </span>
          </div>

          <div className="scrubber-right">
            {isScrubbing ? (
              <button
                type="button"
                className="scrubber-live-btn scrubber-live-btn--pulsing"
                onClick={handleLiveSync}
                title="Resume live continuous race simulation"
              >
                <Play size={10} />
                <span>RESUME LIVE SYNC</span>
              </button>
            ) : (
              <span className="scrubber-status-badge">
                <span className="live-dot" /> LIVE TRANSMITTING
              </span>
            )}
          </div>
        </div>

        {/* Range slider with Sector 1 / 2 / 3 gradient track */}
        <div className="track-sim__scrubber-bar">
          <input
            type="range"
            min="0"
            max="1"
            step="0.002"
            value={carProgress}
            onChange={handleScrubberChange}
            className="track-sim__scrubber-slider"
            aria-label="Lap progress slider"
          />
          <div className="scrubber-sector-ticks">
            <span className="tick-s1" style={{ left: '0%' }}>S1 (0.00km)</span>
            <span className="tick-s2" style={{ left: '35%' }}>S2 (2.06km)</span>
            <span className="tick-s3" style={{ left: '72%' }}>S3 (4.24km)</span>
            <span className="tick-fin" style={{ right: '0%' }}>FINISH</span>
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
                <span>V6 TURBO HYBRID REVS:</span>
                <strong className="mono" style={{ color: activeLeds === 15 ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {isRunning ? telemetryDynamics.rpm.toLocaleString() : '4,200'} RPM ({activeLeds}/15 LEDS ACTIVE • PEAK 12,850)
                </strong>
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

          {/* Card 7: Silverstone Grand Prix Circuit Benchmarks & Real Track Data */}
          <div className="track-sim__drawer-card">
            <div className="track-sim__drawer-header">
              <Timer size={13} />
              <span>SILVERSTONE GP BENCHMARKS & CIRCUIT DATA</span>
            </div>
            <div className="track-sim__drawer-body">
              <div className="track-sim__stat-pair">
                <span>CIRCUIT SPEC:</span>
                <strong className="mono">5.891 KM (3.660 MI) • 18 TURNS (10R, 8L) • 52 LAPS</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>OFFICIAL LAP RECORD:</span>
                <strong className="mono" style={{ color: 'var(--accent)' }}>
                  1:27.097 (M. VERSTAPPEN • RED BULL RB16 • 243.5 KM/H AVG)
                </strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>TOP SPEED TRAP (HANGAR):</span>
                <strong className="mono" style={{ color: '#f59e0b' }}>336.4 KM/H (209.0 MPH)</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>SLOWEST APEX (THE LOOP):</span>
                <strong className="mono">88.0 KM/H (TURN 4 HAIRPIN • GEAR 2)</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>MAX CORNERING LOAD:</span>
                <strong className="mono" style={{ color: '#ef4444' }}>5.2G LATERAL (TURN 9 COPSE • 282 KM/H)</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>HEAVIEST BRAKING:</span>
                <strong className="mono">-4.8G LONGITUDINAL (TURN 15 STOWE • 336 → 182 KM/H)</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>DRS ACTIVATION ZONES:</span>
                <strong className="mono" style={{ color: '#10e782' }}>ZONE 1: WELLINGTON (480M) • ZONE 2: HANGAR (750M)</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>WEATHER / TRACK:</span>
                <strong className="mono">TRACK: 34.2°C • AIR: 21.4°C • WIND: 14 KM/H SW (HEADWIND)</strong>
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
