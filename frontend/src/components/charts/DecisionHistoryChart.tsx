/**
 * DecisionHistoryChart — Visual timeline strip of OVERTAKE/HOLD/RECOVER decisions.
 * Also marks adjusted (rule-constrained) timesteps.
 */
import type { DecisionPoint } from '../../api/client';
import './Chart.css';
import './DecisionHistoryChart.css';

interface Props {
  decisions: DecisionPoint[];
  isLoading?: boolean;
}

const ACTION_COLOR: Record<DecisionPoint['action'], string> = {
  OVERTAKE: 'var(--overtake)',
  HOLD:     'var(--hold)',
  RECOVER:  'var(--recover)',
};

const ACTION_SHORT: Record<DecisionPoint['action'], string> = {
  OVERTAKE: 'OT',
  HOLD:     'H',
  RECOVER:  'RC',
};

export default function DecisionHistoryChart({ decisions, isLoading }: Props) {
  if (isLoading) return <div className="chart-empty">LOADING DECISIONS…</div>;
  if (!decisions.length) return <div className="chart-empty">WAITING FOR SIMULATION</div>;

  // Show last 40 decisions max for readability
  const visible = decisions.slice(-40);

  return (
    <div className="chart-container">
      <div className="chart-header">
        <span className="chart-title">Decision History</span>
        <div className="dhc__legend">
          {(['OVERTAKE', 'HOLD', 'RECOVER'] as const).map((a) => (
            <span key={a} className="dhc__legend-item">
              <span className="dhc__legend-dot" style={{ background: ACTION_COLOR[a] }} />
              {a}
            </span>
          ))}
          <span className="dhc__legend-item">
            <span className="dhc__legend-dot dhc__legend-dot--adjusted" />
            ADJUSTED
          </span>
        </div>
      </div>

      {/* Timeline strip */}
      <div className="dhc__strip" role="img" aria-label="Decision history timeline">
        {visible.map((d) => (
          <div
            key={`${d.lap}-${d.step}`}
            className={`dhc__cell ${d.adjusted ? 'dhc__cell--adjusted' : ''}`}
            style={{ '--action-color': ACTION_COLOR[d.action] } as React.CSSProperties}
            title={`Lap ${d.lap}: ${d.action}${d.adjusted ? ' (adjusted)' : ''} — ${Math.round(d.confidence * 100)}% conf`}
            aria-label={`Lap ${d.lap}: ${d.action}`}
          >
            <span className="dhc__cell-label">{ACTION_SHORT[d.action]}</span>
            {d.adjusted && <span className="dhc__adjusted-marker" aria-label="Rule adjusted" />}
          </div>
        ))}
      </div>

      {/* Axis labels */}
      <div className="dhc__axis">
        {visible.length > 0 && (
          <>
            <span>Lap {visible[0].lap}</span>
            <span>Lap {visible[visible.length - 1].lap}</span>
          </>
        )}
      </div>

      {/* Action count summary */}
      <div className="dhc__summary">
        {(['OVERTAKE', 'HOLD', 'RECOVER'] as const).map((a) => {
          const count = decisions.filter((d) => d.action === a).length;
          return (
            <div key={a} className="dhc__summary-item">
              <span className="dhc__summary-dot" style={{ background: ACTION_COLOR[a] }} />
              <span className="dhc__summary-label">{a}</span>
              <span className="dhc__summary-count">{count}</span>
            </div>
          );
        })}
        <div className="dhc__summary-item">
          <span className="dhc__summary-dot dhc__legend-dot--adjusted" />
          <span className="dhc__summary-label">ADJUSTED</span>
          <span className="dhc__summary-count">
            {decisions.filter((d) => d.adjusted).length}
          </span>
        </div>
      </div>
    </div>
  );
}
