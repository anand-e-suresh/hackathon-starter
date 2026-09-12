/**
 * PositionOverTimeChart — Race position across laps.
 * Note: Y-axis is INVERTED (P1 is best, so lower number = better = higher on chart).
 */
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TelemetryPoint } from '../../api/client';
import './Chart.css';

interface Props {
  data: TelemetryPoint[];
  isLoading?: boolean;
}

interface TooltipPayload {
  value: number;
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
      <p className="chart-tooltip__value" style={{ color: '#c084fc' }}>
        Position: <strong>P{payload[0].value}</strong>
      </p>
    </div>
  );
}

export default function PositionOverTimeChart({ data, isLoading }: Props) {
  if (isLoading) return <div className="chart-empty">LOADING TELEMETRY…</div>;
  if (!data.length) return <div className="chart-empty">WAITING FOR SIMULATION</div>;

  const positions = data.map((d) => d.position);
  const maxPos = Math.max(...positions, 1);
  const minPos = Math.min(...positions, 1);
  const domainMax = Math.min(maxPos + 1, 20);
  const domainMin = Math.max(minPos - 1, 1);

  return (
    <div className="chart-container">
      <div className="chart-header">
        <span className="chart-title">Race Position</span>
        {data.length > 0 && (
          <span className="chart-latest">
            Current: <strong style={{ color: '#c084fc' }}>
              P{data[data.length - 1].position}
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
          {/* Reversed Y-axis: P1 at top */}
          <YAxis
            reversed
            domain={[domainMin, domainMax]}
            tickFormatter={(v: number) => `P${v}`}
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="stepAfter"
            dataKey="position"
            stroke="#c084fc"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#c084fc' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="chart-note">↑ Higher = better position (P1 at top)</p>
    </div>
  );
}
