/**
 * DecisionCard — THE centerpiece of the dashboard.
 * Displays the ML action, confidence, energy cost, reason,
 * risk/reward, and attack opportunity score.
 * Visually changes for OVERTAKE / HOLD / RECOVER.
 */
import { useState, useEffect, useRef } from 'react';
import { Zap, Shield, RotateCcw, TrendingUp, AlertTriangle } from 'lucide-react';
import type { PredictResponse } from '../api/client';
import './DecisionCard.css';

interface Props {
  prediction: PredictResponse | null;
  isLoading: boolean;
}

const ACTION_META = {
  OVERTAKE: {
    icon: <Zap size={28} />,
    label: 'OVERTAKE',
    colorClass: 'dc--overtake',
    tagline: 'Aggressive Deploy',
  },
  HOLD: {
    icon: <Shield size={28} />,
    label: 'HOLD',
    colorClass: 'dc--hold',
    tagline: 'Maintain Position',
  },
  RECOVER: {
    icon: <RotateCcw size={28} />,
    label: 'RECOVER',
    colorClass: 'dc--recover',
    tagline: 'Energy Recovery',
  },
} as const;

export default function DecisionCard({ prediction, isLoading }: Props) {
  const [flash, setFlash] = useState(false);
  const prevAction = useRef<string | null>(null);

  useEffect(() => {
    if (prediction && prediction.action !== prevAction.current) {
      setFlash(true);
      prevAction.current = prediction.action;
      const t = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [prediction]);

  if (isLoading && !prediction) {
    return (
      <div className="dc dc--loading">
        <div className="dc__spinner" aria-label="Loading AI decision" />
        <p className="dc__loading-text">COMPUTING STRATEGY…</p>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="dc dc--idle">
        <div className="dc__idle-icon">
          <Zap size={32} />
        </div>
        <p className="dc__idle-text">AI STRATEGY</p>
        <p className="dc__idle-sub">Start simulation to activate</p>
      </div>
    );
  }

  const meta = ACTION_META[prediction.action];
  const confPct = Math.round(prediction.confidence * 100);
  const circum = 2 * Math.PI * 36; // r=36 svg circle
  const dashOffset = circum - (circum * prediction.confidence);

  return (
    <div className={`dc ${meta.colorClass} ${flash ? 'dc--flash' : ''}`}
         role="region"
         aria-label="AI Strategy Decision">

      {/* Header */}
      <div className="dc__header">
        <span className="dc__label">AI STRATEGY</span>
        <span className="dc__tagline">{meta.tagline}</span>
      </div>

      {/* Main action */}
      <div className="dc__action-row">
        <div className="dc__icon" aria-hidden="true">{meta.icon}</div>
        <div className="dc__action-text">{meta.label}</div>

        {/* Confidence ring */}
        <div className="dc__conf-ring" title={`Confidence: ${confPct}%`}>
          <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`${confPct}% confidence`}>
            <circle cx="44" cy="44" r="36"
              fill="none" stroke="var(--border)" strokeWidth="6" />
            <circle cx="44" cy="44" r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circum}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 44 44)"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
            <text x="44" y="44" textAnchor="middle" dominantBaseline="central"
              fontSize="14" fontWeight="700" fill="currentColor" fontFamily="var(--font-mono)">
              {confPct}%
            </text>
            <text x="44" y="58" textAnchor="middle"
              fontSize="8" fill="var(--text-muted)" fontFamily="var(--font-mono)">
              CONF
            </text>
          </svg>
        </div>
      </div>

      {/* Metrics row */}
      <div className="dc__metrics">
        <div className="dc__metric">
          <span className="dc__metric-label">Energy Cost</span>
          <span className="dc__metric-value">
            {prediction.expected_energy_cost.toFixed(2)}
            <span className="dc__metric-unit"> MJ</span>
          </span>
        </div>

        {prediction.risk !== undefined && (
          <div className="dc__metric">
            <span className="dc__metric-label">Risk</span>
            <span className="dc__metric-value dc__risk">
              {getRiskLabel(prediction.risk)}
            </span>
          </div>
        )}

        {prediction.reward !== undefined && (
          <div className="dc__metric">
            <span className="dc__metric-label">
              <TrendingUp size={11} /> Reward
            </span>
            <span className="dc__metric-value dc__reward">
              {getRewardLabel(prediction.reward)}
            </span>
          </div>
        )}

        {prediction.attack_opportunity_score !== undefined && (
          <div className="dc__metric">
            <span className="dc__metric-label">Attack Score</span>
            <div className="dc__attack-bar" title={`${Math.round(prediction.attack_opportunity_score * 100)}%`}>
              <div
                className="dc__attack-fill"
                style={{ width: `${prediction.attack_opportunity_score * 100}%` }}
              />
            </div>
            <span className="dc__metric-value">
              {Math.round(prediction.attack_opportunity_score * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Reason */}
      <div className="dc__reason">
        <span className="dc__reason-label">
          <AlertTriangle size={11} /> REASON
        </span>
        <blockquote className="dc__reason-text">"{prediction.reason}"</blockquote>
      </div>

      {/* DEMO badge */}
      <div className="dc__demo-badge" title="Backend not yet connected — synthetic data">
        ⚡ DEMO DATA
      </div>
    </div>
  );
}

function getRiskLabel(risk: number): string {
  if (risk > 0.66) return 'HIGH';
  if (risk > 0.33) return 'MEDIUM';
  return 'LOW';
}

function getRewardLabel(reward: number): string {
  if (reward > 0.66) return 'HIGH';
  if (reward > 0.33) return 'MEDIUM';
  return 'LOW';
}
