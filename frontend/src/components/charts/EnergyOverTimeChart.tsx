/**
 * EnergyOverTimeChart — Battery/ERS level across simulation timesteps.
 */
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { TelemetryPoint } from '../../api/client';
import './Chart.css';

interface Props {
  data: TelemetryPoint[];
  isLoading?: boolean;
}

interface TooltipPayload {
  value: number;
  dataKey: string;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">Lap {label}</p>
      <p className="chart-tooltip__value" style={{ color: 'var(--accent)' }}>
        ERS: <strong>{payload[0].value}%</strong>
      </p>
    </div>
  );
}

export default function EnergyOverTimeChart({ data, isLoading }: Props) {
  if (isLoading) return <div className="chart-empty">LOADING TELEMETRY…</div>;
  if (!data.length) return <div className="chart-empty">WAITING FOR SIMULATION</div>;

  return (
    <div className="chart-container">
      <div className="chart-header">
        <span className="chart-title">Energy / ERS Level</span>
        {data.length > 0 && (
          <span className="chart-latest">
            Latest: <strong style={{ color: 'var(--accent)' }}>
              {data[data.length - 1].ers_pct}%
            </strong>
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="ersGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="lap"
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            label={{ value: 'Lap', position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 10 }}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={30} stroke="var(--danger)" strokeDasharray="4 4" strokeOpacity={0.5}
            label={{ value: 'Low', position: 'right', fill: 'var(--danger)', fontSize: 9 }} />
          <Area
            type="monotone"
            dataKey="ers_pct"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#ersGrad)"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--accent)' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
