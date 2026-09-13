/**
 * SAZI — AI Motorsport Intelligence
 * Main application shell + simulation lifecycle controller.
 *
 * All backend calls go through src/api/client.ts.
 * While backend is not connected, mock data is used (clearly labeled).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, GitCompare, AlertCircle, Info, Sun, Moon, Tv, LayoutTemplate, SlidersHorizontal, Box, Flag } from 'lucide-react';

import { useBackendStatus } from './hooks/useBackendStatus';
import { useTheme } from './hooks/useTheme';
import RaceStateBar from './components/RaceStateBar';
import DecisionCard from './components/DecisionCard';
import RuleComplianceBadge from './components/RuleComplianceBadge';
import ComparisonView from './components/ComparisonView';
import TrackSimulation from './components/TrackSimulation';
import F1Car3DViewer from './components/F1Car3DViewer';
import EnergyOverTimeChart from './components/charts/EnergyOverTimeChart';
import PositionOverTimeChart from './components/charts/PositionOverTimeChart';
import GapChart from './components/charts/GapChart';
import DecisionHistoryChart from './components/charts/DecisionHistoryChart';

import F1CarLogo from './components/F1CarLogo';
import type { RaceState, PredictResponse, TelemetryPoint, DecisionPoint, ComparisonResponse } from './api/client';
import { useSimulationSocket, type SimStatus } from './useSimulationSocket';

import './App.css';



export default function App() {
  // Theme
  const { theme, toggleTheme } = useTheme();

  // Backend health
  const backendStatus = useBackendStatus();

  // Track simulation visibility
  const [showTrack, setShowTrack] = useState(true);

  // UI Mode: Overview (basic stats & clean map) vs Detailed Analysis (full telemetry & circuit data)
  const [uiMode, setUiMode] = useState<'simple' | 'detailed'>(() => {
    const saved = localStorage.getItem('sazi-ui-mode');
    return saved === 'simple' || saved === 'detailed' ? saved : 'detailed';
  });

  const handleSetUiMode = (mode: 'simple' | 'detailed') => {
    setUiMode(mode);
    localStorage.setItem('sazi-ui-mode', mode);
  };

  // Dual-page navigation: Primary (3D X-Ray Explorer) vs Secondary (Race Strategy & Simulation)
  const [activePage, setActivePage] = useState<'3d-explorer' | 'race-sim'>('3d-explorer');

  // Simulation state from WebSocket
  const {
    isConnected,
    status: simStatus,
    raceState,
    prediction,
    telemetry,
    decisions,
    start: handleStartWS,
    pause: handlePauseWS,
    resume: handleResumeWS,
    stop: handleStopWS,
    reset: handleResetWS
  } = useSimulationSocket('ws://localhost:8000/ws/simulation');

  // Session loader state
  const [selectedSession, setSelectedSession] = useState("Monza, 2023, R, 1, 5.0");
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // ─── Controls ──────────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    if (simStatus === 'paused') {
      handleResumeWS();
    } else {
      handleStartWS();
    }
  }, [simStatus, handleStartWS, handleResumeWS]);

  const handlePause = useCallback(() => {
    handlePauseWS();
  }, [handlePauseWS]);

  const handleReset = useCallback(() => {
    handleResetWS();
  }, [handleResetWS]);

  const handleLoadSession = async () => {
    setIsLoadingSession(true);
    const [event, year, session, driver, lap_number] = selectedSession.split(', ').map(s => s.trim());
    try {
      const response = await fetch('http://localhost:8000/load-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          year: parseInt(year),
          event: event,
          session: session,
          driver: driver,
          lap_number: parseFloat(lap_number)
        })
      });
      if (!response.ok) {
        console.error("Failed to load session");
        alert("Failed to load session from FastF1");
      }
    } catch (error) {
      console.error(error);
      alert("Error loading session");
    } finally {
      setIsLoadingSession(false);
    }
  };

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
          <div className="app__logo" aria-hidden="true" title="SAZI AI Motorsport">
            <F1CarLogo width={34} height={18} className="app__logo-car" />
          </div>
          <div>
            <h1 className="app__title">SAZI</h1>
            <p className="app__subtitle">AI Motorsport Intelligence</p>
          </div>
        </div>

        <div className="app__header-center">
          {/* Dual-Page Navigation Switcher */}

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
              title="Switch to Overview (basic stats, clean map)"
            >
              <LayoutTemplate size={12} />
              <span>OVERVIEW</span>
            </button>
            <button
              type="button"
              id="btn-mode-detailed"
              className={`ui-mode-btn ${uiMode === 'detailed' ? 'ui-mode-btn--active' : ''}`}
              onClick={() => handleSetUiMode('detailed')}
              role="radio"
              aria-checked={uiMode === 'detailed'}
              title="Switch to Detailed Analysis (deep telemetry & circuit analysis)"
            >
              <SlidersHorizontal size={12} />
              <span>DETAILED ANALYSIS</span>
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

        {/* <button
          id="btn-track-toggle"
          className={`ctrl-btn ctrl-btn--track ${showTrack ? 'ctrl-btn--track-active' : ''}`}
          onClick={() => setShowTrack(!showTrack)}
          aria-label="Toggle 2D live circuit simulation"
          title="Toggle 2D live track view with animated F1 cars"
        >
          <Tv size={14} />
          {showTrack ? 'HIDE 2D TRACK' : '2D LIVE TRACK'}
        </button> */}

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: 'auto', borderLeft: '1px solid var(--border)', paddingLeft: '1rem' }}>
          <select
            value={selectedSession}
            onChange={e => setSelectedSession(e.target.value)}
            disabled={isLoadingSession || simStatus === 'running'}
            style={{ padding: '0.5rem', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }}
          >
            <option value="Monza, 2023, R, 1, 5.0">Monza 2023 (Verstappen, Lap 5)</option>
            <option value="Spa, 2023, R, 1, 5.0">Spa 2023 (Verstappen, Lap 5)</option>
            <option value="Silverstone, 2022, R, 16, 5.0">Silverstone 2022 (Leclerc, Lap 5)</option>
            <option value="Monaco, 2023, R, 14, 15.0">Monaco 2023 (Alonso, Lap 15)</option>
            <option value="Austrian Grand Prix, 2024, R, 2, 1">Hungarian Grand Prix (Hamilton, Lap 32)</option>
          </select>
          <button
            className="ctrl-btn ctrl-btn--primary"
            onClick={handleLoadSession}
            disabled={isLoadingSession || simStatus === 'running'}
            style={{ background: isLoadingSession ? 'var(--bg-card)' : 'var(--accent)' }}
          >
            {isLoadingSession ? 'DOWNLOADING...' : 'LOAD DATA'}
          </button>
        </div>
      </div>

      {/* ── Main content grid ──────────────────────────────────────── */}
      <main className="app__main" role="main">

        {/* ── PAGE 1 (PRIMARY): 3D F1 Car X-Ray Explorer (ERS, Cooling & Tyres) ── */}
        {activePage === '3d-explorer' && (
          <section className="app__row app__row--3d" aria-label="3D F1 Car X-Ray Telemetry Explorer">
            <F1Car3DViewer raceState={raceState} prediction={prediction} />
          </section>
        )}

        {/* ── PAGE 2 (SECONDARY): Grand Prix Circuit Simulation & Strategy Command ── */}
        {activePage === 'race-sim' && (
          <>
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
                <DecisionCard prediction={prediction} isLoading={false} />
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

          </>
        )}
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
