/**
 * RaceStateBar — prominent top bar showing live telemetry values.
 * Polls /race-state every second while simulation is running.
 */
import { useEffect, useRef } from 'react';
import { Zap, Timer, Gauge, ChevronUp, ChevronDown, Activity, BatteryMedium, Disc, Cpu } from 'lucide-react';
import type { RaceState } from '../api/client';
import './RaceStateBar.css';

interface Props {
  state: RaceState | null;
  isRunning: boolean;
  isSimpleMode?: boolean;
}

export default function RaceStateBar({ state, isRunning, isSimpleMode = false }: Props) {
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

  // Battery, Tyre degradation, Flow, and Efficiency metrics
  const batterySoc = state ? (state.battery_soc_pct ?? state.ers_pct) : 65;
  const usableBatteryMj = ((batterySoc / 100) * 4.0).toFixed(2);

  const tyreDeg = state
    ? (state.tyre_deg_pct ?? Math.min(95, parseFloat(((state.lap * 0.42) + 5.8).toFixed(1))))
    : 14.8;
  const degClass = tyreDeg > 65 ? 'rsb__deg-fill--high' : tyreDeg > 35 ? 'rsb__deg-fill--medium' : 'rsb__deg-fill--low';

  const dischargeKw = state?.discharge_rate_kw ?? (state && state.speed_kph > 280 ? 120.0 : state && state.speed_kph > 240 ? 42.5 : 0.0);
  const rechargeKw = state?.recharge_rate_kw ?? (state && state.speed_kph < 245 ? 120.0 : state && state.speed_kph < 280 ? 35.0 : 0.0);
  const netFlowKw = rechargeKw - dischargeKw;
  const flowClass = netFlowKw < 0 ? 'rsb__flow--discharge' : netFlowKw > 0 ? 'rsb__flow--recharge' : 'rsb__flow--balanced';

  const efficiency = state ? (state.efficiency_pct ?? 94.2) : 94.2;

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

        {/* BATTERY LEFT / ERS */}
        <div className="rsb__metric">
          <span className="rsb__label">
            <BatteryMedium size={12} /> BATT LEFT
          </span>
          <div className="rsb__ers-group">
            <span className={`rsb__value rsb__value--large rsb__ers rsb__ers--${ersClass}`}>
              {batterySoc}% <small className="rsb__unit">{usableBatteryMj}MJ</small>
            </span>
            <div className="rsb__ers-bar">
              <div
                className={`rsb__ers-fill rsb__ers-fill--${ersClass}`}
                style={{ width: `${batterySoc}%` }}
              />
            </div>
          </div>
        </div>

        {/* Detailed Telemetry Metrics (Hidden in Simple/User-Friendly Mode) */}
        {!isSimpleMode && (
          <>
            <div className="rsb__divider" />

            {/* POWER FLOW: DISCHARGE / RECHARGE */}
            <div className="rsb__metric">
              <span className="rsb__label">
                <Zap size={12} /> POWER FLOW
              </span>
              <span className={`rsb__value rsb__value--large ${flowClass}`}>
                {netFlowKw < 0 ? `-${Math.abs(netFlowKw).toFixed(0)} kW` : netFlowKw > 0 ? `+${netFlowKw.toFixed(0)} kW` : '0 kW'}
                <small className="rsb__unit">{netFlowKw < 0 ? 'DISCH' : netFlowKw > 0 ? 'RECH' : 'BAL'}</small>
              </span>
            </div>

            <div className="rsb__divider" />

            {/* TYRE DEGRADATION */}
            <div className="rsb__metric">
              <span className="rsb__label">
                <Disc size={12} /> TYRE DEG
              </span>
              <div className="rsb__deg-group">
                <span className="rsb__value rsb__value--large">
                  {tyreDeg.toFixed(1)}% <small className="rsb__unit">C3</small>
                </span>
                <div className="rsb__deg-bar">
                  <div
                    className={`rsb__deg-fill ${degClass}`}
                    style={{ width: `${Math.min(100, tyreDeg)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="rsb__divider" />

            {/* EFFICIENCY */}
            <div className="rsb__metric">
              <span className="rsb__label">
                <Cpu size={12} /> EFFICIENCY
              </span>
              <span className="rsb__value rsb__value--large" style={{ color: 'var(--accent)' }}>
                {efficiency.toFixed(1)}%
              </span>
            </div>
          </>
        )}

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
