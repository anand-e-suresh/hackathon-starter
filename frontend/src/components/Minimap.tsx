import React from 'react';
import type { RaceState } from '../api/client';
import monzaMap from '../assets/monza.png';
import './Minimap.css';

interface MinimapProps {
  raceState: RaceState | null;
}

export function Minimap({ raceState }: MinimapProps) {
  if (!raceState || typeof raceState.x !== 'number' || typeof raceState.y !== 'number') {
    return (
      <div className="minimap-container">
        <img src={monzaMap} alt="Monza Circuit Map" className="minimap-image" />
        <div className="minimap-loading">Awaiting Telemetry...</div>
      </div>
    );
  }

  // FastF1 Telemetry Bounding Box for Monza 2023
  const MIN_X = -1498.26;
  const MAX_X = 11067.0;
  const RANGE_X = MAX_X - MIN_X;

  const MIN_Y = -5801.0;
  const MAX_Y = 15878.0;
  const RANGE_Y = MAX_Y - MIN_Y;

  // Calculate percentage positions
  // Depending on FastF1 axis alignment vs the PNG map, we might need to invert or rotate this.
  const leftPct = ((raceState.x - MIN_X) / RANGE_X) * 100;
  
  // Y in FastF1 is usually North=positive, but browser top=0. So we invert.
  const topPct = 100 - (((raceState.y - MIN_Y) / RANGE_Y) * 100);

  return (
    <div className="minimap-container">
      <img src={monzaMap} alt="Monza Circuit Map" className="minimap-image" />
      <div 
        className="minimap-dot" 
        style={{ 
          left: `${leftPct}%`, 
          top: `${topPct}%` 
        }}
      />
    </div>
  );
}
