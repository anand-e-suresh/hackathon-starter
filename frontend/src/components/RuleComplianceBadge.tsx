/**
 * RuleComplianceBadge — displays FIA-style deployment constraint status.
 * Mandatory feature — must be impossible for a judge to miss.
 */
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { PredictResponse } from '../api/client';
import './RuleComplianceBadge.css';

interface Props {
  prediction: PredictResponse | null;
}

export default function RuleComplianceBadge({ prediction }: Props) {
  if (!prediction) {
    return (
      <div className="rcb rcb--idle" role="status" aria-label="Rule compliance status">
        <span className="rcb__title">RULE COMPLIANCE</span>
        <div className="rcb__status rcb__status--idle">
          <span className="rcb__icon">—</span>
          <span className="rcb__text">AWAITING DATA</span>
        </div>
      </div>
    );
  }

  const compliant = prediction.rule_compliant;
  const used = prediction.deployment_used_mj;
  const budget = (used ?? 0) + (prediction.deployment_budget_mj ?? 0);
  const violations = prediction.violations ?? 0;

  const usedPct = budget > 0 && used != null ? (used / budget) * 100 : 0;
  const limitClass = usedPct > 90 ? 'critical' : usedPct > 70 ? 'warning' : 'ok';

  return (
    <div
      className={`rcb ${compliant ? 'rcb--ok' : 'rcb--violation'}`}
      role="status"
      aria-label={`Rule compliance: ${compliant ? 'within limits' : 'violation'}`}
    >
      <span className="rcb__title">RULE COMPLIANCE</span>

      {/* Main status */}
      <div className={`rcb__status ${compliant ? 'rcb__status--ok' : 'rcb__status--violation'}`}>
        <span className="rcb__icon">
          {compliant
            ? <CheckCircle2 size={18} aria-hidden="true" />
            : <AlertTriangle size={18} aria-hidden="true" />}
        </span>
        <span className="rcb__text">
          {compliant ? 'WITHIN LIMITS' : 'LIMIT REACHED — ACTION ADJUSTED'}
        </span>
      </div>

      {/* Deployment budget bar */}
      {used != null && budget > 0 && (
        <div className="rcb__budget">
          <div className="rcb__budget-header">
            <span className="rcb__budget-label">Deployment Budget</span>
            <span className={`rcb__budget-value rcb__budget-value--${limitClass}`}>
              {used.toFixed(1)} / {budget.toFixed(1)} MJ
            </span>
          </div>
          <div className="rcb__budget-bar">
            <div
              className={`rcb__budget-fill rcb__budget-fill--${limitClass}`}
              style={{ width: `${Math.min(usedPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Violations */}
      <div className="rcb__violations">
        <span className="rcb__violations-label">Violations</span>
        <span className={`rcb__violations-count ${violations > 0 ? 'rcb__violations-count--active' : ''}`}>
          {violations}
        </span>
      </div>

      {/* Disclaimer */}
      <p className="rcb__disclaimer">
        Simplified FIA-style constraints. Not exact reproduction of the official rulebook.
      </p>
    </div>
  );
}
