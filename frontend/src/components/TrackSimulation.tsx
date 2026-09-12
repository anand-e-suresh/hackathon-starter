/**
 * TrackSimulation.tsx
 * 2D Live Circuit Simulation for SAZI AI Motorsport Intelligence.
 *
 * Features:
 * - Full SVG Grand Prix racing circuit with apex curbs, DRS zones, and sectors
 * - Top-down animated F1 cars with orientation, slipstream, and aerodynamic trails
 * - SAZI AI Car reactive to prediction state:
 *     - OVERTAKE: Active DRS, red/orange aerodynamic trail & attack glow
 *     - RECOVER: Green kinetic harvesting aura & regeneration pulses
 *     - HOLD: Balanced slipstream
 * - Rival car tracking ahead/behind based on live gap_ahead_s
 * - Live circuit telemetry HUD: Sector splits, Speed (kph), DRS status, Lap %
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import { Zap, Eye, Flag } from 'lucide-react';
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

// Grand Prix Circuit SVG Path (Smooth continuous loop)
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

// Apex curb segments along critical corners
const CURBS = [
  { x: 740, y: 404, w: 60, h: 12, rot: 5 },
  { x: 904, y: 280, w: 12, h: 70, rot: 0 },
  { x: 770, y: 164, w: 50, h: 12, rot: 0 },
  { x: 645, y: 74, w: 40, h: 12, rot: -30 },
  { x: 260, y: 24, w: 60, h: 12, rot: 0 },
  { x: 114, y: 130, w: 12, h: 60, rot: 0 },
  { x: 450, y: 224, w: 50, h: 12, rot: 0 },
  { x: 480, y: 314, w: 45, h: 12, rot: 40 },
  { x: 110, y: 398, w: 40, h: 12, rot: -15 },
];

export default function TrackSimulation({ raceState, prediction, isRunning }: Props) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [totalLength, setTotalLength] = useState<number>(1);
  const [carProgress, setCarProgress] = useState<number>(0.15); // 0 to 1
  const [cameraFollow, setCameraFollow] = useState<boolean>(false);

  // Measure path length on mount
  useEffect(() => {
    if (pathRef.current) {
      setTotalLength(pathRef.current.getTotalLength());
    }
  }, []);

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (isRunning) {
        // Compute speed factor from telemetry or default 280 kph
        const speedKph = raceState?.speed_kph ?? 280;
        // In simulation, lap advance speed scaling
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

    // Rival car offset by gap (gap_ahead_s / 80s lap)
    const gapSec = raceState ? raceState.gap_ahead_s : 1.4;
    const rivalOffset = Math.min(Math.max((gapSec / 75), 0.03), 0.15);
    const rivalDist = ((carProgress + rivalOffset) * totalLength) % totalLength;
    const rp1 = path.getPointAtLength(rivalDist);
    const rp2 = path.getPointAtLength((rivalDist + 2) % totalLength);
    const rivalAngle = Math.atan2(rp2.y - rp1.y, rp2.x - rp1.x) * (180 / Math.PI);

    // Midfield car (further back)
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
  const speed = raceState?.speed_kph ?? (isRunning ? 295 : 0);
  const ers = raceState?.ers_pct ?? 65;
  const gapAhead = raceState?.gap_ahead_s ?? 1.34;
  const currentLap = raceState?.lap ?? 1;

  // Sector calculation
  const sector = carProgress < 0.35 ? 'SECTOR 1' : carProgress < 0.72 ? 'SECTOR 2' : 'SECTOR 3';
  // DRS zone on main start/finish straight (progress between 0.88 and 0.99 or 0.00 to 0.15)
  const isDrsZone = carProgress > 0.88 || carProgress < 0.14;
  const isDrsActive = isDrsZone && (action === 'OVERTAKE' || gapAhead <= 1.0);

  // Dynamic SVG ViewBox for Camera Follow Mode
  const viewBox = cameraFollow
    ? `${Math.max(0, Math.min(carState.sazi.x - 220, TRACK_WIDTH - 440))} ${Math.max(0, Math.min(carState.sazi.y - 150, TRACK_HEIGHT - 300))} 440 300`
    : `0 0 ${TRACK_WIDTH} ${TRACK_HEIGHT}`;

  return (
    <div className={`track-sim track-sim--${action.toLowerCase()}`} role="region" aria-label="Live 2D Track Simulation">
      {/* ── Top Header / HUD Bar ────────────────────────────────────────── */}
      <div className="track-sim__header">
        <div className="track-sim__title-group">
          <div className="track-sim__live-badge">
            <span className={`track-sim__pulse-dot ${isRunning ? 'track-sim__pulse-dot--active' : ''}`} />
            LIVE 2D CIRCUIT
          </div>
          <span className="track-sim__circuit-name">SAZI INTERNATIONAL CIRCUIT • GP LAYOUT</span>
        </div>

        {/* Telemetry stats pill */}
        <div className="track-sim__hud-metrics">
          <div className="track-sim__hud-item">
            <span className="track-sim__hud-label" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Flag size={9} /> LAP
            </span>
            <span className="track-sim__hud-val">{currentLap}<small>/{raceState?.total_laps ?? 57}</small></span>
          </div>

          <div className="track-sim__hud-item">
            <span className="track-sim__hud-label">SECTOR</span>
            <span className="track-sim__hud-val track-sim__hud-sector">{sector}</span>
          </div>

          <div className="track-sim__hud-item">
            <span className="track-sim__hud-label">SPEED</span>
            <span className="track-sim__hud-val track-sim__hud-speed">{Math.round(speed)} <small>KM/H</small></span>
          </div>

          <div className="track-sim__hud-item">
            <span className="track-sim__hud-label">DRS</span>
            <span className={`track-sim__hud-val track-sim__drs ${isDrsActive ? 'track-sim__drs--open' : isDrsZone ? 'track-sim__drs--avail' : ''}`}>
              {isDrsActive ? 'OPEN' : isDrsZone ? 'AVAILABLE' : 'CLOSED'}
            </span>
          </div>

          <div className="track-sim__hud-item">
            <span className="track-sim__hud-label">GAP TO P{(raceState?.position ?? 2) - 1 > 0 ? (raceState?.position ?? 2) - 1 : 1}</span>
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
        </div>
      </div>

      {/* ── Circuit Canvas ─────────────────────────────────────────────── */}
      <div className="track-sim__canvas-wrapper">
        <svg
          viewBox={viewBox}
          className="track-sim__svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Track Asphalt Texture / Shading */}
            <linearGradient id="asphaltGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--track-surface, #121c2b)" />
              <stop offset="100%" stopColor="var(--track-surface-dark, #0d1624)" />
            </linearGradient>

            {/* DRS Zone Highlight Gradient */}
            <linearGradient id="drsGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(56, 189, 248, 0.4)" />
              <stop offset="100%" stopColor="rgba(16, 231, 130, 0.4)" />
            </linearGradient>

            {/* SAZI Car Aero Exhaust Trail (Overtake Mode) */}
            <linearGradient id="aeroOvertake" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="var(--overtake)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </linearGradient>

            {/* SAZI Car ERS Harvest Aura (Recover Mode) */}
            <radialGradient id="ersHarvest" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--recover)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>

            {/* Shadow filter for cars */}
            <filter id="carShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* ── Infield / Background Detail ─────────────────────────────── */}
          <rect x="0" y="0" width={TRACK_WIDTH} height={TRACK_HEIGHT} className="track-sim__bg-infield" />

          {/* Pit Building / Main Grandstand Graphic */}
          <rect x="360" y="445" width="280" height="24" rx="3" className="track-sim__grandstand" />
          <text x="500" y="461" textAnchor="middle" className="track-sim__grandstand-label">
            PIT LANE & MAIN PADDOCK GRANDSTAND
          </text>

          {/* ── Runoff Areas (Gravel & Tarmac) ─────────────────────────── */}
          {/* Turn 1 Runoff */}
          <path
            d="M 740 435 C 860 435, 935 385, 935 290 C 935 230, 890 190, 830 190"
            className="track-sim__runoff"
          />
          {/* Turn 3 Hairpin Runoff */}
          <path
            d="M 260 10 C 160 10, 95 60, 95 140 C 95 210, 150 255, 230 255"
            className="track-sim__runoff"
          />

          {/* ── Track Surface Base ─────────────────────────────────────── */}
          {/* Outer Border / Curb Support */}
          <path
            d={CIRCUIT_PATH}
            className="track-sim__asphalt-outer"
            strokeWidth="38"
          />

          {/* Main Asphalt Racing Strip */}
          <path
            ref={pathRef}
            d={CIRCUIT_PATH}
            className="track-sim__asphalt"
            strokeWidth="30"
          />

          {/* Racing Line (Rubbered In) */}
          <path
            d={CIRCUIT_PATH}
            className="track-sim__racing-line"
            strokeWidth="12"
          />

          {/* DRS Zone on Main Straight */}
          <path
            d="M 240 410 L 710 410"
            className={`track-sim__drs-zone ${isDrsActive ? 'track-sim__drs-zone--active' : ''}`}
            strokeWidth="32"
          />

          {/* Track Curbs (Apex & Exit Kerbs) */}
          {CURBS.map((c, idx) => (
            <rect
              key={idx}
              x={c.x}
              y={c.y}
              width={c.w}
              height={c.h}
              transform={`rotate(${c.rot}, ${c.x + c.w / 2}, ${c.y + c.h / 2})`}
              className="track-sim__curb"
            />
          ))}

          {/* Start / Finish Line */}
          <g transform="translate(320, 395)">
            <line x1="0" y1="0" x2="0" y2="30" className="track-sim__sf-line" strokeWidth="4" />
            <line x1="3" y1="0" x2="3" y2="30" className="track-sim__sf-checkers" strokeWidth="2" strokeDasharray="3 3" />
            <text x="-8" y="-4" className="track-sim__sf-text">START / FINISH</text>
          </g>

          {/* Sector 1 & 2 Split Markers */}
          <g transform="translate(770, 155)">
            <line x1="0" y1="0" x2="0" y2="30" className="track-sim__split-line" />
            <text x="0" y="-4" className="track-sim__split-text">INT 1</text>
          </g>
          <g transform="translate(260, 215)">
            <line x1="0" y1="0" x2="0" y2="30" className="track-sim__split-line" />
            <text x="0" y="-4" className="track-sim__split-text">INT 2</text>
          </g>

          {/* ── CAR 3: Field / Backmarker Car ─────────────────────────── */}
          <g
            transform={`translate(${carState.field.x}, ${carState.field.y}) rotate(${carState.field.angle})`}
            className="track-sim__car-group"
          >
            {/* Chassis */}
            <rect x="-14" y="-6" width="28" height="12" rx="4" fill="#64748b" filter="url(#carShadow)" />
            {/* Tires */}
            <rect x="-12" y="-8" width="6" height="3" rx="1" fill="#1e293b" />
            <rect x="-12" y="5" width="6" height="3" rx="1" fill="#1e293b" />
            <rect x="7" y="-8" width="5" height="3" rx="1" fill="#1e293b" />
            <rect x="7" y="5" width="5" height="3" rx="1" fill="#1e293b" />
            {/* Cockpit */}
            <rect x="-2" y="-3" width="8" height="6" rx="2" fill="#0f172a" />
            <circle cx="2" cy="0" r="2" fill="#f8fafc" />
          </g>

          {/* ── CAR 2: Rival Competitor Car ───────────────────────────── */}
          <g
            transform={`translate(${carState.rival.x}, ${carState.rival.y}) rotate(${carState.rival.angle})`}
            className="track-sim__car-group track-sim__car-rival"
          >
            {/* Rear wing */}
            <rect x="-16" y="-8" width="3" height="16" rx="1" fill="#ef4444" />
            {/* Chassis body */}
            <path
              d="M -15 -5 L 5 -5 L 14 -3 L 17 0 L 14 3 L 5 5 L -15 5 Z"
              fill="#e2e8f0"
              stroke="#94a3b8"
              strokeWidth="0.8"
              filter="url(#carShadow)"
            />
            {/* Livery stripe */}
            <path d="M -10 -2 L 12 0 L -10 2 Z" fill="#ef4444" />
            {/* Tires */}
            <rect x="-13" y="-9" width="7" height="4" rx="1.5" fill="#0f172a" stroke="#ef4444" strokeWidth="0.5" />
            <rect x="-13" y="5" width="7" height="4" rx="1.5" fill="#0f172a" stroke="#ef4444" strokeWidth="0.5" />
            <rect x="7" y="-8.5" width="6" height="3.5" rx="1.5" fill="#0f172a" stroke="#ef4444" strokeWidth="0.5" />
            <rect x="7" y="5" width="6" height="3.5" rx="1.5" fill="#0f172a" stroke="#ef4444" strokeWidth="0.5" />
            {/* Front Wing */}
            <rect x="15" y="-7" width="2" height="14" rx="1" fill="#e2e8f0" />
            {/* Cockpit & Helmet */}
            <rect x="-3" y="-3" width="8" height="6" rx="2" fill="#0f172a" />
            <circle cx="1" cy="0" r="2.2" fill="#fbbf24" />
            {/* Label */}
            <text x="-4" y="-12" className="track-sim__car-label track-sim__car-label--rival">
              P{(raceState?.position ?? 2) - 1 > 0 ? (raceState?.position ?? 2) - 1 : 1} RIVAL
            </text>
          </g>

          {/* ── CAR 1: SAZI AI F1 Car (Telemetry Star) ────────────────── */}
          <g
            transform={`translate(${carState.sazi.x}, ${carState.sazi.y}) rotate(${carState.sazi.angle})`}
            className={`track-sim__car-group track-sim__car-sazi track-sim__car-sazi--${action.toLowerCase()}`}
          >
            {/* OVERTAKE Mode: Aero Wake / Speed Streaks */}
            {action === 'OVERTAKE' && (
              <g className="track-sim__aero-trail">
                <rect x="-42" y="-5" width="28" height="10" rx="4" fill="url(#aeroOvertake)" />
                <line x1="-16" y1="-7" x2="-36" y2="-10" stroke="var(--overtake)" strokeWidth="1.5" strokeDasharray="3 2" />
                <line x1="-16" y1="7" x2="-36" y2="10" stroke="var(--overtake)" strokeWidth="1.5" strokeDasharray="3 2" />
              </g>
            )}

            {/* RECOVER Mode: ERS Energy Harvesting Aura */}
            {action === 'RECOVER' && (
              <circle cx="-10" cy="0" r="18" fill="url(#ersHarvest)" className="track-sim__ers-pulse" />
            )}

            {/* HOLD Mode: Steady slipstream lines */}
            {action === 'HOLD' && (
              <line x1="-16" y1="0" x2="-28" y2="0" stroke="var(--accent)" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
            )}

            {/* Rear Wing (DRS Flap Opens in Overtake / Active DRS) */}
            <rect
              x={isDrsActive ? -17 : -15}
              y="-9"
              width="3"
              height="18"
              rx="1"
              className={`track-sim__f1-rear-wing ${isDrsActive ? 'track-sim__f1-rear-wing--open' : ''}`}
            />

            {/* Main Aerodynamic Chassis Body */}
            <path
              d="M -15 -6 L 4 -6 L 15 -3.5 L 19 0 L 15 3.5 L 4 6 L -15 6 Z"
              className="track-sim__f1-chassis"
              filter="url(#carShadow)"
            />

            {/* Team Livery Accent Pattern */}
            <path
              d="M -12 -3 L 13 0 L -12 3 Z"
              className="track-sim__f1-livery"
            />

            {/* Halo Protection System */}
            <path
              d="M -2 -3 L 6 0 L -2 3"
              stroke="var(--accent)"
              strokeWidth="1.5"
              fill="none"
            />

            {/* Tires with Compound Ring */}
            <rect x="-13" y="-10" width="7" height="4" rx="1.5" className="track-sim__f1-tire" />
            <rect x="-13" y="6" width="7" height="4" rx="1.5" className="track-sim__f1-tire" />
            <rect x="7" y="-9.5" width="6.5" height="3.5" rx="1.5" className="track-sim__f1-tire" />
            <rect x="7" y="6" width="6.5" height="3.5" rx="1.5" className="track-sim__f1-tire" />

            {/* Front Wing with Vortex Endplates */}
            <rect x="17" y="-8.5" width="2.5" height="17" rx="1" className="track-sim__f1-front-wing" />

            {/* Cockpit & Driver Helmet */}
            <rect x="-4" y="-3.5" width="8" height="7" rx="2.5" fill="#060e18" />
            <circle cx="1" cy="0" r="2.4" className="track-sim__f1-helmet" />

            {/* Car Marker & Badge */}
            <text x="-4" y="-14" className="track-sim__car-label track-sim__car-label--sazi">
              P{raceState?.position ?? 1} SAZI AI
            </text>
          </g>
        </svg>
      </div>

      {/* ── Bottom Telemetry Legend / Bar ───────────────────────────────── */}
      <div className="track-sim__footer">
        <div className="track-sim__legend">
          <div className="track-sim__legend-item">
            <span className="track-sim__legend-dot track-sim__legend-dot--sazi" />
            <span>SAZI AI CAR (P{raceState?.position ?? 1})</span>
          </div>
          <div className="track-sim__legend-item">
            <span className="track-sim__legend-dot track-sim__legend-dot--rival" />
            <span>RIVAL COMPETITOR (+{gapAhead.toFixed(2)}s)</span>
          </div>
          <div className="track-sim__legend-item">
            <span className="track-sim__legend-dot track-sim__legend-dot--drs" />
            <span>DRS DETECTION & ACTIVATION STRAIGHT</span>
          </div>
        </div>

        <div className="track-sim__live-ers">
          <span className="track-sim__ers-label">ERS STORE:</span>
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
