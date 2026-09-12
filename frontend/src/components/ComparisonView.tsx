/**
 * ComparisonView — ML vs Rule-Based Baseline comparison.
 * Side-by-side results + decision divergence highlight.
 */
import { TrendingUp, TrendingDown, Minus, GitBranch } from 'lucide-react';
import type { ComparisonResponse } from '../api/client';
import './ComparisonView.css';

interface Props {
  comparison: ComparisonResponse | null;
  isLoading: boolean;
  onRunComparison: () => void;
  canRun: boolean;
}

function DeltaBadge({ mlVal, baselineVal, lowerIsBetter = false }: {
  mlVal: number;
  baselineVal: number;
  lowerIsBetter?: boolean;
}) {
  const better = lowerIsBetter ? mlVal < baselineVal : mlVal > baselineVal;
  const same = mlVal === baselineVal;

  if (same) return <span className="cv__delta cv__delta--same"><Minus size={10} /></span>;
  return (
    <span className={`cv__delta ${better ? 'cv__delta--better' : 'cv__delta--worse'}`}>
      {better ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {better ? 'ML WINS' : 'BASELINE WINS'}
    </span>
  );
}

export default function ComparisonView({ comparison, isLoading, onRunComparison, canRun }: Props) {
  return (
    <div className="cv" role="region" aria-label="ML vs Baseline Comparison">
      <div className="cv__header">
        <div className="cv__title-row">
          <GitBranch size={16} />
          <h2 className="cv__title">ML vs Rule-Based Baseline</h2>
          <span className="cv__demo-badge">⚡ DEMO DATA</span>
        </div>
        <button
          id="btn-run-comparison"
          className="cv__run-btn"
          onClick={onRunComparison}
          disabled={isLoading || !canRun}
          aria-label="Run comparison between ML strategy and rule-based baseline"
        >
          {isLoading ? (
            <><span className="cv__spinner" /> RUNNING…</>
          ) : (
            'RUN COMPARISON'
          )}
        </button>
      </div>

      {!comparison && !isLoading && (
        <div className="cv__empty">
          <p>Click <strong>RUN COMPARISON</strong> to compare ML strategy vs rule-based baseline on the same race scenario.</p>
        </div>
      )}

      {isLoading && (
        <div className="cv__loading">
          <div className="cv__spinner cv__spinner--large" />
          <p>Running strategies in parallel…</p>
        </div>
      )}

      {comparison && !isLoading && (
        <div className="cv__body">
          {/* Summary table */}
          <div className="cv__table-wrapper">
            <table className="cv__table" role="table">
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col" className="cv__col-ml">
                    <span className="cv__col-badge cv__col-badge--ml">ML STRATEGY</span>
                  </th>
                  <th scope="col" className="cv__col-baseline">
                    <span className="cv__col-badge cv__col-badge--baseline">RULE BASELINE</span>
                  </th>
                  <th scope="col">Winner</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Final Position</td>
                  <td className="cv__col-ml cv__val--primary">
                    P{comparison.ml.final_position}
                  </td>
                  <td className="cv__col-baseline cv__val--secondary">
                    P{comparison.baseline.final_position}
                  </td>
                  <td>
                    <DeltaBadge
                      mlVal={comparison.ml.final_position}
                      baselineVal={comparison.baseline.final_position}
                      lowerIsBetter
                    />
                  </td>
                </tr>
                <tr>
                  <td>Energy Remaining</td>
                  <td className="cv__col-ml cv__val--primary">
                    {comparison.ml.energy_remaining_pct}%
                  </td>
                  <td className="cv__col-baseline cv__val--secondary">
                    {comparison.baseline.energy_remaining_pct}%
                  </td>
                  <td>
                    <DeltaBadge
                      mlVal={comparison.ml.energy_remaining_pct}
                      baselineVal={comparison.baseline.energy_remaining_pct}
                    />
                  </td>
                </tr>
                <tr>
                  <td>Overtakes</td>
                  <td className="cv__col-ml cv__val--primary">
                    {comparison.ml.overtakes}
                  </td>
                  <td className="cv__col-baseline cv__val--secondary">
                    {comparison.baseline.overtakes}
                  </td>
                  <td>
                    <DeltaBadge
                      mlVal={comparison.ml.overtakes}
                      baselineVal={comparison.baseline.overtakes}
                    />
                  </td>
                </tr>
                <tr>
                  <td>Rule Violations</td>
                  <td className="cv__col-ml cv__val--primary">
                    {comparison.ml.rule_violations}
                  </td>
                  <td className="cv__col-baseline cv__val--secondary">
                    {comparison.baseline.rule_violations}
                  </td>
                  <td>
                    <DeltaBadge
                      mlVal={comparison.ml.rule_violations}
                      baselineVal={comparison.baseline.rule_violations}
                      lowerIsBetter
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Decision Divergence */}
          {comparison.divergence_lap != null && (
            <div className="cv__divergence">
              <div className="cv__div-header">
                <span className="cv__div-title">
                  ⚡ DECISION DIVERGENCE — LAP {comparison.divergence_lap}
                </span>
                <span className="cv__div-sub">
                  First lap where strategies disagreed
                </span>
              </div>

              <div className="cv__div-cards">
                <div className="cv__div-card cv__div-card--ml">
                  <span className="cv__div-strategy">ML STRATEGY</span>
                  <span className={`cv__div-action cv__div-action--${(comparison.ml_action_at_divergence ?? 'HOLD').toLowerCase()}`}>
                    {comparison.ml_action_at_divergence ?? '—'}
                  </span>
                  {comparison.ml_reason && (
                    <blockquote className="cv__div-reason">
                      "{comparison.ml_reason}"
                    </blockquote>
                  )}
                </div>

                <div className="cv__div-vs">VS</div>

                <div className="cv__div-card cv__div-card--baseline">
                  <span className="cv__div-strategy">RULE BASELINE</span>
                  <span className={`cv__div-action cv__div-action--${(comparison.baseline_action_at_divergence ?? 'HOLD').toLowerCase()}`}>
                    {comparison.baseline_action_at_divergence ?? '—'}
                  </span>
                  {comparison.baseline_reason && (
                    <blockquote className="cv__div-reason">
                      "{comparison.baseline_reason}"
                    </blockquote>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
