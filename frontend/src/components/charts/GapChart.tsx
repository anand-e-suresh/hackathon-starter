/**
 * GapChart — Gap ahead and gap behind over time.
 */
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { TelemetryPoint } from '../../api/client';
import './Chart.css';

interface Props {
  data: TelemetryPoint[];
  isLoading?: boolean;
}

interface TooltipPayload {
  value: number;
  color: string;
  name: string;
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
      {payload.map((p) => (
        <p key={p.name} className="chart-tooltip__value" style={{ color: p.color }}>
          {p.name}: <strong>{p.value.toFixed(2)}s</strong>
        </p>
      ))}
    </div>
  );
}

export default function GapChart({ data, isLoading }: Props) {
  if (isLoading) return <div className="chart-empty">LOADING TELEMETRY…</div>;
  if (!data.length) return <div className="chart-empty">WAITING FOR SIMULATION</div>;

  return (
    <div className="chart-container">
      <div className="chart-header">
        <span className="chart-title">Gap to Opponent</span>
        {data.length > 0 && (
          <span className="chart-latest">
            Ahead: <strong style={{ color: 'var(--danger)' }}>
              +{data[data.length - 1].gap_ahead_s.toFixed(2)}s
            </strong>
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="lap"
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            label={{ value: 'Lap', position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 10 }}
          />
          <YAxis
            tickFormatter={(v: number) => `${v.toFixed(1)}s`}
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '10px', color: 'var(--text-muted)', paddingTop: '4px' }}
          />
          <Line
            type="monotone"
            dataKey="gap_ahead_s"
            name="Gap Ahead"
            stroke="var(--danger)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="gap_behind_s"
            name="Gap Behind"
            stroke="var(--text-secondary)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
