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
import { Zap, Eye, Flag, ChevronDown, ChevronUp, Gauge, Thermometer, Wind, ArrowUp, ArrowDown, Timer } from 'lucide-react';
import type { RaceState, PredictResponse } from '../api/client';
import './TrackSimulation.css';

interface Props {
  raceState: RaceState | null;
  prediction: PredictResponse | null;
  isRunning: boolean;
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

export default function TrackSimulation({ raceState, prediction, isRunning }: Props) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [totalLength, setTotalLength] = useState<number>(1);
  const [carProgress, setCarProgress] = useState<number>(0.15); // 0 to 1
  const [cameraFollow, setCameraFollow] = useState<boolean>(false);
  const [showDetailedStats, setShowDetailedStats] = useState<boolean>(true);

  // Measure path length on mount
  useEffect(() => {
    if (pathRef.current) {
      setTotalLength(pathRef.current.getTotalLength());
    }
  }, []);

  // Update car progress continuously when running
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
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, raceState]);

  // Compute positions & heading angles for cars
  const carState = useMemo(() => {
    if (!pathRef.current || totalLength <= 1) {
      return {
        sazi: { x: 400, y: 410, angle: 0 },
        rival: { x: 470, y: 410, angle: 0 },
        field: { x: 260, y: 30, angle: 180 },
      };
    }

    const path = pathRef.current;

    // SAZI car
    const saziDist = (carProgress * totalLength) % totalLength;
    const p1 = path.getPointAtLength(saziDist);
    const p2 = path.getPointAtLength((saziDist + 2) % totalLength);
    const saziAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);

    // Rival car offset by gap
    const gapSec = raceState ? raceState.gap_ahead_s : 1.35;
    const rivalOffset = Math.min(Math.max((gapSec / 75), 0.035), 0.16);
    const rivalDist = ((carProgress + rivalOffset) * totalLength) % totalLength;
    const rp1 = path.getPointAtLength(rivalDist);
    const rp2 = path.getPointAtLength((rivalDist + 2) % totalLength);
    const rivalAngle = Math.atan2(rp2.y - rp1.y, rp2.x - rp1.x) * (180 / Math.PI);

    // Midfield car
    const fieldDist = ((carProgress - 0.22 + 1) * totalLength) % totalLength;
    const fp1 = path.getPointAtLength(fieldDist);
    const fp2 = path.getPointAtLength((fieldDist + 2) % totalLength);
    const fieldAngle = Math.atan2(fp2.y - fp1.y, fp2.x - fp1.x) * (180 / Math.PI);

    return {
      sazi: { x: p1.x, y: p1.y, angle: saziAngle },
      rival: { x: rp1.x, y: rp1.y, angle: rivalAngle },
      field: { x: fp1.x, y: fp1.y, angle: fieldAngle },
    };
  }, [carProgress, totalLength, raceState]);

  // Telemetry attributes
  const action = prediction?.action ?? 'HOLD';
  const speed = raceState?.speed_kph ?? (isRunning ? 292 : 0);
  const ers = raceState?.ers_pct ?? 65;
  const gapAhead = raceState?.gap_ahead_s ?? 1.34;
  const currentLap = raceState?.lap ?? 1;
  const totalLaps = raceState?.total_laps ?? 57;

  // Sector calculation
  const sector = carProgress < 0.35 ? 'SECTOR 1' : carProgress < 0.72 ? 'SECTOR 2' : 'SECTOR 3';
  const isDrsZone = carProgress > 0.88 || carProgress < 0.14;
  const isDrsActive = isDrsZone && (action === 'OVERTAKE' || gapAhead <= 1.0);

  // Dynamic Telemetry: Throttle, Brake, Gear, Shifts, RPM, G-Force based on track sectors
  const telemetryDynamics = useMemo(() => {
    const isHeavyBrakingZone = (carProgress > 0.72 && carProgress < 0.78) || (carProgress > 0.33 && carProgress < 0.38);
    const isHighSpeedStraight = carProgress > 0.85 || carProgress < 0.15 || (carProgress > 0.50 && carProgress < 0.62);

    let throttle = 85;
    let brake = 0;
    let gear = 7;
    let rpm = 11800;
    let latG = 1.2;
    let lonG = 0.8;
    let shiftState: 'UPSHIFT' | 'DOWNSHIFT' | 'HOLD' | 'NEUTRAL' = 'HOLD';

    if (!isRunning) {
      return {
        throttle: 0,
        brake: 0,
        gear: 1,
        rpm: 4200,
        latG: 0,
        lonG: 0,
        brakeTemp: 450,
        shiftState: 'NEUTRAL' as const,
        totalShifts: 0,
      };
    }

    if (isHeavyBrakingZone) {
      throttle = 0;
      brake = 95;
      gear = 3;
      rpm = 9600;
      latG = 1.8;
      lonG = -4.4; // heavy deceleration
      shiftState = 'DOWNSHIFT';
    } else if (isHighSpeedStraight) {
      throttle = isDrsActive ? 100 : 98;
      brake = 0;
      gear = 8;
      rpm = isDrsActive ? 12850 : 12400;
      latG = 0.4;
      lonG = 1.9; // acceleration
      shiftState = 'UPSHIFT';
    } else {
      // Cornering
      throttle = 58;
      brake = 12;
      gear = 4;
      rpm = 10500;
      latG = 3.6; // High lateral cornering G
      lonG = -0.4;
      shiftState = 'HOLD';
    }

    const brakeTemp = isHeavyBrakingZone ? 820 : 640;
    const totalShifts = Math.min(52, Math.max(6, Math.round(48 * (carProgress || 0.1))));

    return { throttle, brake, gear, rpm, latG, lonG, brakeTemp, shiftState, totalShifts };
  }, [carProgress, isDrsActive, isRunning]);

  // Dynamic SVG ViewBox for Camera Follow Mode
  const viewBox = cameraFollow
    ? `${Math.max(0, Math.min(carState.sazi.x - 220, TRACK_WIDTH - 440))} ${Math.max(0, Math.min(carState.sazi.y - 150, TRACK_HEIGHT - 300))} 440 300`
    : `0 0 ${TRACK_WIDTH} ${TRACK_HEIGHT}`;

  // RPM LEDs (15 LEDs across rev spectrum)
  const rpmRatio = Math.max(0, Math.min(1, (telemetryDynamics.rpm - 8000) / 5000));
  const activeLeds = Math.round(rpmRatio * 15);

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

          {/* Gear and Shift */}
          <div className="track-sim__hud-item">
            <span className="track-sim__hud-label">GEAR</span>
            <span className="track-sim__hud-val track-sim__hud-gear">
              G{telemetryDynamics.gear}
              {telemetryDynamics.shiftState === 'UPSHIFT' && <ArrowUp size={11} className="shift-icon shift-icon--up" />}
              {telemetryDynamics.shiftState === 'DOWNSHIFT' && <ArrowDown size={11} className="shift-icon shift-icon--down" />}
            </span>
          </div>

          <div className="track-sim__hud-item">
            <span className="track-sim__hud-label">SPEED</span>
            <span className="track-sim__hud-val track-sim__hud-speed">{Math.round(speed)} <small>KM/H</small></span>
          </div>

          {/* DRS Mention in Header */}
          <div className="track-sim__hud-item">
            <span className="track-sim__hud-label">DRS WING</span>
            <span className={`track-sim__hud-val track-sim__drs ${isDrsActive ? 'track-sim__drs--open' : isDrsZone ? 'track-sim__drs--avail' : ''}`}>
              {isDrsActive ? 'OPEN (+12.8kph)' : isDrsZone ? 'ARMED (<1.0s)' : 'CLOSED'}
            </span>
          </div>

          {/* ERS Mention in Header */}
          <div className="track-sim__hud-item">
            <span className="track-sim__hud-label">ERS SYSTEM</span>
            <span className="track-sim__hud-val track-sim__hud-ers mono">
              {ers.toFixed(1)}% <small>({action === 'OVERTAKE' ? '-120kW' : action === 'RECOVER' ? '+85kW' : '45kW'})</small>
            </span>
          </div>

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

          {/* Toggle Detailed Telemetry Stats */}
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

            {/* Overtake Aero Wake Trail */}
            <linearGradient id="aeroWakeTrail" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="var(--overtake)" stopOpacity="0.9" />
              <stop offset="60%" stopColor="var(--overtake)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </linearGradient>

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

            <text x="0" y="-16" className="track-sim__car-label track-sim__car-label--rival">
              P{(raceState?.position ?? 2) - 1 > 0 ? (raceState?.position ?? 2) - 1 : 1} RIVAL (+{gapAhead.toFixed(2)}s)
            </text>
          </g>

          {/* ── CAR 1: SAZI AI F1 Car (Ultra-Realistic 3D Flagship) ───── */}
          <g
            transform={`translate(${carState.sazi.x}, ${carState.sazi.y}) rotate(${carState.sazi.angle})`}
            className={`track-sim__car-sazi track-sim__car-sazi--${action.toLowerCase()}`}
            filter="url(#f1GroundShadow)"
          >
            {/* OVERTAKE Mode: Twin Aerodynamic Wake Vortices & Speed Blur */}
            {action === 'OVERTAKE' && (
              <g className="track-sim__aero-trails">
                <rect x="-56" y="-7" width="38" height="14" rx="4" fill="url(#aeroWakeTrail)" />
                <line x1="-22" y1="-10" x2="-48" y2="-14" stroke="var(--overtake)" strokeWidth="2" strokeDasharray="4 2" />
                <line x1="-22" y1="10" x2="-48" y2="14" stroke="var(--overtake)" strokeWidth="2" strokeDasharray="4 2" />
              </g>
            )}

            {/* RECOVER Mode: Kinetic MGU-K Energy Regeneration Halo */}
            {action === 'RECOVER' && (
              <circle cx="-12" cy="0" r="24" fill="url(#ersHarvestHalo)" className="track-sim__ers-harvest-ring" />
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

            <text x="0" y="-17" className="track-sim__car-label track-sim__car-label--sazi">
              P{raceState?.position ?? 1} SAZI AI ({Math.round(speed)} KM/H)
            </text>
          </g>
        </svg>

        {/* ── F1 TV Broadcast Onboard Telemetry Graphic (Floating HUD) ── */}
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

          {/* LED Rev Lights */}
          <div className="track-sim__onboard-leds">
            {Array.from({ length: 15 }).map((_, i) => (
              <span
                key={i}
                className={`track-sim__led ${i < activeLeds ? (i < 5 ? 'track-sim__led--green' : i < 10 ? 'track-sim__led--yellow' : 'track-sim__led--red') : ''}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Advanced Detailed Telemetry Statistics Drawer ─────────────── */}
      {showDetailedStats && (
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

          {/* Card 3: ERS (Energy Recovery System) Hybrid Powertrain */}
          <div className="track-sim__drawer-card">
            <div className="track-sim__drawer-header">
              <Zap size={13} />
              <span>ERS (HYBRID ENERGY RECOVERY SYSTEM)</span>
            </div>
            <div className="track-sim__drawer-body">
              <div className="track-sim__stat-pair">
                <span>BATTERY STATE OF CHARGE:</span>
                <strong className="mono">{ers.toFixed(1)}% (2.62 MJ / 4.00 MJ CAPACITY)</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>MGU-K DEPLOYMENT FLOW:</span>
                <strong className="mono" style={{ color: action === 'OVERTAKE' ? 'var(--overtake)' : action === 'RECOVER' ? 'var(--recover)' : 'var(--accent)' }}>
                  {action === 'OVERTAKE'
                    ? '-120 kW (160 BHP) FULL ATTACK BOOST'
                    : action === 'RECOVER'
                    ? '+85 kW KINETIC HARVESTING UNDER BRAKING'
                    : '45 kW STRATEGIC CRUISE DEPLOYMENT'}
                </strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>ENERGY USED THIS LAP:</span>
                <strong className="mono">
                  {(raceState?.energy_deployed_mj ?? 1.85).toFixed(2)} MJ / {(raceState?.deployment_budget_mj ?? 4.0).toFixed(1)} MJ (FIA ALLOWANCE)
                </strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>MGU-H TURBO RECOVERY:</span>
                <strong className="mono">+35 kW CONTINUOUS HEAT HARVESTING</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>FIA RULE COMPLIANCE:</span>
                <strong className="mono" style={{ color: 'var(--success)' }}>
                  ARTICLE 5.2.2 ENERGY REGULATION PASS
                </strong>
              </div>
            </div>
          </div>

          {/* Card 4: Tires, G-Force & Thermal Telemetry */}
          <div className="track-sim__drawer-card">
            <div className="track-sim__drawer-header">
              <Thermometer size={13} />
              <span>TIRES, G-FORCE & THERMALS</span>
            </div>
            <div className="track-sim__drawer-body">
              {/* Compound spec */}
              <div className="track-sim__stat-pair">
                <span>SPECIFICATION:</span>
                <strong className="mono" style={{ color: '#fbbf24' }}>PIRELLI P-ZERO C3 MEDIUM (YELLOW)</strong>
              </div>

              {/* 4 Corner Tires */}
              <div className="track-sim__tires-grid">
                <div className="track-sim__tire-cell">
                  <span className="track-sim__tire-pos">FL</span>
                  <span className="track-sim__tire-temp">102°C</span>
                  <span className="track-sim__tire-psi">23.5 PSI</span>
                </div>
                <div className="track-sim__tire-cell">
                  <span className="track-sim__tire-pos">FR</span>
                  <span className="track-sim__tire-temp">105°C</span>
                  <span className="track-sim__tire-psi">23.8 PSI</span>
                </div>
                <div className="track-sim__tire-cell">
                  <span className="track-sim__tire-pos">RL</span>
                  <span className="track-sim__tire-temp">99°C</span>
                  <span className="track-sim__tire-psi">21.0 PSI</span>
                </div>
                <div className="track-sim__tire-cell">
                  <span className="track-sim__tire-pos">RR</span>
                  <span className="track-sim__tire-temp">101°C</span>
                  <span className="track-sim__tire-psi">21.2 PSI</span>
                </div>
              </div>

              <div className="track-sim__stat-pair">
                <span>LATERAL CORNERING G:</span>
                <strong className="mono">{telemetryDynamics.latG.toFixed(1)} G (PEAK 5.2G COPSE)</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>LONGITUDINAL G:</span>
                <strong className="mono">{telemetryDynamics.lonG > 0 ? `+${telemetryDynamics.lonG.toFixed(1)}` : telemetryDynamics.lonG.toFixed(1)} G (DECEL -4.8G)</strong>
              </div>

              <div className="track-sim__stat-pair">
                <span>CARBON BRAKE DISCS:</span>
                <strong className="mono" style={{ color: telemetryDynamics.brakeTemp > 800 ? '#ef4444' : '#f59e0b' }}>
                  {telemetryDynamics.brakeTemp}°C (VALE/BROOKLANDS)
                </strong>
              </div>
            </div>
          </div>

          {/* Card 5: Silverstone Grand Prix Circuit Benchmarks & Weather */}
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
