import React from 'react';

interface F1CarLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  width?: number | string;
  height?: number | string;
}

/**
 * Aerodynamic side-profile silhouette of a modern Formula 1 car
 * Features: low front wing & endplates, sleek nosecone, front open wheel,
 * cockpit with Halo protective structure, driver helmet, airbox intake,
 * dorsal shark fin, contoured sidepod, rear wing with DRS plane, and rear wheel.
 */
export default function F1CarLogo({
  className = '',
  width = 38,
  height = 20,
  ...props
}: F1CarLogoProps) {
  return (
    <svg
      viewBox="0 0 100 32"
      width={width}
      height={height}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Formula 1 Car Silhouette"
      role="img"
      {...props}
    >
      {/* ── Rear Wing Endplate & Dual Plane Assembly ── */}
      <path d="M 2 4.5 L 14 4.5 L 12.5 12 L 1.5 12 Z" />
      <path d="M 8 11.5 L 7 21 L 10 21 L 11 11.5 Z" />

      {/* ── Engine Cover & Dorsal Shark Fin ── */}
      <path d="M 12 11 L 41 4.5 L 44 8.5 L 43 13.5 L 34 16.5 L 26 20.5 L 15 20.5 Z" />

      {/* ── Halo Safety Structure & Cockpit ── */}
      <path d="M 44 8 C 47.5 4.5, 55 4.5, 59 9 L 57 10.5 C 54 7.2, 48 7.2, 45 9.8 Z" />
      <path d="M 58 9 L 60 14 L 57.5 14 L 56 10 Z" />

      {/* ── Driver Helmet ── */}
      <circle cx="49" cy="9.8" r="2.6" />

      {/* ── Chassis Monocoque, Undercut Sidepod & Tapered Nosecone ── */}
      <path d="M 60 10.5 L 80 17 L 93 20 L 96 21.5 L 96 23.5 L 86 23.5 L 81 20 L 67 15 L 53 14 L 43 14 L 35 21 L 18 22 L 12 25 L 7 25 L 9 21.5 L 15 20.5 Z" />

      {/* ── Front Wing Cascades & Outwash Endplate ── */}
      <path d="M 87 22 L 98 22 L 98.5 25 L 86 25 Z" />
      <path d="M 95 19.5 L 98.5 19.5 L 98.5 25 L 95 25 Z" />

      {/* ── Front Suspension Wishbones ── */}
      <line
        x1="72"
        y1="17.5"
        x2="80"
        y2="23.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <line
        x1="74"
        y1="20"
        x2="80"
        y2="23.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* ── Rear Open Wheel (Pirelli Slick + Transparent Rim) ── */}
      <circle
        cx="20"
        cy="23.5"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <circle cx="20" cy="23.5" r="1.8" />

      {/* ── Front Open Wheel (Pirelli Slick + Transparent Rim) ── */}
      <circle
        cx="80"
        cy="23.5"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
      />
      <circle cx="80" cy="23.5" r="1.8" />
    </svg>
  );
}
