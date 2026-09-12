/**
 * RaceStateBar — prominent top bar showing live telemetry values.
 * Polls /race-state every second while simulation is running.
 */
import { useEffect, useRef } from 'react';
import { Zap, Timer, Gauge, ChevronUp, ChevronDown, Activity } from 'lucide-react';
import type { RaceState } from '../api/client';
import './RaceStateBar.css';

interface Props {
  state: RaceState | null;
  isRunning: boolean;
}

export default function RaceStateBar({ state, isRunning }: Props) {
  const prevPos = useRef<number | null>(null);

  const posChanged = state && prevPos.current !== null && prevPos.current !== state.position;
  const posImproved = state && prevPos.current !== null && state.position < (prevPos.current ?? 99);

  useEffect(() => {
    if (state) prevPos.current = state.position;
  }, [state]);

  const ersClass =
    !state ? '' : state.ers_pct > 60 ? 'high' : state.ers_pct > 30 ? 'medium' : 'low';

  const gapAheadClass =
    !state ? '' : state.gap_ahead_s < 0.5 ? 'danger' : state.gap_ahead_s < 1.0 ? 'warning' : '';

  const progress = state ? (state.lap / state.total_laps) * 100 : 0;

  if (!state) {
    return (
      <div className="rsb rsb--empty">
        <span className="rsb__waiting">
          <Activity size={14} />
          WAITING FOR SIMULATION
        </span>
      </div>
    );
  }

  return (
    <div className="rsb">
      <div className="rsb__metrics">
        {/* LAP */}
        <div className="rsb__metric">
          <span className="rsb__label">
            <Timer size={12} /> LAP
          </span>
          <span className="rsb__value rsb__value--large">
            <span className="rsb__value--accent">{state.lap}</span>
            <span className="rsb__value--dim">/{state.total_laps}</span>
          </span>
        </div>

        <div className="rsb__divider" />

        {/* POSITION */}
        <div className="rsb__metric">
          <span className="rsb__label">POSITION</span>
          <span className={`rsb__value rsb__value--large rsb__pos ${posChanged ? (posImproved ? 'improved' : 'lost') : ''}`}>
            P{state.position}
            {posChanged && (
              posImproved
                ? <ChevronUp size={16} className="rsb__pos-icon pos-up" />
                : <ChevronDown size={16} className="rsb__pos-icon pos-down" />
            )}
          </span>
        </div>

        <div className="rsb__divider" />

        {/* SPEED */}
        <div className="rsb__metric">
          <span className="rsb__label">
            <Gauge size={12} /> SPEED
          </span>
          <span className="rsb__value rsb__value--large">
            {state.speed_kph}
            <span className="rsb__unit">km/h</span>
          </span>
        </div>

        <div className="rsb__divider" />

        {/* ERS */}
        <div className="rsb__metric">
          <span className="rsb__label">
            <Zap size={12} /> ERS
          </span>
          <div className="rsb__ers-group">
            <span className={`rsb__value rsb__value--large rsb__ers rsb__ers--${ersClass}`}>
              {state.ers_pct}%
            </span>
            <div className="rsb__ers-bar">
              <div
                className={`rsb__ers-fill rsb__ers-fill--${ersClass}`}
                style={{ width: `${state.ers_pct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rsb__divider" />

        {/* GAP AHEAD */}
        <div className="rsb__metric">
          <span className="rsb__label">GAP AHEAD</span>
          <span className={`rsb__value rsb__value--large ${gapAheadClass}`}>
            +{state.gap_ahead_s.toFixed(2)}s
          </span>
        </div>

        <div className="rsb__divider" />

        {/* GAP BEHIND */}
        <div className="rsb__metric">
          <span className="rsb__label">GAP BEHIND</span>
          <span className="rsb__value rsb__value--large">
            -{state.gap_behind_s.toFixed(2)}s
          </span>
        </div>

        <div className="rsb__divider" />

        {/* RACE PROGRESS */}
        <div className="rsb__metric rsb__metric--wide">
          <span className="rsb__label">RACE PROGRESS</span>
          <div className="rsb__progress-bar">
            <div
              className="rsb__progress-fill"
              style={{ width: `${progress}%` }}
            />
            <span className="rsb__progress-pct">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      {/* Status dot */}
      <div className={`rsb__status ${isRunning ? 'rsb__status--live' : 'rsb__status--paused'}`}>
        <span className="rsb__status-dot" />
        {isRunning ? 'LIVE' : 'PAUSED'}
      </div>
    </div>
  );
}
