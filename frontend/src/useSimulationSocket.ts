import { useState, useEffect, useCallback, useRef } from 'react';
import type { RaceState, PredictResponse, TelemetryPoint, DecisionPoint } from './api/client';

export type SimStatus = 'idle' | 'running' | 'paused' | 'complete';

export function useSimulationSocket(url: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<SimStatus>('idle');
  const [raceState, setRaceState] = useState<RaceState | null>(null);
  const [prediction, setPrediction] = useState<PredictResponse | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [decisions, setDecisions] = useState<DecisionPoint[]>([]);

  const ws = useRef<WebSocket | null>(null);
  const stepCount = useRef(0);

  useEffect(() => {
    ws.current = new WebSocket(url);

    ws.current.onopen = () => setIsConnected(true);
    ws.current.onclose = () => setIsConnected(false);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.status) {
        if (data.status === 'RUNNING') setStatus('running');
        else if (data.status === 'PAUSED') setStatus('paused');
        else if (data.status === 'STOPPED' || data.status === 'IDLE') setStatus('idle');
        else if (data.status === 'FINISHED') setStatus('complete');
      }

      if (data.ml_car && data.ml_decision) {
        stepCount.current++;
        const car = data.ml_car;
        const decision = data.ml_decision;

        // Map backend schema to frontend RaceState schema
        const newState: RaceState = {
          lap: data.lap || 1,
          total_laps: 50,
          position: car.position,
          speed_kph: car.speed,
          ers_pct: car.battery_pct,
          gap_ahead_s: car.gap_ahead,
          gap_behind_s: car.gap_behind,
          x: car.x,
          y: car.y,
          energy_deployed_mj: car.lap_deployment_used_mj,
          deployment_budget_mj: car.budget_remaining_mj,
          timestamp: data.time || 0,
        };
        setRaceState(newState);

        // Map backend schema to frontend PredictResponse schema
        const newPrediction: PredictResponse = {
          action: decision.action,
          confidence: decision.confidence,
          expected_energy_cost: decision.expected_energy_cost || 0.2,
          reason: decision.reason,
          rule_compliant: decision.rule_compliant,
          violations: decision.rule_compliant ? 0 : 1,
        };
        setPrediction(newPrediction);

        // Map to charts
        setTelemetry(prev => [...prev, {
          lap: newState.lap,
          step: stepCount.current,
          ers_pct: newState.ers_pct,
          position: newState.position,
          gap_ahead_s: newState.gap_ahead_s,
          gap_behind_s: newState.gap_behind_s,
          speed_kph: newState.speed_kph,
          energy_deployed_mj: newState.energy_deployed_mj,
        }]);

        setDecisions(prev => [...prev, {
          lap: newState.lap,
          step: stepCount.current,
          action: newPrediction.action,
          confidence: newPrediction.confidence,
          rule_compliant: newPrediction.rule_compliant,
          adjusted: !newPrediction.rule_compliant,
        }]);
      }
    };

    return () => {
      ws.current?.close();
    };
  }, [url]);

  const sendCommand = useCallback((type: string, payload: any = {}) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  const start = useCallback(() => sendCommand('START'), [sendCommand]);
  const pause = useCallback(() => sendCommand('PAUSE'), [sendCommand]);
  const resume = useCallback(() => sendCommand('RESUME'), [sendCommand]);
  const stop = useCallback(() => sendCommand('STOP'), [sendCommand]);
  
  const reset = useCallback(() => {
    sendCommand('RESET');
    setRaceState(null);
    setPrediction(null);
    setTelemetry([]);
    setDecisions([]);
    stepCount.current = 0;
  }, [sendCommand]);

  return {
    isConnected,
    status,
    raceState,
    prediction,
    telemetry,
    decisions,
    start,
    pause,
    resume,
    stop,
    reset
  };
}
