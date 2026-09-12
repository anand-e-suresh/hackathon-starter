/**
 * SAZI — AI Motorsport Intelligence
 * Main application shell + simulation lifecycle controller.
 *
 * All backend calls go through src/api/client.ts.
 * While backend is not connected, mock data is used (clearly labeled).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Cpu, GitCompare, AlertCircle, Info, Sun, Moon, Tv, LayoutTemplate, SlidersHorizontal } from 'lucide-react';

import { useBackendStatus } from './hooks/useBackendStatus';
import { useTheme } from './hooks/useTheme';
import RaceStateBar from './components/RaceStateBar';
import DecisionCard from './components/DecisionCard';
import RuleComplianceBadge from './components/RuleComplianceBadge';
import ComparisonView from './components/ComparisonView';
import TrackSimulation from './components/TrackSimulation';
import EnergyOverTimeChart from './components/charts/EnergyOverTimeChart';
import PositionOverTimeChart from './components/charts/PositionOverTimeChart';
import GapChart from './components/charts/GapChart';
import DecisionHistoryChart from './components/charts/DecisionHistoryChart';

import type { RaceState, PredictResponse, TelemetryPoint, DecisionPoint, ComparisonResponse } from './api/client';
import {
  generateRaceState,
  generatePrediction,
  generateComparison,
  advanceLap,
  resetMockState,
} from './api/mockData';

import './App.css';

// ─── Simulation state machine ─────────────────────────────────────────────────
type SimStatus = 'idle' | 'running' | 'paused' | 'complete';

export default function App() {
  // Theme
  const { theme, toggleTheme } = useTheme();

  // Backend health
  const backendStatus = useBackendStatus();

  // Track simulation visibility
  const [showTrack, setShowTrack] = useState(true);

  // UI Mode: User Friendly (basic stats & clean map) vs Detailed (full telemetry & circuit data)
  const [uiMode, setUiMode] = useState<'simple' | 'detailed'>(() => {
    const saved = localStorage.getItem('sazi-ui-mode');
    return saved === 'simple' || saved === 'detailed' ? saved : 'detailed';
  });

  const handleSetUiMode = (mode: 'simple' | 'detailed') => {
    setUiMode(mode);
    localStorage.setItem('sazi-ui-mode', mode);
  };

  // Simulation state
  const [simStatus, setSimStatus] = useState<SimStatus>('idle');
  const [raceState, setRaceState] = useState<RaceState | null>(null);
  const [prediction, setPrediction] = useState<PredictResponse | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [decisions, setDecisions] = useState<DecisionPoint[]>([]);
  const [isPredicting, setIsPredicting] = useState(false);

  // Comparison
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  // Polling interval ref
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepCountRef = useRef(0);
  const MAX_STEPS = 57;

  // ─── Simulation tick ───────────────────────────────────────────────────────
  const tick = useCallback(() => {
    if (stepCountRef.current >= MAX_STEPS) {
      setSimStatus('complete');
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Every 5 steps, advance the lap counter
    if (stepCountRef.current % 5 === 0) advanceLap();
    stepCountRef.current++;

    const state = generateRaceState();
    setRaceState(state);

    setIsPredicting(true);
    // Simulate async prediction (real backend call would go here)
    setTimeout(() => {
      const pred = generatePrediction(state);
      setPrediction(pred);
      setIsPredicting(false);

      // Append to telemetry & decisions
      setTelemetry((prev) => {
        const point: TelemetryPoint = {
          lap: state.lap,
          step: stepCountRef.current,
          ers_pct: state.ers_pct,
          position: state.position,
          gap_ahead_s: state.gap_ahead_s,
          gap_behind_s: state.gap_behind_s,
          speed_kph: state.speed_kph,
          energy_deployed_mj: state.energy_deployed_mj,
        };
        return [...prev, point];
      });

      setDecisions((prev) => [
        ...prev,
        {
          lap: state.lap,
          step: stepCountRef.current,
          action: pred.action,
          confidence: pred.confidence,
          rule_compliant: pred.rule_compliant,
          adjusted: !pred.rule_compliant,
        },
      ]);
    }, 80);
  }, []);

  // ─── Controls ──────────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    if (simStatus === 'running') return;
    setSimStatus('running');

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, 1200);
    tick(); // immediate first tick
  }, [simStatus, tick]);

  const handlePause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSimStatus('paused');
  }, []);

  const handleReset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSimStatus('idle');
    setRaceState(null);
    setPrediction(null);
    setTelemetry([]);
    setDecisions([]);
    setComparison(null);
    setCompareError(null);
    setIsPredicting(false);
    stepCountRef.current = 0;
    resetMockState();
  }, []);

  const handleRunComparison = useCallback(async () => {
    setIsComparing(true);
    setCompareError(null);
    try {
      // Try real backend first, fall back to mock
      // const result = await runComparison();
      await new Promise((r) => setTimeout(r, 1200)); // simulate latency
      const result = generateComparison();
      setComparison(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setCompareError(msg);
    } finally {
      setIsComparing(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ─── Status labels ─────────────────────────────────────────────────────────
  const statusLabel: Record<SimStatus, string> = {
    idle: 'READY',
    running: '● SIMULATION RUNNING',
    paused: 'Ⅱ PAUSED',
    complete: '✓ SIMULATION COMPLETE',
  };

  const statusClass: Record<SimStatus, string> = {
    idle: 'status--idle',
    running: 'status--running',
    paused: 'status--paused',
    complete: 'status--complete',
  };

  return (
    <div className="app">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="app__header" role="banner">
        <div className="app__brand">
          <div className="app__logo" aria-hidden="true">
            <Cpu size={20} />
          </div>
          <div>
            <h1 className="app__title">SAZI</h1>
            <p className="app__subtitle">AI Motorsport Intelligence</p>
          </div>
        </div>

        <div className="app__header-center">
          <div className={`app__sim-status ${statusClass[simStatus]}`}
               role="status" aria-live="polite">
            {statusLabel[simStatus]}
          </div>
        </div>

        <div className="app__header-right">
          {/* UI Mode Toggle at the very top */}
          <div className="ui-mode-toggle" role="radiogroup" aria-label="UI Mode Toggle">
            <button
              type="button"
              id="btn-mode-simple"
              className={`ui-mode-btn ${uiMode === 'simple' ? 'ui-mode-btn--active' : ''}`}
              onClick={() => handleSetUiMode('simple')}
              role="radio"
              aria-checked={uiMode === 'simple'}
              title="Switch to User Friendly UI (basic stats, clean map)"
            >
              <LayoutTemplate size={12} />
              <span>USER FRIENDLY</span>
            </button>
            <button
              type="button"
              id="btn-mode-detailed"
              className={`ui-mode-btn ${uiMode === 'detailed' ? 'ui-mode-btn--active' : ''}`}
              onClick={() => handleSetUiMode('detailed')}
              role="radio"
              aria-checked={uiMode === 'detailed'}
              title="Switch to Detailed Stats UI (deep telemetry & circuit analysis)"
            >
              <SlidersHorizontal size={12} />
              <span>DETAILED STATS</span>
            </button>
          </div>

          {/* Backend status */}
          <div
            className={`app__backend-status ${backendStatus.online ? 'backend--online' : 'backend--offline'}`}
            title={backendStatus.online
              ? `Backend online — ${backendStatus.latency}ms`
              : 'Backend offline — using mock data'}
          >
            <span className="app__backend-dot" />
            {backendStatus.checking
              ? 'CHECKING…'
              : backendStatus.online
              ? `BACKEND ONLINE ${backendStatus.latency}ms`
              : 'BACKEND OFFLINE'}
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            id="theme-toggle"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            <span className="theme-toggle-btn__text">{theme === 'dark' ? 'LIGHT' : 'DARK'}</span>
          </button>
        </div>
      </header>

      {/* ── Race State Bar ──────────────────────────────────────────── */}
      <RaceStateBar
        state={raceState}
        isRunning={simStatus === 'running'}
        isSimpleMode={uiMode === 'simple'}
      />

      {/* ── Controls ───────────────────────────────────────────────── */}
      <div className="app__controls" role="toolbar" aria-label="Simulation controls">
        <button
          id="btn-start"
          className="ctrl-btn ctrl-btn--primary"
          onClick={handleStart}
          disabled={simStatus === 'running' || simStatus === 'complete'}
          aria-label="Start simulation"
        >
          <Activity size={14} />
          {simStatus === 'paused' ? 'RESUME' : 'START SIMULATION'}
        </button>

        <button
          id="btn-pause"
          className="ctrl-btn ctrl-btn--secondary"
          onClick={handlePause}
          disabled={simStatus !== 'running'}
          aria-label="Pause simulation"
        >
          Ⅱ PAUSE
        </button>

        <button
          id="btn-reset"
          className="ctrl-btn ctrl-btn--ghost"
          onClick={handleReset}
          disabled={simStatus === 'idle'}
          aria-label="Reset simulation"
        >
          RESET
        </button>

        <button
          id="btn-track-toggle"
          className={`ctrl-btn ctrl-btn--track ${showTrack ? 'ctrl-btn--track-active' : ''}`}
          onClick={() => setShowTrack(!showTrack)}
          aria-label="Toggle 2D live circuit simulation"
          title="Toggle 2D live track view with animated F1 cars"
        >
          <Tv size={14} />
          {showTrack ? 'HIDE 2D TRACK' : '2D LIVE TRACK'}
        </button>

        <button
          id="btn-compare"
          className="ctrl-btn ctrl-btn--compare"
          onClick={handleRunComparison}
          disabled={isComparing}
          aria-label="Run ML vs baseline comparison"
        >
          <GitCompare size={14} />
          RUN COMPARISON
        </button>

        {compareError && (
          <div className="app__error" role="alert">
            <AlertCircle size={13} /> {compareError}
          </div>
        )}
      </div>

      {/* ── Main content grid ──────────────────────────────────────── */}
      <main className="app__main" role="main">

        {/* 2D Live Track Simulation */}
        {showTrack && (
          <section className="app__row app__row--track" aria-label="2D Live Circuit Simulation">
            <TrackSimulation
              raceState={raceState}
              prediction={prediction}
              isRunning={simStatus === 'running'}
              isSimpleMode={uiMode === 'simple'}
              onToggleUiMode={() => handleSetUiMode('detailed')}
            />
          </section>
        )}

        {/* Row 1: Decision + Compliance */}
        <section className="app__row app__row--top" aria-label="AI decision and compliance">
          <div className="app__col app__col--decision">
            <DecisionCard prediction={prediction} isLoading={isPredicting} />
          </div>
          <div className="app__col app__col--compliance">
            <RuleComplianceBadge prediction={prediction} />
          </div>
        </section>

        {/* Row 2: Energy chart (full width) */}
        <section className="app__row" aria-label="Energy telemetry">
          <EnergyOverTimeChart data={telemetry} isLoading={false} />
        </section>

        {/* Row 3: Position + Gap */}
        <section className="app__row app__row--two-col" aria-label="Position and gap charts">
          <PositionOverTimeChart data={telemetry} />
          <GapChart data={telemetry} />
        </section>

        {/* Row 4: Decision history */}
        <section className="app__row" aria-label="Decision history">
          <DecisionHistoryChart decisions={decisions} />
        </section>

        {/* Row 5: Comparison */}
        <section className="app__row" aria-label="ML vs baseline comparison">
          <ComparisonView
            comparison={comparison}
            isLoading={isComparing}
            onRunComparison={handleRunComparison}
            canRun={!isComparing}
          />
        </section>

      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="app__footer" role="contentinfo">
        <span className="app__footer-disclaimer">
          <Info size={11} />
          All telemetry is synthetic, generated for this demo. This project does not use proprietary real-world F1 telemetry.
        </span>
        <span className="app__footer-brand">SAZI © 2026 — AI Motorsport Intelligence</span>
      </footer>
    </div>
  );
}
