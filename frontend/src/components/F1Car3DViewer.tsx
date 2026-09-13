import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  RotateCcw,
  Zap,
  Thermometer,
  Disc,
  Eye,
  Maximize2,
  Layers,
  Info,
  Loader2,
  CheckCircle2,
  Gauge,
  Play,
  Pause,
  Wind,
  Sparkles,
  Flame,
  Activity,
  Video,
  ShieldCheck,
  Compass,
  Cpu,
  Trophy,
  Flag,
  BatteryCharging,
} from 'lucide-react';
import type { RaceState, PredictResponse } from '../api/client';
import ferrariGlbUrl from '../../ferrari_sf25.glb?url';
import './F1Car3DViewer.css';

interface Props {
  raceState: RaceState | null;
  prediction: PredictResponse | null;
}

type SubsystemFocus = 'all' | 'ers' | 'cooling' | 'tyres' | 'cockpit' | 'chase' | 'nose';
type TyreCompound = 'SOFT' | 'MEDIUM' | 'HARD' | 'INTER' | 'WET';
type AeroFlowMode = 'ALL' | 'VORTICES' | 'SPARKS';

/**
 * Procedural Contact Patch Tread & Bump Map Generator:
 * Matches the official Pirelli F1 tyre collection:
 * - Slicks (Soft, Medium, Hard): Smooth high-grip rubber contact patch with fine graining.
 * - Intermediate (Green): Directional curved chevron rain grooves and circumferential drainage sipes.
 * - Full Wet (Blue): Aggressive deep rectangular aqua-channel drainage blocks and 3 longitudinal clearing canals.
 */
function drawTyreTread(
  colorCanvas: HTMLCanvasElement,
  bumpCanvas: HTMLCanvasElement,
  compound: TyreCompound,
  _isRear: boolean
): number {
  const width = colorCanvas.width; // 1024 (circumference roll)
  const height = colorCanvas.height; // 256 (across tread width)
  const cCtx = colorCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');
  if (!cCtx || !bCtx) return 0.005;

  cCtx.clearRect(0, 0, width, height);
  bCtx.clearRect(0, 0, width, height);

  if (compound === 'SOFT' || compound === 'MEDIUM' || compound === 'HARD') {
    // ── SLICK RACING TREAD (Smooth contact patch with subtle rubber grain) ──
    cCtx.fillStyle = '#14161b';
    cCtx.fillRect(0, 0, width, height);

    // Subtle grain & heat scrub lines
    cCtx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    for (let x = 0; x < width; x += 4) {
      if (Math.sin(x * 0.3) > 0) {
        cCtx.fillRect(x, 0, 2, height);
      }
    }

    // Flat bump with subtle micro-texture
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, width, height);
    bCtx.fillStyle = '#868686';
    for (let x = 0; x < width; x += 6) {
      bCtx.fillRect(x, 0, 2, height);
    }
    return 0.005;
  }

  if (compound === 'INTER') {
    // ── CINTURATO INTERMEDIATE (Directional curved chevron & longitudinal rain sipes) ──
    cCtx.fillStyle = '#111317';
    cCtx.fillRect(0, 0, width, height);

    bCtx.fillStyle = '#909090';
    bCtx.fillRect(0, 0, width, height);

    // 4 continuous circumferential drainage grooves along X
    const circGrooves = [48, 96, 160, 208];
    circGrooves.forEach((y) => {
      cCtx.fillStyle = '#06070a';
      cCtx.fillRect(0, y - 2, width, 5);
      bCtx.fillStyle = '#0a0a0a';
      bCtx.fillRect(0, y - 3, width, 7);
    });

    // Directional curved chevron drainage sipes spaced across X
    const step = 28;
    for (let x = -50; x < width + 50; x += step) {
      [cCtx, bCtx].forEach((ctx, isB) => {
        ctx.strokeStyle = isB ? '#050505' : '#07080c';
        ctx.lineWidth = isB ? 4 : 3;
        ctx.beginPath();
        ctx.moveTo(x, 128);
        ctx.quadraticCurveTo(x + 22, 64, x + 38, 0);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, 128);
        ctx.quadraticCurveTo(x + 22, 192, x + 38, 256);
        ctx.stroke();

        // Secondary outer sipes
        ctx.beginPath();
        ctx.moveTo(x + 14, 48);
        ctx.lineTo(x + 26, 0);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + 14, 208);
        ctx.lineTo(x + 26, 256);
        ctx.stroke();
      });
    }
    return 0.09;
  }

  // ── CINTURATO FULL WET (Deep aggressive multi-block aqua channels & water evacuation canals) ──
  cCtx.fillStyle = '#0d0f13';
  cCtx.fillRect(0, 0, width, height);

  bCtx.fillStyle = '#b0b0b0'; // Raised tread blocks
  bCtx.fillRect(0, 0, width, height);

  // 3 Deep main circumferential channels along X
  const wetCircChannels = [72, 128, 184];
  wetCircChannels.forEach((y) => {
    cCtx.fillStyle = '#020305';
    cCtx.fillRect(0, y - 4, width, 9);
    bCtx.fillStyle = '#000000';
    bCtx.fillRect(0, y - 5, width, 11);
  });

  // Deep transverse drainage blocks every 32px
  const blockStep = 32;
  for (let x = 0; x < width; x += blockStep) {
    [cCtx, bCtx].forEach((ctx, isB) => {
      ctx.fillStyle = isB ? '#000000' : '#020305';
      // Center zone staggered blocks
      ctx.fillRect(x + 4, 72, isB ? 6 : 5, 56);
      ctx.fillRect(x + 20, 128, isB ? 6 : 5, 56);

      // Shoulder aqua-evacuation channels angled outward
      ctx.beginPath();
      ctx.moveTo(x, 72);
      ctx.lineTo(x - 14, 0);
      ctx.lineWidth = isB ? 7 : 6;
      ctx.strokeStyle = isB ? '#000000' : '#020305';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + 16, 184);
      ctx.lineTo(x + 30, 256);
      ctx.lineWidth = isB ? 7 : 6;
      ctx.strokeStyle = isB ? '#000000' : '#020305';
      ctx.stroke();
    });
  }

  return 0.16;
}

/**
 * Procedural High-Resolution Tyre Sidewall Generator:
 * Matches the official Pirelli exhibition lineup from the reference photo:
 * - Red (P Zero Soft), Yellow (P Zero Medium), White (P Zero Hard)
 * - Green (Cinturato Intermediate) with solid colored rectangular badge
 * - Blue (Cinturato Full Wet) with solid colored rectangular badge
 * - Elongated speed-bar typography, continuous circumferential color ring, RFID barcode & FIA sizing.
 */
function drawPirettiSidewall(
  canvas: HTMLCanvasElement,
  compound: TyreCompound,
  isRear: boolean
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = canvas.width; // 1024
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Exact Pirelli compound colors from the photo
  const compoundColor =
    compound === 'SOFT'
      ? '#e10600'
      : compound === 'MEDIUM'
      ? '#ffb800'
      : compound === 'HARD'
      ? '#f8fafc'
      : compound === 'INTER'
      ? '#10e782'
      : '#2563eb';

  const compoundGlow =
    compound === 'SOFT'
      ? 'rgba(225, 6, 0, 0.45)'
      : compound === 'MEDIUM'
      ? 'rgba(255, 184, 0, 0.45)'
      : compound === 'HARD'
      ? 'rgba(248, 250, 252, 0.45)'
      : compound === 'INTER'
      ? 'rgba(16, 231, 130, 0.45)'
      : 'rgba(37, 99, 235, 0.45)';

  // 1. Vulcanized Rubber Sidewall Gradient
  const grad = ctx.createRadialGradient(cx, cy, 270, cx, cy, 510);
  grad.addColorStop(0, '#101216');
  grad.addColorStop(0.35, '#181b22');
  grad.addColorStop(0.75, '#131418');
  grad.addColorStop(1, '#090a0d');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 510, 0, Math.PI * 2);
  ctx.fill();

  // Concentric mold parting lines
  ctx.lineWidth = 1.2;
  for (let r = 315; r <= 495; r += 16) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Rim bead interface ring
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 305, 0, Math.PI * 2);
  ctx.stroke();

  // 2. Bold Continuous Outer Circumferential Colored Ring (exact match to photo)
  ctx.save();
  ctx.shadowColor = compoundGlow;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = compoundColor;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, 472, 0, Math.PI * 2);
  ctx.stroke();

  // Inner concentric pin-stripe
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 454, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 3. Helper: Curved Text along circle
  const drawCurvedText = (
    text: string,
    radius: number,
    centerAngle: number,
    spread: number,
    font: string,
    color: string,
    isTop: boolean
  ) => {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const chars = text.split('');
    const total = chars.length;
    const startAngle = centerAngle - spread / 2;
    const step = total > 1 ? spread / (total - 1) : 0;

    for (let i = 0; i < total; i++) {
      const angle = startAngle + i * step;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + (isTop ? Math.PI / 2 : -Math.PI / 2));
      ctx.fillText(chars[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  };

  // 4. TOP ARC (12 o'clock): Brand Logo
  if (compound === 'INTER' || compound === 'WET') {
    // In reference photo: Green & Blue wet tyres feature brand inside a solid colored rectangular badge!
    ctx.save();
    ctx.translate(cx, cy - 400);
    ctx.shadowColor = compoundGlow;
    ctx.shadowBlur = 14;
    ctx.fillStyle = compoundColor;
    ctx.fillRect(-115, -26, 230, 52);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-115, -26, 230, 52);

    // Black Pirelli-style typography inside badge
    ctx.font = '900 italic 38px "Titillium Web", "Arial Black", sans-serif';
    ctx.fillStyle = '#0a0a0c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PIRETTI', 0, 2);

    // Top elongated speed roof on the "P"
    ctx.fillRect(-88, -21, 166, 5);
    ctx.restore();
  } else {
    // Slicks (Red, Yellow, White): Brand text curved directly on sidewall in compound color
    drawCurvedText(
      '★   P I R E T T I   ★',
      410,
      -Math.PI / 2,
      0.95,
      '900 italic 48px "Titillium Web", "Arial Black", sans-serif',
      compoundColor,
      true
    );

    // Extended horizontal speed bar over "IRETTI"
    ctx.save();
    ctx.strokeStyle = compoundColor;
    ctx.lineWidth = 4.5;
    ctx.shadowColor = compoundGlow;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, 442, -Math.PI / 2 - 0.26, -Math.PI / 2 + 0.36);
    ctx.stroke();
    ctx.restore();
  }

  // 5. BOTTOM ARC (6 o'clock): Model Name
  if (compound === 'INTER' || compound === 'WET') {
    // In the photo: "cinturato" in curved script in compound color!
    drawCurvedText(
      'c i n t u r a t o',
      410,
      Math.PI / 2,
      -0.78,
      'bold italic 40px "Brush Script MT", "Caveat", "Titillium Web", sans-serif',
      compoundColor,
      false
    );
  } else {
    // Slicks: "P - Z E R O" in bold white
    drawCurvedText(
      'P   Z E R O',
      410,
      Math.PI / 2,
      -0.62,
      '900 italic 46px "Titillium Web", "Arial Black", sans-serif',
      '#ffffff',
      false
    );
  }

  // Bottom speed underline
  ctx.save();
  ctx.strokeStyle = compoundColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 442, Math.PI / 2 - 0.28, Math.PI / 2 + 0.28);
  ctx.stroke();
  ctx.restore();

  // 6. 3 o'clock: FIA RFID Barcode Tracking Block
  ctx.save();
  ctx.translate(cx + 388, cy);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-34, -18, 68, 36);
  ctx.fillStyle = '#0a0a0a';
  const bars = [3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2];
  let bx = -30;
  bars.forEach((w) => {
    ctx.fillRect(bx, -14, w, 20);
    bx += w + 2;
  });
  ctx.fillStyle = '#0a0a0a';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`FIA-${compound.slice(0, 3)}-26`, 0, 13);
  ctx.restore();

  // 7. 9 o'clock: Tyre Size & Specification
  ctx.save();
  ctx.translate(cx - 388, cy);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '900 italic 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isRear ? '405 / 720 - 18' : '305 / 720 - 18', 0, -8);
  ctx.font = 'bold 9px sans-serif';
  ctx.fillStyle = compoundColor;
  ctx.fillText(`ROTATION ➔  [${compound}]`, 0, 8);
  ctx.restore();
}

/**
 * Procedural Grand Prix Circuit Roadway Texture:
 * Features authentic FIA-grade asphalt aggregate, rubbered-in racing lines from Pirelli tyres,
 * 3D-shaded bevel rumble kerbs (Rosso Corsa & White), solid white track boundary limits,
 * broken centerline road dashes, DRS zone detection bar, and staggered F1 grid starting boxes.
 */
function createGrandPrixTrackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 1. Base Dark Asphalt
  ctx.fillStyle = '#10131b';
  ctx.fillRect(0, 0, 2048, 512);

  // High-density aggregate bitumen noise texture (3200 specks)
  for (let i = 0; i < 3200; i++) {
    const rx = Math.random() * 2048;
    const ry = Math.random() * 512;
    const g = Math.floor(22 + Math.random() * 32);
    ctx.fillStyle = `rgba(${g}, ${g}, ${g + 5}, ${0.5 + Math.random() * 0.5})`;
    ctx.fillRect(rx, ry, Math.random() < 0.7 ? 2 : 3, 2);
  }

  // 2. High-Grip Rubbered-in Racing Grooves (Dark polished rubber from F1 tyres)
  const drawRubberGroove = (yCenter: number) => {
    const rGrad = ctx.createLinearGradient(0, yCenter - 38, 0, yCenter + 38);
    rGrad.addColorStop(0, 'rgba(8, 10, 14, 0)');
    rGrad.addColorStop(0.3, 'rgba(8, 10, 14, 0.65)');
    rGrad.addColorStop(0.5, 'rgba(6, 7, 10, 0.90)');
    rGrad.addColorStop(0.7, 'rgba(8, 10, 14, 0.65)');
    rGrad.addColorStop(1, 'rgba(8, 10, 14, 0)');
    ctx.fillStyle = rGrad;
    ctx.fillRect(0, yCenter - 38, 2048, 76);
  };
  drawRubberGroove(170); // Left tyre track
  drawRubberGroove(342); // Right tyre track

  // 3. Outer Green Artificial Turf Run-off Border (Top & Bottom)
  const turfHeight = 18;
  ctx.fillStyle = '#14532d';
  ctx.fillRect(0, 0, 2048, turfHeight);
  ctx.fillRect(0, 512 - turfHeight, 2048, turfHeight);
  for (let x = 0; x < 2048; x += 12) {
    ctx.fillStyle = x % 24 === 0 ? '#15803d' : '#0f3f22';
    ctx.fillRect(x, 0, 8, turfHeight);
    ctx.fillRect(x, 512 - turfHeight, 8, turfHeight);
  }

  // 4. Authentic 3D Beveled FIA Rumble Kerbs (Top: 18..72px, Bottom: 440..494px)
  const kerbTop = 18;
  const kerbHeight = 54;
  const blockLen = 64;

  for (let x = 0; x < 2048; x += blockLen) {
    const isRed = Math.floor(x / blockLen) % 2 === 0;
    ctx.fillStyle = isRed ? '#dc2626' : '#f8fafc';
    ctx.fillRect(x, kerbTop, blockLen, kerbHeight);
    ctx.fillRect(x, 512 - kerbTop - kerbHeight, blockLen, kerbHeight);

    // 3D Bevel Highlight (Leading edge & top chamfer)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fillRect(x, kerbTop, blockLen, 4);
    ctx.fillRect(x, kerbTop, 3, kerbHeight);
    ctx.fillRect(x, 512 - kerbTop - kerbHeight, blockLen, 4);
    ctx.fillRect(x, 512 - kerbTop - kerbHeight, 3, kerbHeight);

    // 3D Bevel Shadow (Trailing edge & bottom seam)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.fillRect(x + blockLen - 3, kerbTop, 3, kerbHeight);
    ctx.fillRect(x, kerbTop + kerbHeight - 3, blockLen, 3);
    ctx.fillRect(x + blockLen - 3, 512 - kerbTop - kerbHeight, 3, kerbHeight);
    ctx.fillRect(x, 512 - kerbTop - 3, blockLen, 3);
  }

  // 5. FIA Regulation Solid White Track Limit Lines (10px width)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, kerbTop + kerbHeight, 2048, 10);
  ctx.fillRect(0, 512 - kerbTop - kerbHeight - 10, 2048, 10);

  // 6. Centerline Dashed Road Markings (54px stripe, 74px gap)
  ctx.fillStyle = '#ffffff';
  const dashLen = 54;
  const gapLen = 74;
  for (let x = 0; x < 2048; x += dashLen + gapLen) {
    ctx.fillRect(x, 253, dashLen, 6);
  }

  // 7. F1 Grand Prix Starting Grid Slot Boxes (Staggered pole positions)
  const gridPositions = [
    { x: 280, y: 155, slot: '1' },
    { x: 792, y: 325, slot: '2' },
    { x: 1304, y: 155, slot: '3' },
    { x: 1816, y: 325, slot: '4' },
  ];

  gridPositions.forEach((gp) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(gp.x, gp.y - 42);
    ctx.lineTo(gp.x, gp.y + 42);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(gp.x - 70, gp.y - 42);
    ctx.lineTo(gp.x, gp.y - 42);
    ctx.moveTo(gp.x - 70, gp.y + 42);
    ctx.lineTo(gp.x, gp.y + 42);
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.fillRect(gp.x - 24, gp.y - 3, 24, 6);

    ctx.font = '900 24px "Titillium Web", "Arial Black", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`P${gp.slot}`, gp.x - 45, gp.y);
  });

  // 8. DRS Zone Detection Transverse Line (at x = 1060)
  ctx.save();
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(1060, 82);
  ctx.lineTo(1060, 430);
  ctx.stroke();

  ctx.font = '900 18px "Titillium Web", "Arial Black", sans-serif';
  ctx.fillStyle = '#00f0ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DRS', 1060, 220);
  ctx.fillText('DRS', 1060, 292);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

/**
 * Realistic BBS Forged Alloy Rotational Motion Blur Disk:
 * Procedural radial texture showing blurred BBS multi-spokes, dark forged barrel,
 * and high-speed specular rim glints.
 */
function createBBSMotionBlurTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const cx = 128;
  const cy = 128;

  ctx.clearRect(0, 0, 256, 256);

  // Concentric radial gradient matching forged BBS alloy rotational sheen
  const grad = ctx.createRadialGradient(cx, cy, 25, cx, cy, 126);
  grad.addColorStop(0, 'rgba(12, 14, 18, 0.98)');
  grad.addColorStop(0.28, 'rgba(38, 44, 56, 0.88)');
  grad.addColorStop(0.55, 'rgba(20, 24, 32, 0.85)');
  grad.addColorStop(0.85, 'rgba(120, 140, 170, 0.90)'); // Specular outer forged rim glint
  grad.addColorStop(0.96, 'rgba(40, 48, 60, 0.92)');
  grad.addColorStop(1, 'rgba(8, 10, 14, 0.98)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 126, 0, Math.PI * 2);
  ctx.fill();

  // Concentric rotational motion grooves
  for (let r = 36; r < 122; r += 7) {
    ctx.strokeStyle = r % 14 === 0 ? 'rgba(180, 205, 245, 0.35)' : 'rgba(90, 110, 140, 0.18)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

// Camera focus positions (with calibrated azimuth and polar angles for each viewing mode)
// Memoized at module level to avoid GC thrashing and component re-render overhead
const FOCUS_TARGETS: Record<
  SubsystemFocus,
  {
    pos: [number, number, number];
    lookAt: [number, number, number];
    minAzimuth?: number;
    maxAzimuth?: number;
    minPolar?: number;
    maxPolar?: number;
  }
> = {
  all: {
    pos: [4.4, 2.0, 3.8],
    lookAt: [0, 0.45, 0],
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minPolar: 0.08,
    maxPolar: Math.PI / 2 - 0.04,
  },
  chase: {
    pos: [-4.2, 1.55, 0.0],
    lookAt: [0.0, 0.45, 0.0],
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minPolar: 0.08,
    maxPolar: Math.PI / 2 - 0.04,
  },
  nose: {
    pos: [3.4, 0.7, 1.1],
    lookAt: [1.4, 0.35, 0.0],
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minPolar: 0.08,
    maxPolar: Math.PI / 2 - 0.04,
  },
  cockpit: {
    pos: [0.30, 0.68, 0.0],
    lookAt: [1.5, 0.55, 0.0],
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minPolar: 0.08,
    maxPolar: Math.PI / 2 - 0.04,
  },
  ers: {
    pos: [-5.8, 2.4, 3.8],
    lookAt: [2.8, 0.45, -0.2],
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minPolar: 0.08,
    maxPolar: Math.PI / 2 - 0.04,
  },
  cooling: {
    pos: [0.1, 0.9, -1.5],
    lookAt: [-0.18, 0.22, -0.25],
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minPolar: 0.08,
    maxPolar: Math.PI / 2 - 0.04,
  },
  tyres: {
    pos: [2.3, 0.65, 1.6],
    lookAt: [1.6, 0.34, 0.80],
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minPolar: 0.08,
    maxPolar: Math.PI / 2 - 0.04,
  },
};

function F1Car3DViewer({ raceState, prediction }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  // UI state
  const [activeFocus, setActiveFocus] = useState<SubsystemFocus>('all');
  const [explodedRatio, setExplodedRatio] = useState<number>(0);
  const explodedRatioRef = useRef<number>(explodedRatio);
  explodedRatioRef.current = explodedRatio;
  const smoothExplodedRatioRef = useRef<number>(explodedRatio);
  const [bodyOpacity, setBodyOpacity] = useState<number>(0.42);
  const [tyreCompound, setTyreCompound] = useState<TyreCompound>('SOFT');
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [isTrackMoving, setIsTrackMoving] = useState<boolean>(true);
  const [simSpeedKmh, setSimSpeedKmh] = useState<number>(318);
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>('aero-cfd');
  const [aeroFlowMode, setAeroFlowMode] = useState<AeroFlowMode>('ALL');

  // Bundled real-time aerodynamics telemetry state (single state eliminates React reconciliation stutter)
  const [telemetry, setTelemetry] = useState({
    speedKmh: 318,
    downforceKg: 1840,
    suctionKpa: 4.8,
    dragN: 890,
    brakeTempC: 780,
  });
  const displaySpeedKmh = telemetry.speedKmh;
  const liveDownforceKg = telemetry.downforceKg;
  const liveSuctionKpa = telemetry.suctionKpa;
  const liveDragN = telemetry.dragN;
  const liveBrakeTempC = telemetry.brakeTempC;

  // ── ERS Battle Mode State (Energy Conservation, Slipstream Tow & Autonomous Overtake) ─
  const [ersBattlePhase, setErsBattlePhase] = useState<'CONSERVE' | 'OVERTAKE' | 'AHEAD'>('CONSERVE');
  const [ersBattleAutoAi, setErsBattleAutoAi] = useState<boolean>(true);
  const [ersBattleTelemetry, setErsBattleTelemetry] = useState({
    soc: 52,
    mguKw: 78,
    gapM: 11.5,
    gapS: 0.13,
    progress: -1.0,
    dragReductionPct: 32,
    leadSpeedKmh: 318,
    chaseSpeedKmh: 318,
    overtakeCount: 0,
  });

  const ersBattlePhaseRef = useRef<'CONSERVE' | 'OVERTAKE' | 'AHEAD'>('CONSERVE');
  const ersBattleAutoAiRef = useRef<boolean>(true);
  ersBattleAutoAiRef.current = ersBattleAutoAi;
  const ersBattleSocRef = useRef<number>(52.0);
  const ersOvertakeProgressRef = useRef<number>(-1.0);
  const aheadHoldTimerRef = useRef<number>(0);
  const rivalCarRootRef = useRef<THREE.Group | null>(null);
  const rivalWheelsRef = useRef<THREE.Object3D[]>([]);
  const rivalRainLightRef = useRef<THREE.Mesh | null>(null);
  const drsFlapMeshRef = useRef<THREE.Mesh | null>(null);

  // High-performance direct DOM telemetry refs (bypasses React reconciliation for steady 60-120 FPS)
  const liveSpeedTopRef = useRef<HTMLSpanElement>(null);
  const liveAeroTopRef = useRef<HTMLSpanElement>(null);
  const liveSpeedDeckRef = useRef<HTMLSpanElement>(null);
  const liveDownforceDeckRef = useRef<HTMLSpanElement>(null);
  const liveSuctionDeckRef = useRef<HTMLSpanElement>(null);
  const liveDragDeckRef = useRef<HTMLSpanElement>(null);
  const liveBrakeDeckRef = useRef<HTMLSpanElement>(null);

  // ERS Battle live DOM refs
  const ersSocValRef = useRef<HTMLSpanElement>(null);
  const ersSocBarRef = useRef<HTMLDivElement>(null);
  const ersGapValRef = useRef<HTMLSpanElement>(null);
  const ersSubValRef = useRef<HTMLSpanElement>(null);
  const ersSpeedValRef = useRef<HTMLSpanElement>(null);
  const ersMguSubValRef = useRef<HTMLSpanElement>(null);
  const ersPhaseTextRef = useRef<HTMLSpanElement>(null);

  const handleTriggerOvertake = useCallback(() => {
    ersBattlePhaseRef.current = 'OVERTAKE';
    setErsBattlePhase('OVERTAKE');
  }, []);

  const handleHoldConserve = useCallback(() => {
    ersBattlePhaseRef.current = 'CONSERVE';
    setErsBattlePhase('CONSERVE');
  }, []);

  const handleResetBattle = useCallback(() => {
    ersBattleSocRef.current = 42.0; // Starts below 68% threshold so user sees the charging arc
    // Smoothly damp back to slipstream position rather than teleporting
    ersBattlePhaseRef.current = 'CONSERVE';
    setErsBattlePhase('CONSERVE');
  }, []);

  // GLB Model Loading State
  const [loadingProgress, setLoadingProgress] = useState<number | null>(0);
  const [glbLoaded, setGlbLoaded] = useState<boolean>(false);

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const reqIdRef = useRef<number | null>(null);

  // Camera smooth glide targets
  const cameraTargetPosRef = useRef<THREE.Vector3>(new THREE.Vector3(4.4, 2.0, 3.8));
  const cameraLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.45, 0));
  const isCameraTransitioningRef = useRef<boolean>(false);

  // Animation & Dynamic references
  const carRootRef = useRef<THREE.Group | null>(null);
  const trackTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const rotatingWheelsRef = useRef<THREE.Object3D[]>([]);
  const frontWheelGroupsRef = useRef<THREE.Group[]>([]);
  const brakeRotorsRef = useRef<THREE.Mesh[]>([]);
  const blurRingsRef = useRef<THREE.Mesh[]>([]);
  const bodyMeshesRef = useRef<THREE.Mesh[]>([]);
  const bodyEdgesRef = useRef<THREE.LineSegments[]>([]);
  const particlesGeomRef = useRef<THREE.BufferGeometry | null>(null);
  const particleSystemRef = useRef<THREE.Points | null>(null);
  const sparksGeomRef = useRef<THREE.BufferGeometry | null>(null);
  const sparksSystemRef = useRef<THREE.Points | null>(null);
  const explodedPartsRef = useRef<Array<{ mesh: THREE.Object3D; basePos: THREE.Vector3; explodeDir: THREE.Vector3 }>>([]);
  const proceduralTyresGroupRef = useRef<THREE.Group | null>(null);

  // Zero-Lag Compound Texture Cache: Pre-renders textures once and swaps references instantly
  const compoundTextureCacheRef = useRef<
    Map<
      TyreCompound,
      {
        frontSidewallLeft: THREE.CanvasTexture;
        frontSidewallRight: THREE.CanvasTexture;
        rearSidewallLeft: THREE.CanvasTexture;
        rearSidewallRight: THREE.CanvasTexture;
        frontTread: THREE.CanvasTexture;
        frontBump: THREE.CanvasTexture;
        rearTread: THREE.CanvasTexture;
        rearBump: THREE.CanvasTexture;
        bumpScale: number;
      }
    >
  >(new Map());

  const tyreWheelInstancesRef = useRef<
    Array<{
      tyreMesh: THREE.Mesh;
      outerShoulder: THREE.Mesh;
      innerShoulder: THREE.Mesh;
      sidewallMesh: THREE.Mesh;
      isRear: boolean;
      isLeft: boolean;
    }>
  >([]);

  const batteryGlowMeshRef = useRef<THREE.Mesh | null>(null);
  const mgukMeshRef = useRef<THREE.Mesh | null>(null);

  // Kinematic smoothing refs for realistic inertia and pitch/heave/squat
  const smoothSpeedKmhRef = useRef<number>(simSpeedKmh);
  const prevSpeedRef = useRef<number>(simSpeedKmh);
  const aeroFlowModeRef = useRef<AeroFlowMode>(aeroFlowMode);
  aeroFlowModeRef.current = aeroFlowMode;
  const bodyOpacityRef = useRef<number>(bodyOpacity);
  bodyOpacityRef.current = bodyOpacity;
  const smoothBodyOpacityRef = useRef<number>(bodyOpacity);

  // State refs for animation loop access without re-binding
  const isTrackMovingRef = useRef(isTrackMoving);
  isTrackMovingRef.current = isTrackMoving;
  const simSpeedKmhRef = useRef(simSpeedKmh);
  simSpeedKmhRef.current = simSpeedKmh;

  // Live ERS / Telemetry state
  const batteryPercent = raceState?.battery_percent ?? 78.4;
  const action = prediction?.action ?? 'HOLD';
  const tyreDegradation = raceState?.tire_wear_percent ?? 12.8;

  const actionRef = useRef(action);
  actionRef.current = action;

  // Subsystem focus tracking ref
  const activeFocusRef = useRef<SubsystemFocus>(activeFocus);
  activeFocusRef.current = activeFocus;
  const autoRotateRef = useRef<boolean>(autoRotate);
  autoRotateRef.current = autoRotate;
  const hoveredFocusRef = useRef<SubsystemFocus | null>(null);

  // Highlightable mesh registry for dynamic spotlights & dimming
  const highlightRegistryRef = useRef<
    Array<{
      mesh: THREE.Mesh;
      subsystem: string;
      baseOpacity: number;
      baseEmissiveIntensity: number;
    }>
  >([]);

  // Helper to obtain or generate memoized textures for 0ms compound switching
  const getCompoundTextures = useCallback((compound: TyreCompound) => {
    const existing = compoundTextureCacheRef.current.get(compound);
    if (existing) return existing;

    // 1. Front Sidewall (305mm)
    const fSidewallCanvas = document.createElement('canvas');
    fSidewallCanvas.width = 1024;
    fSidewallCanvas.height = 1024;
    drawPirettiSidewall(fSidewallCanvas, compound, false);
    const frontSidewallLeft = new THREE.CanvasTexture(fSidewallCanvas);
    frontSidewallLeft.generateMipmaps = true;
    frontSidewallLeft.minFilter = THREE.LinearMipmapLinearFilter;

    const frontSidewallRight = frontSidewallLeft.clone();
    frontSidewallRight.wrapS = THREE.RepeatWrapping;
    frontSidewallRight.repeat.x = -1;
    frontSidewallRight.offset.x = 1;
    frontSidewallRight.needsUpdate = true;

    // 2. Rear Sidewall (405mm)
    const rSidewallCanvas = document.createElement('canvas');
    rSidewallCanvas.width = 1024;
    rSidewallCanvas.height = 1024;
    drawPirettiSidewall(rSidewallCanvas, compound, true);
    const rearSidewallLeft = new THREE.CanvasTexture(rSidewallCanvas);
    rearSidewallLeft.generateMipmaps = true;
    rearSidewallLeft.minFilter = THREE.LinearMipmapLinearFilter;

    const rearSidewallRight = rearSidewallLeft.clone();
    rearSidewallRight.wrapS = THREE.RepeatWrapping;
    rearSidewallRight.repeat.x = -1;
    rearSidewallRight.offset.x = 1;
    rearSidewallRight.needsUpdate = true;

    // 3. Front Tread & Bump
    const fTreadCanvas = document.createElement('canvas');
    fTreadCanvas.width = 1024;
    fTreadCanvas.height = 256;
    const fBumpCanvas = document.createElement('canvas');
    fBumpCanvas.width = 1024;
    fBumpCanvas.height = 256;
    const bumpScale = drawTyreTread(fTreadCanvas, fBumpCanvas, compound, false);

    const frontTread = new THREE.CanvasTexture(fTreadCanvas);
    frontTread.wrapS = THREE.RepeatWrapping;
    frontTread.wrapT = THREE.ClampToEdgeWrapping;
    frontTread.repeat.set(4, 1);

    const frontBump = new THREE.CanvasTexture(fBumpCanvas);
    frontBump.wrapS = THREE.RepeatWrapping;
    frontBump.wrapT = THREE.ClampToEdgeWrapping;
    frontBump.repeat.set(4, 1);

    // 4. Rear Tread & Bump
    const rTreadCanvas = document.createElement('canvas');
    rTreadCanvas.width = 1024;
    rTreadCanvas.height = 256;
    const rBumpCanvas = document.createElement('canvas');
    rBumpCanvas.width = 1024;
    rBumpCanvas.height = 256;
    drawTyreTread(rTreadCanvas, rBumpCanvas, compound, true);

    const rearTread = new THREE.CanvasTexture(rTreadCanvas);
    rearTread.wrapS = THREE.RepeatWrapping;
    rearTread.wrapT = THREE.ClampToEdgeWrapping;
    rearTread.repeat.set(4, 1);

    const rearBump = new THREE.CanvasTexture(rBumpCanvas);
    rearBump.wrapS = THREE.RepeatWrapping;
    rearBump.wrapT = THREE.ClampToEdgeWrapping;
    rearBump.repeat.set(4, 1);

    const record = {
      frontSidewallLeft,
      frontSidewallRight,
      rearSidewallLeft,
      rearSidewallRight,
      frontTread,
      frontBump,
      rearTread,
      rearBump,
      bumpScale,
    };
    compoundTextureCacheRef.current.set(compound, record);
    return record;
  }, []);

  const handleFocusChange = useCallback((focus: SubsystemFocus) => {
    setActiveFocus(focus);
    activeFocusRef.current = focus;
    setAutoRotate(false);
    autoRotateRef.current = false;
    if (controlsRef.current) {
      controlsRef.current.autoRotate = false;
      controlsRef.current.enabled = false; // Lock user gestures during smooth cinematic camera glide
      controlsRef.current.enableDamping = false;
      controlsRef.current.minAzimuthAngle = -Infinity;
      controlsRef.current.maxAzimuthAngle = Infinity;
      controlsRef.current.minPolarAngle = 0.08;
      controlsRef.current.maxPolarAngle = Math.PI / 2 - 0.04;
    }
    if (!cameraRef.current || !controlsRef.current) return;
    const { pos, lookAt } = FOCUS_TARGETS[focus];
    cameraTargetPosRef.current.set(pos[0], pos[1], pos[2]);
    cameraLookAtRef.current.set(lookAt[0], lookAt[1], lookAt[2]);
    isCameraTransitioningRef.current = true;
  }, []);

  // Sync OrbitControls autoRotate dynamically without scene reconstruction
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 1.6;
    }
  }, [autoRotate]);

  // Instant zero-lag tyre compound switching (swaps cached textures in 0ms)
  useEffect(() => {
    const texSet = getCompoundTextures(tyreCompound);
    tyreWheelInstancesRef.current.forEach(
      ({ tyreMesh, outerShoulder, innerShoulder, sidewallMesh, isRear, isLeft }) => {
        const treadMap = isRear ? texSet.rearTread : texSet.frontTread;
        const bumpMap = isRear ? texSet.rearBump : texSet.frontBump;
        const sidewallMap = isRear
          ? isLeft
            ? texSet.rearSidewallLeft
            : texSet.rearSidewallRight
          : isLeft
          ? texSet.frontSidewallLeft
          : texSet.frontSidewallRight;

        if (tyreMesh.material instanceof THREE.MeshStandardMaterial) {
          tyreMesh.material.map = treadMap;
          tyreMesh.material.bumpMap = bumpMap;
          tyreMesh.material.bumpScale = texSet.bumpScale;
          tyreMesh.material.roughness =
            tyreCompound === 'INTER' || tyreCompound === 'WET' ? 0.70 : 0.88;
        }
        if (outerShoulder.material instanceof THREE.MeshStandardMaterial) {
          outerShoulder.material.map = treadMap;
          outerShoulder.material.bumpMap = bumpMap;
          outerShoulder.material.bumpScale = texSet.bumpScale * 0.7;
        }
        if (innerShoulder.material instanceof THREE.MeshStandardMaterial) {
          innerShoulder.material.map = treadMap;
          innerShoulder.material.bumpMap = bumpMap;
          innerShoulder.material.bumpScale = texSet.bumpScale * 0.7;
        }
        if (sidewallMesh.material instanceof THREE.MeshStandardMaterial) {
          sidewallMesh.material.map = sidewallMap;
        }
      }
    );
  }, [tyreCompound, getCompoundTextures]);

  // Update chassis transparency / opacity target (continuous WebGL optical interpolation in animate loop)
  useEffect(() => {
    bodyOpacityRef.current = bodyOpacity;
  }, [bodyOpacity]);

  // Update CFD Aerodynamics mode visibility immediately
  useEffect(() => {
    if (particleSystemRef.current) {
      particleSystemRef.current.visible = aeroFlowMode === 'ALL' || aeroFlowMode === 'VORTICES';
    }
    if (sparksSystemRef.current) {
      sparksSystemRef.current.visible = aeroFlowMode === 'ALL' || aeroFlowMode === 'SPARKS';
    }
  }, [aeroFlowMode]);

  // Update fine-grained exploded view target (smooth continuous WebGL interpolation handled in animate loop)
  useEffect(() => {
    explodedRatioRef.current = explodedRatio;
  }, [explodedRatio]);

  // ── Scene Initialization & Dynamic Track Loop ──────────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x060810);
    scene.fog = new THREE.FogExp2(0x060810, 0.032);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      120
    );
    camera.position.set(4.4, 2.0, 3.8);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 1.0;
    controls.maxDistance = 18.0;
    controls.target.set(0, 0.45, 0);
    controls.autoRotate = autoRotateRef.current;
    controls.autoRotateSpeed = 1.6;
    controls.addEventListener('start', () => {
      isCameraTransitioningRef.current = false;
      controls.enableDamping = true;
    });
    controlsRef.current = controls;

    // ── Lighting ──
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const topSpot = new THREE.SpotLight(0xffffff, 6.0, 30, Math.PI / 4, 0.35, 1.2);
    topSpot.position.set(0, 9, 0);
    topSpot.castShadow = false;
    scene.add(topSpot);

    const keyLight = new THREE.DirectionalLight(0x00f0ff, 2.8);
    keyLight.position.set(6, 4, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xe10600, 3.6);
    rimLight.position.set(-6, 4, -5);
    scene.add(rimLight);

    const floorBounce = new THREE.DirectionalLight(0x38bdf8, 1.2);
    floorBounce.position.set(0, -2, 0);
    scene.add(floorBounce);

    // ── 1. PROCEDURAL MOVING GRAND PRIX TRACK ROADWAY ──────────────────
    // Authentic FIA Grand Prix circuit track texture (rubbered racing line, 3D rumble kerbs, grid boxes, DRS detection)
    const trackTexture = createGrandPrixTrackTexture();
    trackTexture.repeat.set(16, 1);
    trackTextureRef.current = trackTexture;

    // Track Ribbon Plane (120 units long, 10.0 units wide for authentic circuit scale)
    // 16 repeats along 120m means each procedural tile is exactly 7.5 meters long
    const trackGeo = new THREE.PlaneGeometry(120, 10.0);
    const trackMat = new THREE.MeshStandardMaterial({
      map: trackTexture,
      roughness: 0.72,
      metalness: 0.20,
    });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.rotation.x = -Math.PI / 2;
    trackMesh.position.set(0, -0.01, 0);
    trackMesh.receiveShadow = true;
    scene.add(trackMesh);

    // ── 2. HIGH-PERFORMANCE AERODYNAMIC CFD STREAMLINE SYSTEM ─────────
    // 480 CFD Streamline particles structured into 4 authentic aerodynamic flow domains:
    // Domain 1 (0..120): Front Wing Ground-Effect Outwash & Endplate Wake (wraps around front wheels)
    // Domain 2 (120..240): Underfloor Ground-Effect Venturi Tunnels (Electric Cyan high-velocity streaks)
    // Domain 3 (240..360): Sidepod Undercut & Coke-Bottle Waistline Flow (hugs sidepod contours)
    // Domain 4 (360..480): Rear Wing Helical Tip Vortices (twin corkscrew ribbons off rear endplates)
    const particleCount = 480;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleVels = new Float32Array(particleCount);

    const cCyan = new THREE.Color(0x00f0ff);
    const cSky = new THREE.Color(0x38bdf8);
    const cViolet = new THREE.Color(0xc084fc);

    for (let i = 0; i < particleCount; i++) {
      let col = cSky;
      if (i < 120) {
        // Front Wing outwash
        particlePositions[i * 3] = 1.0 + Math.random() * 4.0;
        particlePositions[i * 3 + 1] = 0.08 + Math.random() * 0.45;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 2.2;
        particleVels[i] = 1.0 + Math.random() * 0.3;
        col = cSky;
      } else if (i < 240) {
        // Underfloor Venturi tunnels (High-velocity electric cyan)
        particlePositions[i * 3] = -1.4 + Math.random() * 2.8;
        particlePositions[i * 3 + 1] = 0.04 + Math.random() * 0.12;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.9;
        particleVels[i] = 1.45 + Math.random() * 0.35;
        col = cCyan;
      } else if (i < 360) {
        // Sidepod undercut
        particlePositions[i * 3] = -1.2 + Math.random() * 2.2;
        particlePositions[i * 3 + 1] = 0.2 + Math.random() * 0.5;
        const sideSign = i % 2 === 0 ? 1 : -1;
        particlePositions[i * 3 + 2] = sideSign * (0.35 + Math.random() * 0.4);
        particleVels[i] = 1.1 + Math.random() * 0.2;
        col = cSky;
      } else {
        // Rear wing corkscrew vortices
        particlePositions[i * 3] = -3.5 + Math.random() * 2.2;
        particlePositions[i * 3 + 1] = 0.75 + Math.random() * 0.35;
        particlePositions[i * 3 + 2] = (i % 2 === 0 ? 1 : -1) * (0.65 + Math.random() * 0.2);
        particleVels[i] = 1.3 + Math.random() * 0.3;
        col = cViolet;
      }
      particleColors[i * 3] = col.r;
      particleColors[i * 3 + 1] = col.g;
      particleColors[i * 3 + 2] = col.b;
    }

    const particlesGeom = new THREE.BufferGeometry();
    particlesGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particlesGeom.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    particlesGeomRef.current = particlesGeom;

    const particleMat = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particleSystem = new THREE.Points(particlesGeom, particleMat);
    scene.add(particleSystem);
    particleSystemRef.current = particleSystem;

    // ── 2B. UNDER-FLOOR TITANIUM SKID PLANK SPARKS SYSTEM ────────────
    // Authentic Formula 1 high-speed bottoming sparks shooting rearward from the Jabroc wooden plank
    const sparkCount = 85;
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkVelocities = new Float32Array(sparkCount * 3);
    const sparkLifetimes = new Float32Array(sparkCount);
    const sparkMaxLifetimes = new Float32Array(sparkCount);

    for (let i = 0; i < sparkCount; i++) {
      sparkPositions[i * 3] = -0.8;
      sparkPositions[i * 3 + 1] = -100; // Hidden initially
      sparkPositions[i * 3 + 2] = 0;
      sparkLifetimes[i] = 1.0;
      sparkMaxLifetimes[i] = 0.18 + Math.random() * 0.32;
    }

    const sparksGeom = new THREE.BufferGeometry();
    sparksGeom.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    sparksGeomRef.current = sparksGeom;

    const sparksMat = new THREE.PointsMaterial({
      color: 0xffb703,
      size: 0.08,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sparksSystem = new THREE.Points(sparksGeom, sparksMat);
    scene.add(sparksSystem);
    sparksSystemRef.current = sparksSystem;

    // ── 3. CAR HIERARCHY SETUP ─────────────────────────────────────────
    const carRoot = new THREE.Group();
    scene.add(carRoot);
    carRootRef.current = carRoot;
    bodyMeshesRef.current = [];
    bodyEdgesRef.current = [];

    // ── 3B. RIVAL CAR HIERARCHY SETUP (ERS Battle Mode) ────────────────
    const rivalCarRoot = new THREE.Group();
    rivalCarRoot.visible = false;
    scene.add(rivalCarRoot);
    rivalCarRootRef.current = rivalCarRoot;
    rivalWheelsRef.current = [];

    // Transparent Bodywork Material (X-Ray Holographic Carbon Glass with Clearcoat)
    const initOpacity = bodyOpacityRef.current;
    const transparentBodyMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x72aaff).lerp(new THREE.Color(0xd90429), Math.pow(initOpacity, 1.35)),
      transparent: true,
      opacity: initOpacity,
      roughness: THREE.MathUtils.lerp(0.06, 0.38, initOpacity),
      metalness: THREE.MathUtils.lerp(0.96, 0.5, initOpacity),
      clearcoat: THREE.MathUtils.lerp(0.08, 0.90, initOpacity),
      clearcoatRoughness: 0.15,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const explodedParts: Array<{ mesh: THREE.Object3D; basePos: THREE.Vector3; explodeDir: THREE.Vector3 }> = [];
    const rotatingWheels: THREE.Object3D[] = [];

    // Helper: Fine-grained exploded classification based on sub-component spatial coordinates & names
    const calculateFineExplodeVector = (x: number, y: number, z: number, name: string): THREE.Vector3 => {
      const n = name.toLowerCase();

      // 1. Front Wing Left Cascade Tiers & Flaps (Forward, Up, Far Left)
      if (n.includes('fw_l') || n.includes('front_l') || (x > 1.45 && z > 0.28)) {
        return new THREE.Vector3(2.3, 0.45, 1.8);
      }

      // 2. Front Wing Right Cascade Tiers & Flaps (Forward, Up, Far Right)
      if (n.includes('fw_r') || n.includes('front_r') || (x > 1.45 && z < -0.28)) {
        return new THREE.Vector3(2.3, 0.45, -1.8);
      }

      // 3. Front Wing Center Mainplane & Ground Scoop (Far Forward, Groundward)
      if (x > 1.7 && Math.abs(z) <= 0.28) {
        return new THREE.Vector3(2.7, -0.3, 0.0);
      }

      // 4. Nosecone Tip & Forward Impact Attenuator (Far Forward, Slightly Up)
      if (n.includes('nose') || (x > 0.85 && x <= 1.7 && Math.abs(z) <= 0.35 && y <= 0.55)) {
        return new THREE.Vector3(2.4, 0.35, 0.0);
      }

      // 5. Front Suspension Wishbones & Pushrods (Outward Diagonally Left / Right)
      if (n.includes('suspension') || (x > 0.7 && x <= 1.6 && Math.abs(z) > 0.35)) {
        return new THREE.Vector3(0.8, 0.4, z >= 0 ? 2.0 : -2.0);
      }

      // 6. Titanium Halo Safety Hoop Arch (High Skyward +Y)
      if (n.includes('halo') || (x > -0.3 && x <= 0.6 && y > 0.55 && Math.abs(z) < 0.35)) {
        return new THREE.Vector3(0.0, 2.8, 0.0);
      }

      // 7. Left Aero Wing Mirror & Twin Stalks (Forward, Skyward, Left)
      if (n.includes('mirrorl') || n.includes('mirror_l') || (x > 0.1 && x <= 0.6 && y > 0.45 && z > 0.36)) {
        return new THREE.Vector3(0.35, 1.25, 2.5);
      }

      // 8. Right Aero Wing Mirror & Twin Stalks (Forward, Skyward, Right)
      if (n.includes('mirrorr') || n.includes('mirror_r') || (x > 0.1 && x <= 0.6 && y > 0.45 && z < -0.36)) {
        return new THREE.Vector3(0.35, 1.25, -2.5);
      }

      // 9. Steering Wheel & Cockpit Instruments (Upward, Forward)
      if (n.includes('sw_body') || n.includes('steering')) {
        return new THREE.Vector3(0.4, 1.0, 0.0);
      }

      // 10. Left Sidepod Upper Louvered Cooling Deck (Outward Left +Z, Upward)
      if (x > -1.1 && x <= 0.6 && z > 0.32 && y > 0.22) {
        return new THREE.Vector3(-0.25, 0.85, 2.6);
      }

      // 11. Right Sidepod Upper Louvered Cooling Deck (Outward Right -Z, Upward)
      if (x > -1.1 && x <= 0.6 && z < -0.32 && y > 0.22) {
        return new THREE.Vector3(-0.25, 0.85, -2.6);
      }

      // 12. Roll Hoop T-Camera & Overhead Airbox (Extreme Skyward +Y)
      if (n.includes('tcam') || (x > -1.3 && x <= -0.1 && y > 0.65)) {
        return new THREE.Vector3(-0.35, 3.1, 0.0);
      }

      // 13. Central Engine Cover & Dorsal Shark Fin Aero Spine (Skyward, Rearward)
      if (x > -1.4 && x <= 0.0 && y > 0.45 && Math.abs(z) < 0.28) {
        return new THREE.Vector3(-0.85, 2.5, 0.0);
      }

      // 14. DRS Upper Flap & Hydraulic Actuator Pod (High Rearward & Skyward)
      if (x <= -1.3 && y > 0.72) {
        return new THREE.Vector3(-2.4, 2.4, 0.0);
      }

      // 15. Rear Wing Endplate Left (Rearward, Upward, Outward Left)
      if (x <= -1.3 && y > 0.35 && z > 0.32) {
        return new THREE.Vector3(-2.2, 1.1, 2.4);
      }

      // 16. Rear Wing Endplate Right (Rearward, Upward, Outward Right)
      if (x <= -1.3 && y > 0.35 && z < -0.32) {
        return new THREE.Vector3(-2.2, 1.1, -2.4);
      }

      // 17. Rear Wing Lower Mainplane Foil (Direct Rearward & Upward)
      if (x <= -1.3 && y > 0.48 && Math.abs(z) <= 0.32) {
        return new THREE.Vector3(-2.6, 1.1, 0.0);
      }

      // 18. Lower Beam Wing, Rear Crash Structure & FIA Rain Light (Direct Rearward)
      if (n.includes('rear light') || n.includes('light') || (x <= -1.4 && y > 0.22 && y <= 0.48 && Math.abs(z) <= 0.32)) {
        return new THREE.Vector3(-2.7, -0.2, 0.0);
      }

      // 19. Underfloor Venturi Tunnels, Central Skid Plank & Rear Diffuser (Groundward -Y)
      if (y <= 0.22) {
        if (x < -0.8) {
          return new THREE.Vector3(-1.4, -1.9, z >= 0 ? 0.9 : -0.9);
        }
        return new THREE.Vector3(-0.1, -2.2, z >= 0 ? 1.2 : -1.2);
      }

      // 20. Omnidirectional 360° Spherical Fallback Dispersion with Lateral De-Clustering
      const dx = x - 0.0;
      const dy = y - 0.35;
      let dz = z;
      if (Math.abs(dz) < 0.12) {
        const hash = Math.sin(x * 37.17 + y * 73.91) * 43758.5453;
        const latSign = ((hash - Math.floor(hash)) > 0.5) ? 1 : -1;
        dz = latSign * (0.45 + Math.abs(hash % 0.4));
      }
      const mag = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1.0;
      const normX = dx / mag;
      const normY = dy / mag;
      const normZ = dz / mag;
      const scale = 2.4 + Math.abs(Math.sin(x * 3.7)) * 0.5;
      return new THREE.Vector3(normX * scale, normY * scale, normZ * scale);
    };

    // ── 4. NON-TRANSPARENT INTERNAL SUBSYSTEMS (AUTHENTIC RENAULT F1 POWER UNIT & ERS) ──
    // Modeled with technical precision from the Renault Sport F1 ERS schematics and 3D exploded layout
    const internalSystemsGroup = new THREE.Group();
    carRoot.add(internalSystemsGroup);

    // Reset highlight registry on mount
    highlightRegistryRef.current = [];

    const registerHighlightMesh = (mesh: THREE.Mesh, subsystem: string) => {
      mesh.userData.subsystem = subsystem;
      if (mesh.material instanceof THREE.Material) {
        mesh.material.transparent = true;
        const stdMat = mesh.material as THREE.MeshStandardMaterial;
        highlightRegistryRef.current.push({
          mesh,
          subsystem,
          baseOpacity: mesh.material.opacity ?? 1.0,
          baseEmissiveIntensity: stdMat.emissiveIntensity ?? 0,
        });
      }
    };

    const registerHighlightGroup = (group: THREE.Object3D, subsystem: string) => {
      group.userData.subsystem = subsystem;
      group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          registerHighlightMesh(child as THREE.Mesh, subsystem);
        }
      });
    };

    // Shared high-detail materials matching Image 1 & 2 (transparent: true enables smooth dimming)
    const engineAlloyMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.92,
      roughness: 0.28,
      transparent: true,
      opacity: 1.0,
    });
    const carbonIntakeMat = new THREE.MeshStandardMaterial({
      color: 0x18181c,
      metalness: 0.35,
      roughness: 0.35,
      transparent: true,
      opacity: 1.0,
    });
    const exhaustHeatMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.45,
      transparent: true,
      opacity: 1.0,
    });
    const turboAlloyMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.96,
      roughness: 0.18,
      transparent: true,
      opacity: 1.0,
    });
    const goldAnodizedMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.95,
      roughness: 0.22,
      transparent: true,
      opacity: 1.0,
    });
    const greenEnergyLineMat = new THREE.MeshStandardMaterial({
      color: 0x10e782,
      emissive: 0x10e782,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0.6,
      transparent: true,
      opacity: 1.0,
    });
    const orangeHvLineMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.6,
      roughness: 0.4,
      metalness: 0.5,
      transparent: true,
      opacity: 1.0,
    });
    const blueAeroPipeMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.7,
      transparent: true,
      opacity: 1.0,
    });

    // ─────────────────────────────────────────────────────────────
    // A. 1.6L 90° V6 INTERNAL COMBUSTION ENGINE (Center: x = -0.54, y = 0.19, z = 0)
    // ─────────────────────────────────────────────────────────────
    // 1. Lower Engine Crankcase / Sump
    const crankcaseGeo = new THREE.BoxGeometry(0.44, 0.14, 0.22);
    const crankcaseMesh = new THREE.Mesh(crankcaseGeo, engineAlloyMat.clone());
    crankcaseMesh.position.set(-0.54, 0.14, 0);
    crankcaseMesh.castShadow = true;
    internalSystemsGroup.add(crankcaseMesh);
    registerHighlightMesh(crankcaseMesh, 'engine');

    // 2. 90° V6 Cylinder Banks (Left Bank: +Z, Right Bank: -Z)
    const bankGeo = new THREE.BoxGeometry(0.36, 0.14, 0.12);
    const leftBank = new THREE.Mesh(bankGeo, engineAlloyMat.clone());
    leftBank.position.set(-0.54, 0.22, 0.09);
    leftBank.rotation.x = -Math.PI * 0.25; // 45° angle
    internalSystemsGroup.add(leftBank);
    registerHighlightMesh(leftBank, 'engine');

    const rightBank = new THREE.Mesh(bankGeo, engineAlloyMat.clone());
    rightBank.position.set(-0.54, 0.22, -0.09);
    rightBank.rotation.x = Math.PI * 0.25; // 45° angle
    internalSystemsGroup.add(rightBank);
    registerHighlightMesh(rightBank, 'engine');

    // Cam Covers with Anodized Red Accent Strips
    const camCoverMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.3,
      metalness: 0.8,
      transparent: true,
      opacity: 1.0,
    });
    const leftCamCover = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.10), camCoverMat);
    leftCamCover.position.set(-0.54, 0.26, 0.12);
    leftCamCover.rotation.x = -Math.PI * 0.25;
    internalSystemsGroup.add(leftCamCover);
    registerHighlightMesh(leftCamCover, 'engine');

    const rightCamCover = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.10), camCoverMat);
    rightCamCover.position.set(-0.54, 0.26, -0.12);
    rightCamCover.rotation.x = Math.PI * 0.25;
    internalSystemsGroup.add(rightCamCover);
    registerHighlightMesh(rightCamCover, 'engine');

    // 3. 6 Curved Intake Trumpets (3 per bank, routing into the central plenum)
    for (let i = -0.10; i <= 0.10; i += 0.10) {
      const leftRunner = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.07, 12), engineAlloyMat.clone());
      leftRunner.position.set(-0.54 + i, 0.27, 0.05);
      leftRunner.rotation.z = 0.1;
      leftRunner.rotation.x = 0.3;
      internalSystemsGroup.add(leftRunner);
      registerHighlightMesh(leftRunner, 'engine');

      const rightRunner = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.07, 12), engineAlloyMat.clone());
      rightRunner.position.set(-0.54 + i, 0.27, -0.05);
      rightRunner.rotation.z = 0.1;
      rightRunner.rotation.x = -0.3;
      internalSystemsGroup.add(rightRunner);
      registerHighlightMesh(rightRunner, 'engine');
    }

    // 4. Carbon Fiber Airbox / Intake Plenum on top of the V
    const plenumGeo = new THREE.BoxGeometry(0.32, 0.10, 0.14);
    const plenumMesh = new THREE.Mesh(plenumGeo, carbonIntakeMat.clone());
    plenumMesh.position.set(-0.54, 0.33, 0);
    internalSystemsGroup.add(plenumMesh);
    registerHighlightMesh(plenumMesh, 'engine');

    // 5. 3-Into-1 Exhaust Headers (Left & Right Banks converging to Turbo)
    const leftExhaust = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.034, 0.28, 12),
      exhaustHeatMat.clone()
    );
    leftExhaust.rotation.z = Math.PI * 0.45;
    leftExhaust.rotation.y = -Math.PI * 0.15;
    leftExhaust.position.set(-0.64, 0.19, 0.12);
    internalSystemsGroup.add(leftExhaust);
    registerHighlightMesh(leftExhaust, 'engine');

    const rightExhaust = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.034, 0.28, 12),
      exhaustHeatMat.clone()
    );
    rightExhaust.rotation.z = Math.PI * 0.45;
    rightExhaust.rotation.y = Math.PI * 0.15;
    rightExhaust.position.set(-0.64, 0.19, -0.12);
    internalSystemsGroup.add(rightExhaust);
    registerHighlightMesh(rightExhaust, 'engine');

    // ─────────────────────────────────────────────────────────────
    // B. MGU-H (E-TURBO HEAT MOTOR GENERATOR)
    // ─────────────────────────────────────────────────────────────
    // In Image 1 & 2: Positioned directly in the V-valley on the turbo shaft!
    const mguhGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.20, 20);
    mguhGeo.rotateZ(Math.PI / 2);
    const mguhMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.94,
      roughness: 0.2,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 1.0,
    });
    const mguhMesh = new THREE.Mesh(mguhGeo, mguhMat);
    mguhMesh.position.set(-0.56, 0.25, 0);
    internalSystemsGroup.add(mguhMesh);
    registerHighlightMesh(mguhMesh, 'ers');

    // Copper Stator Rings on MGU-H
    for (let r = -0.07; r <= 0.07; r += 0.045) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.010, 10, 20), goldAnodizedMat.clone());
      ring.position.set(-0.56 + r, 0.25, 0);
      ring.rotation.y = Math.PI / 2;
      internalSystemsGroup.add(ring);
      registerHighlightMesh(ring, 'ers');
    }

    // ─────────────────────────────────────────────────────────────
    // C. TURBOCHARGER ASSEMBLY (COMPRESSOR & TURBINE + EXHAUST OUTLET)
    // ─────────────────────────────────────────────────────────────
    // 1. Forward Compressor Housing (Silver Polished Scroll)
    const compressorGeo = new THREE.TorusGeometry(0.082, 0.035, 14, 24);
    const compressorMesh = new THREE.Mesh(compressorGeo, turboAlloyMat.clone());
    compressorMesh.position.set(-0.76, 0.25, 0);
    compressorMesh.rotation.y = Math.PI / 2;
    internalSystemsGroup.add(compressorMesh);
    registerHighlightMesh(compressorMesh, 'engine');

    // 2. Rear Turbine Housing (Cast Dark Heat-Shielded Scroll)
    const turbineGeo = new THREE.TorusGeometry(0.086, 0.038, 14, 24);
    const turbineMesh = new THREE.Mesh(turbineGeo, exhaustHeatMat.clone());
    turbineMesh.position.set(-0.86, 0.25, 0);
    turbineMesh.rotation.y = Math.PI / 2;
    internalSystemsGroup.add(turbineMesh);
    registerHighlightMesh(turbineMesh, 'engine');

    // 3. Central Exhaust Tailpipe (FIA Regulation single central exhaust)
    const tailpipeGeo = new THREE.CylinderGeometry(0.048, 0.052, 0.65, 20);
    tailpipeGeo.rotateZ(Math.PI / 2);
    const tailpipeMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.94,
      roughness: 0.3,
      transparent: true,
      opacity: 1.0,
    });
    const tailpipe = new THREE.Mesh(tailpipeGeo, tailpipeMat);
    tailpipe.position.set(-1.18, 0.25, 0);
    internalSystemsGroup.add(tailpipe);
    registerHighlightMesh(tailpipe, 'engine');

    // Gold Heat-Shielding Sleeve on Tailpipe base
    const heatShield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.056, 0.056, 0.20, 18),
      goldAnodizedMat.clone()
    );
    heatShield.rotateZ(Math.PI / 2);
    heatShield.position.set(-0.98, 0.25, 0);
    internalSystemsGroup.add(heatShield);
    registerHighlightMesh(heatShield, 'engine');

    // ─────────────────────────────────────────────────────────────
    // D. MGU-K (120 kW KINETIC MOTOR GENERATOR)
    // ─────────────────────────────────────────────────────────────
    // In Image 1 & 2: Mounted on the DRIVER'S LEFT (+Z side) of the engine crankcase!
    const mgukGeo = new THREE.CylinderGeometry(0.082, 0.082, 0.26, 20);
    mgukGeo.rotateZ(Math.PI / 2);
    const mgukMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.95,
      roughness: 0.22,
      emissive: 0x10e782,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 1.0,
    });
    const mgukMesh = new THREE.Mesh(mgukGeo, mgukMat);
    mgukMesh.position.set(-0.46, 0.15, 0.18);
    mgukMesh.castShadow = true;
    internalSystemsGroup.add(mgukMesh);
    mgukMeshRef.current = mgukMesh;
    registerHighlightMesh(mgukMesh, 'ers');

    // Copper stator cooling rings on MGU-K
    for (let r = -0.08; r <= 0.08; r += 0.05) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.010, 10, 20), goldAnodizedMat.clone());
      ring.position.set(-0.46 + r, 0.15, 0.18);
      ring.rotation.y = Math.PI / 2;
      internalSystemsGroup.add(ring);
      registerHighlightMesh(ring, 'ers');
    }

    // Gear Coupling to Crankshaft (as depicted in schematic)
    const gearCasing = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.12, 0.08),
      engineAlloyMat.clone()
    );
    gearCasing.position.set(-0.33, 0.15, 0.14);
    internalSystemsGroup.add(gearCasing);
    registerHighlightMesh(gearCasing, 'engine');

    // ─────────────────────────────────────────────────────────────
    // E. ENERGY STORE (BATTERY PACK: 20-25 kg)
    // ─────────────────────────────────────────────────────────────
    // In Image 1 & 2: Located directly behind driver monocoque cell
    const batteryGeo = new THREE.BoxGeometry(0.44, 0.20, 0.32);
    const batteryMat = new THREE.MeshStandardMaterial({
      color: 0x072d27,
      roughness: 0.25,
      metalness: 0.92,
      emissive: 0x00d2be,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 1.0,
    });
    const batteryMesh = new THREE.Mesh(batteryGeo, batteryMat);
    batteryMesh.position.set(-0.16, 0.19, 0.02);
    batteryMesh.castShadow = true;
    internalSystemsGroup.add(batteryMesh);
    batteryGlowMeshRef.current = batteryMesh;
    registerHighlightMesh(batteryMesh, 'ers');

    // Dual Raised Battery Module Lids (from Image 2 exploded render)
    const moduleLidMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.3,
      transparent: true,
      opacity: 1.0,
    });
    const moduleLid1 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.11), moduleLidMat);
    moduleLid1.position.set(-0.16, 0.30, 0.08);
    internalSystemsGroup.add(moduleLid1);
    registerHighlightMesh(moduleLid1, 'ers');

    const moduleLid2 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.11), moduleLidMat.clone());
    moduleLid2.position.set(-0.16, 0.30, -0.06);
    internalSystemsGroup.add(moduleLid2);
    registerHighlightMesh(moduleLid2, 'ers');

    // Glowing Neon Busbar Grid on Energy Store
    for (let i = -0.10; i <= 0.10; i += 0.05) {
      const busbar = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.018, 0.02),
        new THREE.MeshStandardMaterial({
          color: 0x00f0ff,
          emissive: 0x00f0ff,
          emissiveIntensity: 1.2,
          transparent: true,
          opacity: 1.0,
        })
      );
      busbar.position.set(-0.16, 0.315, i);
      internalSystemsGroup.add(busbar);
      registerHighlightMesh(busbar, 'ers');
    }

    // High-Voltage Warning Decal
    const hvLabel = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.06, 0.008),
      new THREE.MeshStandardMaterial({
        color: 0xffb800,
        emissive: 0xffb800,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 1.0,
      })
    );
    hvLabel.position.set(-0.16, 0.19, 0.183);
    internalSystemsGroup.add(hvLabel);
    registerHighlightMesh(hvLabel, 'ers');

    // ─────────────────────────────────────────────────────────────
    // F. ERS CONTROL UNIT (INVERTER / POWER ELECTRONICS)
    // ─────────────────────────────────────────────────────────────
    // In Image 1: Explicitly labeled in the DRIVER'S LEFT sidepod shoulder!
    const ecuGeo = new THREE.BoxGeometry(0.20, 0.13, 0.16);
    const ecuMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.92,
      roughness: 0.25,
      emissive: 0x00d2be,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 1.0,
    });
    const ecuMesh = new THREE.Mesh(ecuGeo, ecuMat);
    ecuMesh.position.set(-0.16, 0.24, 0.27);
    internalSystemsGroup.add(ecuMesh);
    registerHighlightMesh(ecuMesh, 'ers');

    // Aluminum Ribbed Cooling Fins on ERS Control Unit
    for (let f = -0.06; f <= 0.06; f += 0.024) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.007), engineAlloyMat.clone());
      fin.position.set(-0.16, 0.31, 0.27 + f);
      internalSystemsGroup.add(fin);
      registerHighlightMesh(fin, 'ers');
    }

    // Dual Status LEDs (Green & Amber)
    const ledGreen = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x10e782, transparent: true, opacity: 1.0 })
    );
    ledGreen.position.set(-0.06, 0.27, 0.24);
    internalSystemsGroup.add(ledGreen);
    registerHighlightMesh(ledGreen, 'ers');

    const ledAmber = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 1.0 })
    );
    ledAmber.position.set(-0.06, 0.27, 0.29);
    internalSystemsGroup.add(ledAmber);
    registerHighlightMesh(ledAmber, 'ers');

    // ─────────────────────────────────────────────────────────────
    // G. 6-CORE INTERCOOLER (RIGHT SIDEPOD - EXACT MATCH TO IMAGE 1)
    // ─────────────────────────────────────────────────────────────
    // In Image 1: Highlighted in the right sidepod with a 2x3 matrix of 6 cooling cells!
    const icGroup = new THREE.Group();
    icGroup.position.set(-0.18, 0.22, -0.28);
    icGroup.rotation.y = 0.12;
    internalSystemsGroup.add(icGroup);

    // Outer Carbon Enclosure Frame
    const icFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.20, 0.15),
      carbonIntakeMat.clone()
    );
    icGroup.add(icFrame);

    // 6 Distinct Aluminum Cooling Cell Cores (2 rows of 3 cores)
    const cellGeo = new THREE.BoxGeometry(0.095, 0.070, 0.11);
    const cellMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8dc,
      metalness: 0.9,
      roughness: 0.25,
      transparent: true,
      opacity: 1.0,
    });
    for (let cx = -0.11; cx <= 0.11; cx += 0.11) {
      for (let cy = -0.045; cy <= 0.045; cy += 0.09) {
        const cell = new THREE.Mesh(cellGeo, cellMat);
        cell.position.set(cx, cy, 0.018);
        icGroup.add(cell);

        // Core flow pattern lines
        const line = new THREE.Mesh(
          new THREE.BoxGeometry(0.09, 0.006, 0.112),
          new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.95, transparent: true, opacity: 1.0 })
        );
        line.position.set(cx, cy, 0.018);
        icGroup.add(line);
      }
    }
    registerHighlightGroup(icGroup, 'cooling');

    // ─────────────────────────────────────────────────────────────
    // H. LEFT SIDEPOD WATER/OIL RADIATOR (For balance & engine cooling)
    // ─────────────────────────────────────────────────────────────
    const leftRadGeo = new THREE.BoxGeometry(0.44, 0.20, 0.06);
    const leftRad = new THREE.Mesh(leftRadGeo, cellMat.clone());
    leftRad.position.set(-0.06, 0.22, 0.32);
    leftRad.rotation.set(0.10, 0.20, -0.04);
    internalSystemsGroup.add(leftRad);
    registerHighlightMesh(leftRad, 'cooling');

    const radHeader = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.46),
      camCoverMat.clone()
    );
    radHeader.rotation.z = Math.PI / 2;
    radHeader.position.set(-0.06, 0.32, 0.32);
    internalSystemsGroup.add(radHeader);
    registerHighlightMesh(radHeader, 'cooling');

    // ─────────────────────────────────────────────────────────────
    // I. ENERGY FLOW CONDUITS & BOOST TUBING (COLOR CODED FROM IMAGE 1)
    // ─────────────────────────────────────────────────────────────
    // 1. Green 4 MJ / 2 MJ Max Conduit: Energy Store -> ERS Control Unit
    const esToEcuCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.16, 0.26, 0.14),
      new THREE.Vector3(-0.16, 0.27, 0.20),
      new THREE.Vector3(-0.16, 0.25, 0.25),
    ]);
    const esToEcuMesh = new THREE.Mesh(new THREE.TubeGeometry(esToEcuCurve, 16, 0.014, 10, false), greenEnergyLineMat.clone());
    internalSystemsGroup.add(esToEcuMesh);
    registerHighlightMesh(esToEcuMesh, 'ers');

    // 2. Green Conduit: ERS Control Unit -> MGU-K
    const ecuToMgukCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.19, 0.23, 0.25),
      new THREE.Vector3(-0.32, 0.20, 0.23),
      new THREE.Vector3(-0.43, 0.17, 0.19),
    ]);
    const ecuToMgukMesh = new THREE.Mesh(new THREE.TubeGeometry(ecuToMgukCurve, 18, 0.014, 10, false), greenEnergyLineMat.clone());
    internalSystemsGroup.add(ecuToMgukMesh);
    registerHighlightMesh(ecuToMgukMesh, 'ers');

    // 3. Orange High-Voltage Conduit: ERS Control Unit -> MGU-H (E-Turbo)
    const ecuToMguhCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.21, 0.25, 0.23),
      new THREE.Vector3(-0.35, 0.26, 0.14),
      new THREE.Vector3(-0.46, 0.26, 0.05),
    ]);
    const ecuToMguhMesh = new THREE.Mesh(new THREE.TubeGeometry(ecuToMguhCurve, 18, 0.014, 10, false), orangeHvLineMat.clone());
    internalSystemsGroup.add(ecuToMguhMesh);
    registerHighlightMesh(ecuToMguhMesh, 'ers');

    // 4. Blue Air Intake Duct: Compressor -> Intercooler (Charge Air Boost Pipe)
    const compToIcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.74, 0.25, -0.05),
      new THREE.Vector3(-0.52, 0.22, -0.18),
      new THREE.Vector3(-0.34, 0.22, -0.26),
    ]);
    const compToIcMesh = new THREE.Mesh(new THREE.TubeGeometry(compToIcCurve, 20, 0.020, 12, false), blueAeroPipeMat.clone());
    internalSystemsGroup.add(compToIcMesh);
    registerHighlightMesh(compToIcMesh, 'cooling');

    // 5. Cooled Intake Pipe: Intercooler -> V6 Intake Plenum
    const icToPlenumCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.12, 0.25, -0.26),
      new THREE.Vector3(-0.25, 0.30, -0.16),
      new THREE.Vector3(-0.42, 0.32, -0.05),
    ]);
    const icToPlenumMesh = new THREE.Mesh(new THREE.TubeGeometry(icToPlenumCurve, 20, 0.020, 12, false), blueAeroPipeMat.clone());
    internalSystemsGroup.add(icToPlenumMesh);
    registerHighlightMesh(icToPlenumMesh, 'cooling');

    // ── 5. SOLID TYRES (AUTHENTIC PIRELLI 18-INCH LINEUP WITH BBS FORGED WHEELS) ──
    const proceduralTyresGroup = new THREE.Group();
    carRoot.add(proceduralTyresGroup);
    proceduralTyresGroupRef.current = proceduralTyresGroup;
    tyreWheelInstancesRef.current = [];

    // Realistic BBS motion blur texture shared across all 4 wheels
    const bbsBlurTex = createBBSMotionBlurTexture();

    const createRotatingSolidTyre = (radius: number, width: number, x: number, y: number, z: number) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(x, y, z);

      const isLeft = z > 0;
      const outSign = isLeft ? 1 : -1; // Outward face direction along Z
      const isRear = x < 0;

      // 1. STATIONARY BRAKE UPRIGHT & CALIPER (Anchored to chassis/hub upright, does NOT rotate)
      const brakeUpright = new THREE.Group();
      wheelGroup.add(brakeUpright);

      // Carbon brake cooling duct shroud
      const ductMat = new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.65, metalness: 0.5 });
      const ductMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, width * 0.42), ductMat);
      ductMesh.position.set(0.08, 0.04, -outSign * (width * 0.18));
      brakeUpright.add(ductMesh);

      // Brembo Monobloc Caliper (anodized racing gold/titanium)
      const caliperMat = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        metalness: 0.94,
        roughness: 0.22,
      });
      const caliperMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, width * 0.34), caliperMat);
      const caliperAngle = Math.PI * 0.24; // Upper forward angle
      caliperMesh.position.set(
        Math.cos(caliperAngle) * (radius * 0.54),
        Math.sin(caliperAngle) * (radius * 0.54),
        outSign * (width * 0.10)
      );
      caliperMesh.rotation.z = caliperAngle;
      brakeUpright.add(caliperMesh);

      // Red Brembo racing badge
      const bremboBadge = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.02, 0.005),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.8 })
      );
      bremboBadge.position.set(
        Math.cos(caliperAngle) * (radius * 0.54),
        Math.sin(caliperAngle) * (radius * 0.54),
        outSign * (width * 0.10 + width * 0.17 + 0.003)
      );
      bremboBadge.rotation.z = caliperAngle;
      brakeUpright.add(bremboBadge);

      // 2. ROTATING WHEEL & TYRE ASSEMBLY (Spins dynamically around local Z axis)
      const rotatingHub = new THREE.Group();
      rotatingHub.userData = { radius, isRear };
      wheelGroup.add(rotatingHub);
      rotatingWheels.push(rotatingHub);

      // A. PROCEDURAL TYRE CONTACT PATCH WITH BUMP MAPPING (Shared Cached Textures)
      const texSet = getCompoundTextures(tyreCompound);
      const treadMap = isRear ? texSet.rearTread : texSet.frontTread;
      const bumpMap = isRear ? texSet.rearBump : texSet.frontBump;
      const sidewallMap = isRear
        ? isLeft
          ? texSet.rearSidewallLeft
          : texSet.rearSidewallRight
        : isLeft
        ? texSet.frontSidewallLeft
        : texSet.frontSidewallRight;

      const wheelTyreMat = new THREE.MeshStandardMaterial({
        color: 0x14161a,
        map: treadMap,
        bumpMap: bumpMap,
        bumpScale: texSet.bumpScale,
        roughness: tyreCompound === 'INTER' || tyreCompound === 'WET' ? 0.70 : 0.88,
        metalness: 0.12,
      });

      // Main tyre rubber cylinder
      const tyreGeo = new THREE.CylinderGeometry(radius, radius, width, 48);
      tyreGeo.rotateX(Math.PI / 2);
      const tyreMesh = new THREE.Mesh(tyreGeo, wheelTyreMat);
      tyreMesh.castShadow = true;
      rotatingHub.add(tyreMesh);

      // Rounded Tyre Shoulder Rings (Outer & Inner edges)
      const shoulderGeo = new THREE.TorusGeometry(radius - 0.018, 0.018, 12, 36);
      const outerShoulder = new THREE.Mesh(shoulderGeo, wheelTyreMat.clone());
      outerShoulder.position.z = width / 2;
      rotatingHub.add(outerShoulder);
      const innerShoulder = new THREE.Mesh(shoulderGeo, wheelTyreMat.clone());
      innerShoulder.position.z = -width / 2;
      rotatingHub.add(innerShoulder);

      // B. Rotating Ventilated Carbon-Carbon Brake Rotor Disc
      const rotorGeo = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, 0.025, 24);
      rotorGeo.rotateX(Math.PI / 2);
      const rotorMat = new THREE.MeshStandardMaterial({
        color: 0x272c36,
        roughness: 0.5,
        metalness: 0.65,
        emissive: 0x000000,
      });
      const rotorMesh = new THREE.Mesh(rotorGeo, rotorMat);
      rotorMesh.position.z = outSign * (width * 0.10);
      rotorMesh.castShadow = true;
      rotatingHub.add(rotorMesh);
      brakeRotorsRef.current.push(rotorMesh);

      // Rotor Titanium Bell / Hat
      const hatGeo = new THREE.CylinderGeometry(radius * 0.25, radius * 0.25, 0.035, 18);
      hatGeo.rotateX(Math.PI / 2);
      const hatMesh = new THREE.Mesh(hatGeo, new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.9, roughness: 0.25 }));
      hatMesh.position.z = outSign * (width * 0.11);
      rotatingHub.add(hatMesh);

      // C. 18-INCH FORGED BBS CONCAVE WHEEL RIM (Gloss Black matching reference photo)
      const bbsBlackMat = new THREE.MeshStandardMaterial({
        color: 0x090a0d,
        metalness: 0.90,
        roughness: 0.18,
      });

      const rimOuterR = radius * 0.58;
      const hubRadius = radius * 0.22;
      const rimGeo = new THREE.CylinderGeometry(rimOuterR, rimOuterR, width * 0.88, 36);
      rimGeo.rotateX(Math.PI / 2);
      const rimMesh = new THREE.Mesh(rimGeo, bbsBlackMat);
      rotatingHub.add(rimMesh);

      // Outer Rim Flange Lip
      const rimLipGeo = new THREE.TorusGeometry(rimOuterR, 0.010, 12, 36);
      const rimLip = new THREE.Mesh(rimLipGeo, bbsBlackMat);
      rimLip.position.z = outSign * (width / 2);
      rotatingHub.add(rimLip);

      // Recessed Center Hub Bore (creates the deep concave dish)
      const centerHubGeo = new THREE.CylinderGeometry(hubRadius, hubRadius, 0.038, 24);
      centerHubGeo.rotateX(Math.PI / 2);
      const centerHubMesh = new THREE.Mesh(centerHubGeo, bbsBlackMat);
      centerHubMesh.position.z = outSign * (width / 2 - 0.040);
      rotatingHub.add(centerHubMesh);

      // Central Wheel Nut (Regulation Red / Blue with titanium center pin)
      const nutColor = isLeft ? 0x2563eb : 0xdc2626;
      const nutGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.046, 6);
      nutGeo.rotateX(Math.PI / 2);
      const nutMesh = new THREE.Mesh(nutGeo, new THREE.MeshStandardMaterial({
        color: nutColor,
        metalness: 0.96,
        roughness: 0.20,
        emissive: nutColor,
        emissiveIntensity: 0.35,
      }));
      nutMesh.position.z = outSign * (width / 2 - 0.020);
      rotatingHub.add(nutMesh);

      // Center Spindle Pin
      const pinGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.052, 12);
      pinGeo.rotateX(Math.PI / 2);
      const pinMesh = new THREE.Mesh(pinGeo, new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.95, roughness: 0.1 }));
      pinMesh.position.z = outSign * (width / 2 - 0.016);
      rotatingHub.add(pinMesh);

      // E. BBS FORGED 9-PAIR SPLIT Y-SPOKES (18 SPOKES, CONCAVE DISH INTO CENTER HUB)
      const pairCount = 9;
      const spokeZOuter = outSign * (width / 2 - 0.008);
      const spokeZInner = outSign * (width / 2 - 0.040);
      const spokeLen = rimOuterR - hubRadius;
      const midR = (hubRadius + rimOuterR) / 2;
      const midZ = (spokeZInner + spokeZOuter) / 2;
      const slopeAngle = Math.atan2((width / 2 - 0.008) - (width / 2 - 0.040), spokeLen);

      for (let p = 0; p < pairCount; p++) {
        const baseAngle = p * ((Math.PI * 2) / pairCount);
        [-0.046, 0.046].forEach((offsetAngle) => {
          const spokeAngle = baseAngle + offsetAngle;
          const spokeGeo = new THREE.BoxGeometry(0.013, spokeLen, 0.014);
          const spokeMesh = new THREE.Mesh(spokeGeo, bbsBlackMat);
          spokeMesh.position.set(
            Math.sin(spokeAngle) * midR,
            Math.cos(spokeAngle) * midR,
            midZ
          );
          spokeMesh.rotation.z = -spokeAngle;
          spokeMesh.rotation.x = outSign * Math.cos(spokeAngle) * slopeAngle;
          spokeMesh.rotation.y = -outSign * Math.sin(spokeAngle) * slopeAngle;
          rotatingHub.add(spokeMesh);
        });

        // BBS spoke base gusset reinforcement at hub
        const gussetGeo = new THREE.BoxGeometry(0.024, 0.018, 0.012);
        const gussetMesh = new THREE.Mesh(gussetGeo, bbsBlackMat);
        const rootR = hubRadius + 0.016;
        gussetMesh.position.set(
          Math.sin(baseAngle) * rootR,
          Math.cos(baseAngle) * rootR,
          spokeZInner + outSign * 0.006
        );
        gussetMesh.rotation.z = -baseAngle;
        rotatingHub.add(gussetMesh);
      }

      // F. PIRETTI P-CORSA / CINTURATO HIGH-RESOLUTION PROCEDURAL SIDEWALL TEXTURE
      const sidewallGeo = new THREE.RingGeometry(rimOuterR, radius, 48);
      const sidewallMat = new THREE.MeshStandardMaterial({
        map: sidewallMap,
        roughness: 0.82,
        metalness: 0.12,
        side: THREE.DoubleSide,
      });

      // Outer sidewall facing outward
      const outerSidewall = new THREE.Mesh(sidewallGeo, sidewallMat);
      outerSidewall.position.z = outSign * (width / 2 + 0.003);
      if (!isLeft) outerSidewall.rotation.y = Math.PI;
      rotatingHub.add(outerSidewall);

      tyreWheelInstancesRef.current.push({
        tyreMesh,
        outerShoulder,
        innerShoulder,
        sidewallMesh: outerSidewall,
        isRear,
        isLeft,
      });

      // G. High-Speed Wheel Rim Aerodynamic Motion Blur Disk (opacity dynamically scales with velocity)
      const blurRingGeo = new THREE.RingGeometry(radius * 0.20, rimOuterR - 0.012, 32);
      const blurRingMat = new THREE.MeshBasicMaterial({
        map: bbsBlurTex,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const blurRingMesh = new THREE.Mesh(blurRingGeo, blurRingMat);
      blurRingMesh.position.z = outSign * (width / 2 + 0.002);
      if (!isLeft) blurRingMesh.rotation.y = Math.PI;
      rotatingHub.add(blurRingMesh);
      blurRingsRef.current.push(blurRingMesh);

      registerHighlightGroup(wheelGroup, 'tyres');
      return wheelGroup;
    };

    // Front: 305mm (x: 1.65, y: 0.35, z: ±0.84)
    const frontL = createRotatingSolidTyre(0.35, 0.34, 1.65, 0.35, 0.84);
    const frontR = createRotatingSolidTyre(0.35, 0.34, 1.65, 0.35, -0.84);
    proceduralTyresGroup.add(frontL);
    proceduralTyresGroup.add(frontR);
    frontWheelGroupsRef.current = [frontL, frontR];

    // Rear: 405mm (x: -1.25, y: 0.38, z: ±0.88)
    const rearL = createRotatingSolidTyre(0.38, 0.44, -1.25, 0.38, 0.88);
    const rearR = createRotatingSolidTyre(0.38, 0.44, -1.25, 0.38, -0.88);
    proceduralTyresGroup.add(rearL);
    proceduralTyresGroup.add(rearR);

    // Register 4 Wheels with Outward Lateral Explosion Vectors
    explodedParts.push({
      mesh: frontL,
      basePos: frontL.position.clone(),
      explodeDir: new THREE.Vector3(0.6, 0.05, 1.8),
    });
    explodedParts.push({
      mesh: frontR,
      basePos: frontR.position.clone(),
      explodeDir: new THREE.Vector3(0.6, 0.05, -1.8),
    });
    explodedParts.push({
      mesh: rearL,
      basePos: rearL.position.clone(),
      explodeDir: new THREE.Vector3(-0.8, 0.05, 1.9),
    });
    explodedParts.push({
      mesh: rearR,
      basePos: rearR.position.clone(),
      explodeDir: new THREE.Vector3(-0.8, 0.05, -1.9),
    });

    // ── 5B. PROCEDURAL MAIN CHASSIS SUBDIVISIONS (MULTI-PANEL AERODYNAMIC DISASSEMBLY) ──
    const chassisSubdivisionsGroup = new THREE.Group();
    carRoot.add(chassisSubdivisionsGroup);

    const addChassisPiece = (
      geo: THREE.BufferGeometry,
      pos: [number, number, number],
      rot: [number, number, number],
      subTag: string,
      isKey: boolean,
      explodeVec: THREE.Vector3
    ) => {
      const pMesh = new THREE.Mesh(geo, transparentBodyMat.clone());
      pMesh.position.set(...pos);
      pMesh.rotation.set(...rot);
      pMesh.castShadow = true;
      pMesh.receiveShadow = true;
      pMesh.userData.subsystem = subTag;
      pMesh.userData.isKeyHighlight = isKey;
      bodyMeshesRef.current.push(pMesh);
      registerHighlightMesh(pMesh, subTag);
      chassisSubdivisionsGroup.add(pMesh);

      try {
        const edges = new THREE.EdgesGeometry(geo);
        const isSolidMode = bodyOpacityRef.current >= 0.70;
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({
            color: isSolidMode ? (isKey ? 0x38bdf8 : 0x0284c7) : 0x00d2be,
            transparent: true,
            opacity: isSolidMode ? (isKey ? 0.96 : 0.35) : 0.55,
          })
        );
        line.userData.subsystem = subTag;
        line.userData.isKeyHighlight = isKey;
        pMesh.add(line);
        bodyEdgesRef.current.push(line);
      } catch {}

      explodedParts.push({
        mesh: pMesh,
        basePos: pMesh.position.clone(),
        explodeDir: explodeVec,
      });
    };

    // 1. Cockpit Monocoque / Driver Survival Cell (Upward +Y, Forward +X)
    addChassisPiece(new THREE.BoxGeometry(0.72, 0.36, 0.44), [0.18, 0.38, 0], [0, 0, 0], 'cockpit', true, new THREE.Vector3(0.15, 1.4, 0));
    // 2. Cockpit Coaming & Headrest Rim (Skyward +Y)
    addChassisPiece(new THREE.CylinderGeometry(0.24, 0.26, 0.12, 16, 1, false, 0, Math.PI), [0.05, 0.52, 0], [0, 0, Math.PI / 2], 'cockpit', true, new THREE.Vector3(0.2, 1.9, 0));
    // 3. Forward Monocoque Bulkhead & Master Cylinder Access (Forward +X, Upward +Y)
    addChassisPiece(new THREE.BoxGeometry(0.55, 0.28, 0.34), [0.85, 0.34, 0], [0, 0, 0], 'nose', true, new THREE.Vector3(1.3, 0.5, 0));
    // 4. Nosecone Vanity Aerodynamic Deck (Far Forward +X, Upward +Y)
    addChassisPiece(new THREE.ConeGeometry(0.18, 0.65, 12), [1.45, 0.36, 0], [0, 0, -Math.PI / 2], 'nose', true, new THREE.Vector3(2.2, 0.55, 0));
    // 5. Left Sidepod Upper Louvered Cooling Deck (Outward Left +Z, Upward +Y)
    addChassisPiece(new THREE.BoxGeometry(0.85, 0.24, 0.26), [-0.15, 0.35, 0.48], [0, 0, 0], 'sidepods', true, new THREE.Vector3(-0.25, 0.85, 2.6));
    // 6. Right Sidepod Upper Louvered Cooling Deck (Outward Right -Z, Upward +Y)
    addChassisPiece(new THREE.BoxGeometry(0.85, 0.24, 0.26), [-0.15, 0.35, -0.48], [0, 0, 0], 'sidepods', true, new THREE.Vector3(-0.25, 0.85, -2.6));
    // 7. Left Undercut Radiator Intake Duct & Outer Fence (Outward Left +Z, Groundward -Y)
    addChassisPiece(new THREE.BoxGeometry(0.45, 0.20, 0.22), [0.28, 0.22, 0.42], [0, 0, 0], 'sidepods', true, new THREE.Vector3(0.3, -0.45, 2.2));
    // 8. Right Undercut Radiator Intake Duct & Outer Fence (Outward Right -Z, Groundward -Y)
    addChassisPiece(new THREE.BoxGeometry(0.45, 0.20, 0.22), [0.28, 0.22, -0.42], [0, 0, 0], 'sidepods', true, new THREE.Vector3(0.3, -0.45, -2.2));
    // 9. Overhead Airbox Intake Scoop & Roll Hoop Structural Ring (Extreme Skyward +Y)
    addChassisPiece(new THREE.TorusGeometry(0.12, 0.04, 12, 24), [-0.35, 0.72, 0], [0, Math.PI / 2, 0], 'chassis', true, new THREE.Vector3(-0.35, 3.1, 0));
    // 10. Dorsal Shark Fin Aerodynamic Fin Blade (High Skyward +Y, Rearward -X)
    addChassisPiece(new THREE.BoxGeometry(0.75, 0.26, 0.02), [-0.85, 0.62, 0], [0, 0, 0], 'rearwing', true, new THREE.Vector3(-0.85, 2.6, 0));
    // 11. Left Engine Cover Flank & Coke-Bottle Shoulder (Rearward -X, Upward +Y, Left +Z)
    addChassisPiece(new THREE.BoxGeometry(0.65, 0.22, 0.18), [-0.75, 0.38, 0.30], [0, 0, 0], 'chassis', false, new THREE.Vector3(-0.85, 1.15, 1.7));
    // 12. Right Engine Cover Flank & Coke-Bottle Shoulder (Rearward -X, Upward +Y, Right -Z)
    addChassisPiece(new THREE.BoxGeometry(0.65, 0.22, 0.18), [-0.75, 0.38, -0.30], [0, 0, 0], 'chassis', false, new THREE.Vector3(-0.85, 1.15, -1.7));
    // 13. Underfloor Central Titanium Skid Plank (Extreme Groundward -Y)
    addChassisPiece(new THREE.BoxGeometry(1.60, 0.015, 0.28), [-0.1, 0.04, 0], [0, 0, 0], 'chassis', true, new THREE.Vector3(-0.1, -2.2, 0));
    // 14. Left Venturi Ground-Effect Channel & Step Plane (Groundward -Y, Left +Z)
    addChassisPiece(new THREE.BoxGeometry(1.30, 0.025, 0.38), [-0.25, 0.07, 0.48], [0, 0, 0], 'chassis', true, new THREE.Vector3(-0.25, -1.7, 1.3));
    // 15. Right Venturi Ground-Effect Channel & Step Plane (Groundward -Y, Right -Z)
    addChassisPiece(new THREE.BoxGeometry(1.30, 0.025, 0.38), [-0.25, 0.07, -0.48], [0, 0, 0], 'chassis', true, new THREE.Vector3(-0.25, -1.7, -1.3));
    // 16. Rear Diffuser Multi-channel Expansion Chamber & Strakes (Groundward -Y, Rearward -X)
    addChassisPiece(new THREE.BoxGeometry(0.60, 0.18, 0.65), [-1.35, 0.14, 0], [0, 0, 0], 'rearwing', true, new THREE.Vector3(-1.4, -1.9, 0));
    // 17. Lower Beam Wing Aerodynamic Flap (Rearward -X, Upward +Y)
    addChassisPiece(new THREE.BoxGeometry(0.35, 0.03, 0.68), [-1.65, 0.32, 0], [0, 0, 0], 'rearwing', true, new THREE.Vector3(-2.3, 0.25, 0));
    // 18. Rear Impact Crash Attenuator & FIA Rain Light Pod (Extreme Rearward -X)
    addChassisPiece(new THREE.BoxGeometry(0.32, 0.12, 0.16), [-1.82, 0.25, 0], [0, 0, 0], 'rearwing', true, new THREE.Vector3(-2.6, -0.15, 0));

    // DRS Upper Wing Flap (Articulates during Overtake surge)
    const drsFlap = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.025, 0.76),
      new THREE.MeshPhysicalMaterial({ color: 0xd90429, metalness: 0.85, roughness: 0.18 })
    );
    drsFlap.position.set(-1.72, 0.88, 0);
    carRoot.add(drsFlap);
    drsFlapMeshRef.current = drsFlap;

    // ── 5C. PROCEDURAL RIVAL CAR HIERARCHY (ERS Tactical Overtake Battle) ──
    const buildRivalCar = () => {
      if (!rivalCarRoot) return;

      // Rival Livery Materials: Stealth Obsidian Carbon with Electric Cyan & Amber Gold Trim
      const rivalBodyMat = new THREE.MeshStandardMaterial({
        color: 0x0f141d,
        roughness: 0.22,
        metalness: 0.88,
      });
      const rivalCyanMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        roughness: 0.15,
        metalness: 0.75,
        emissive: 0x004455,
        emissiveIntensity: 0.45,
      });
      const rivalGoldMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.18,
        metalness: 0.85,
      });

      // Monocoque Tub
      const tub = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.38, 0.52), rivalBodyMat);
      tub.position.set(0.2, 0.34, 0);
      tub.castShadow = true;
      rivalCarRoot.add(tub);

      // Nosecone
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.35, 16), rivalBodyMat);
      nose.rotation.z = -Math.PI / 2;
      nose.position.set(1.65, 0.34, 0);
      nose.castShadow = true;
      rivalCarRoot.add(nose);

      // Front Wing Mainplane & Endplates
      const fwMain = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 1.8), rivalCyanMat);
      fwMain.position.set(2.25, 0.18, 0);
      fwMain.castShadow = true;
      rivalCarRoot.add(fwMain);

      const fwEndL = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.24, 0.02), rivalGoldMat);
      fwEndL.position.set(2.25, 0.26, 0.90);
      rivalCarRoot.add(fwEndL);

      const fwEndR = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.24, 0.02), rivalGoldMat);
      fwEndR.position.set(2.25, 0.26, -0.90);
      rivalCarRoot.add(fwEndR);

      // Titanium Halo
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 12, 24, Math.PI), rivalGoldMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.set(0.15, 0.62, 0);
      rivalCarRoot.add(halo);

      // Driver Helmet
      const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xffdd00, roughness: 0.15, metalness: 0.6 })
      );
      helmet.position.set(0.05, 0.52, 0);
      rivalCarRoot.add(helmet);

      // Sidepods Left & Right
      const podL = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 0.34), rivalBodyMat);
      podL.position.set(-0.25, 0.28, 0.44);
      podL.castShadow = true;
      rivalCarRoot.add(podL);

      const podR = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 0.34), rivalBodyMat);
      podR.position.set(-0.25, 0.28, -0.44);
      podR.castShadow = true;
      rivalCarRoot.add(podR);

      // Engine Cover & Dorsal Shark Fin
      const engCover = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.24), rivalBodyMat);
      engCover.position.set(-0.75, 0.45, 0);
      engCover.castShadow = true;
      rivalCarRoot.add(engCover);

      const sharkFin = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.28, 0.02), rivalCyanMat);
      sharkFin.position.set(-0.85, 0.68, 0);
      rivalCarRoot.add(sharkFin);

      // Rear Wing
      const rwMain = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 1.45), rivalCyanMat);
      rwMain.position.set(-1.85, 0.88, 0);
      rwMain.castShadow = true;
      rivalCarRoot.add(rwMain);

      const rwPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.04), rivalBodyMat);
      rwPillarL.position.set(-1.65, 0.65, 0.22);
      rivalCarRoot.add(rwPillarL);

      const rwPillarR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.04), rivalBodyMat);
      rwPillarR.position.set(-1.65, 0.65, -0.22);
      rivalCarRoot.add(rwPillarR);

      // Flashing Rear Rain Light
      const rainLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.06, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xff0022, transparent: true, opacity: 1.0 })
      );
      rainLight.position.set(-1.95, 0.25, 0);
      rivalCarRoot.add(rainLight);
      rivalRainLightRef.current = rainLight;

      // 4 Wheels for Rival Car
      const createRivalWheel = (radius: number, width: number, x: number, y: number, z: number) => {
        const wGroup = new THREE.Group();
        wGroup.position.set(x, y, z);
        wGroup.userData = { radius };

        const tyre = new THREE.Mesh(
          new THREE.CylinderGeometry(radius, radius, width, 28),
          new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.85 })
        );
        tyre.rotation.x = Math.PI / 2;
        tyre.castShadow = true;
        wGroup.add(tyre);

        const rim = new THREE.Mesh(
          new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 1.02, 18),
          new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.25, metalness: 0.9 })
        );
        rim.rotation.x = Math.PI / 2;
        wGroup.add(rim);

        rivalCarRoot.add(wGroup);
        rivalWheelsRef.current.push(wGroup);
        return wGroup;
      };

      createRivalWheel(0.35, 0.34, 1.65, 0.35, 0.84);
      createRivalWheel(0.35, 0.34, 1.65, 0.35, -0.84);
      createRivalWheel(0.38, 0.44, -1.25, 0.38, 0.88);
      createRivalWheel(0.38, 0.44, -1.25, 0.38, -0.88);
    };

    buildRivalCar();

    // ── 6. LOAD FERRARI SF-25 GLB & FINE-GRAINED DISASSEMBLY ──────────
    const loader = new GLTFLoader();
    setLoadingProgress(10);

    loader.load(
      ferrariGlbUrl,
      (gltf) => {
        setLoadingProgress(100);
        setTimeout(() => setLoadingProgress(null), 500);
        setGlbLoaded(true);

        const glbModel = gltf.scene;

        const box = new THREE.Box3().setFromObject(glbModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Center Model at origin & align to floor
        glbModel.position.x -= center.x;
        glbModel.position.y -= box.min.y;
        glbModel.position.z -= center.z;

        // Auto-scale to standard F1 length (~5.2m along longest axis)
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const targetScale = 5.2 / maxDim;
          glbModel.scale.setScalar(targetScale);
        }

        // Align Ferrari SF-25 so nose faces forward along +X
        glbModel.rotation.y = Math.PI / 2;
        carRoot.add(glbModel);

        // Clone for Rival Car with contrasting stealth Oracle livery
        try {
          const rivalGlb = glbModel.clone(true);
          rivalGlb.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const m = child as THREE.Mesh;
              m.castShadow = false;
              m.receiveShadow = false;
              const n = (m.name || '').toLowerCase();
              if (
                n.includes('tire') || n.includes('tyre') || n.includes('wheel') ||
                n.includes('rim') || n.includes('pirelli') || n.includes('rubber')
              ) {
                m.visible = false;
                return;
              }
              if (m.material instanceof THREE.Material) {
                m.material = m.material.clone();
                if ('color' in m.material) {
                  const origColor = (m.material as any).color as THREE.Color;
                  if (origColor && (origColor.r > origColor.b * 1.3 || origColor.getHex() === 0xd90429)) {
                    (m.material as any).color.setHex(0x0e131d); // Stealth matte obsidian
                    if ('metalness' in m.material) (m.material as any).metalness = 0.88;
                    if ('roughness' in m.material) (m.material as any).roughness = 0.22;
                  }
                }
              }
            }
          });
          if (rivalCarRootRef.current) {
            rivalCarRootRef.current.add(rivalGlb);
          }
        } catch (err) {
          console.warn('Rival GLB clone error:', err);
        }

        // Crucial: Update matrix world so all world transforms, bounding boxes & positions are 100% accurate!
        carRoot.updateMatrixWorld(true);

        // Gather all candidate meshes
        const candidateMeshes: THREE.Mesh[] = [];
        glbModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            candidateMeshes.push(child as THREE.Mesh);
          }
        });

        // 1. Filter out GLB wheels/tyres so our realistic rotating solid wheels take their place
        candidateMeshes.forEach((mesh) => {
          const name = (mesh.name || '').toLowerCase();
          const matName = (mesh.material && 'name' in mesh.material ? (mesh.material as THREE.Material).name : '').toLowerCase();

          const isTyreOrWheel =
            name.includes('tire') || name.includes('tyre') || name.includes('wheel') ||
            name.includes('rim') || name.includes('pirelli') || name.includes('rubber') ||
            name.includes('caliper') || name.includes('disc') ||
            matName.includes('tire') || matName.includes('tyre') || matName.includes('wheel') ||
            matName.includes('rim') || matName.includes('pirelli') || matName.includes('rubber');

          if (isTyreOrWheel) {
            mesh.visible = false;
          }
        });

        // 2. DEDUPLICATION & BODY SUBDIVISION:
        // In ferrari_sf25.glb, there is both a monolithic body hull and fine-grained sub-components,
        // or parent meshes containing child meshes.
        // Hiding the duplicate monolithic full-body mesh fixes "two body pops up" and leaves only the smaller sensible parts!
        const validBodyMeshes: THREE.Mesh[] = [];

        candidateMeshes.forEach((mesh) => {
          if (!mesh.visible) return;

          // Compute world bounding box
          const meshWorldBox = new THREE.Box3().setFromObject(mesh);
          const meshSize = meshWorldBox.getSize(new THREE.Vector3());

          // Monolithic full-body meshes span length > 3.4m and width > 1.1m
          const isMonolithicFullBody = meshSize.x > 3.4 && meshSize.z > 1.1;

          // Also avoid parent meshes that have child meshes to prevent double-translation
          const hasMeshChildren = mesh.children.some((c) => (c as THREE.Mesh).isMesh);

          if (isMonolithicFullBody || hasMeshChildren) {
            mesh.visible = false;
            return;
          }

          validBodyMeshes.push(mesh);
        });

        // Spatial Deduplication: Suppress meshes with identical centers and sizes (refined to 5mm to keep fine aero tiers)
        const keptMeshes: THREE.Mesh[] = [];
        validBodyMeshes.forEach((mesh) => {
          const meshBox = new THREE.Box3().setFromObject(mesh);
          const meshCenter = meshBox.getCenter(new THREE.Vector3());
          const meshSize = meshBox.getSize(new THREE.Vector3());

          const isDuplicate = keptMeshes.some((existing) => {
            const eBox = new THREE.Box3().setFromObject(existing);
            const eCenter = eBox.getCenter(new THREE.Vector3());
            const eSize = eBox.getSize(new THREE.Vector3());
            return (
              meshCenter.distanceTo(eCenter) < 0.005 &&
              Math.abs(meshSize.x - eSize.x) < 0.005 &&
              Math.abs(meshSize.y - eSize.y) < 0.005 &&
              Math.abs(meshSize.z - eSize.z) < 0.005
            );
          });

          if (isDuplicate) {
            mesh.visible = false;
          } else {
            keptMeshes.push(mesh);
          }
        });

        // 3. Configure Transparent Holographic Material & Calculate Exact Explode Vectors
        keptMeshes.forEach((mesh) => {
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          mesh.material = transparentBodyMat.clone();
          bodyMeshesRef.current.push(mesh);

          // Compute exact world position
          const meshWorldPos = new THREE.Vector3();
          mesh.getWorldPosition(meshWorldPos);

          const n = (mesh.name || '').toLowerCase();
          const isFrontWingOrNose = n.includes('wing') || n.includes('front') || n.includes('nose') || n.includes('fw_') || meshWorldPos.x > 1.25;
          const isHaloOrCockpit = n.includes('halo') || n.includes('cockpit') || (meshWorldPos.y > 0.42 && Math.abs(meshWorldPos.z) < 0.38 && meshWorldPos.x > -0.25 && meshWorldPos.x < 0.65);
          const isRearWingOrFin = n.includes('rear') || n.includes('rw_') || n.includes('fin') || meshWorldPos.x < -1.1 || (meshWorldPos.y > 0.48 && Math.abs(meshWorldPos.z) < 0.18);
          const isSidepodAirpod = n.includes('sidepod') || n.includes('radiator') || (meshWorldPos.x > 0.1 && meshWorldPos.x < 1.1 && Math.abs(meshWorldPos.z) > 0.35);

          let subTag = 'chassis';
          if (isFrontWingOrNose) subTag = 'nose';
          else if (isHaloOrCockpit) subTag = 'cockpit';
          else if (isRearWingOrFin) subTag = 'rearwing';
          else if (isSidepodAirpod) subTag = 'sidepods';

          const isKeyHighlight = isFrontWingOrNose || isHaloOrCockpit || isRearWingOrFin || isSidepodAirpod;
          mesh.userData.subsystem = subTag;
          mesh.userData.isKeyHighlight = isKeyHighlight;
          registerHighlightMesh(mesh, subTag);

          // Add holographic edge wireframe only to key exterior aerodynamic contours to keep draw calls ultra-low
          if (isKeyHighlight) {
            try {
              const edges = new THREE.EdgesGeometry(mesh.geometry);
              const isSolidMode = bodyOpacityRef.current >= 0.70;
              const line = new THREE.LineSegments(
                edges,
                new THREE.LineBasicMaterial({
                  color: isSolidMode ? 0x38bdf8 : 0x00d2be,
                  transparent: true,
                  opacity: isSolidMode ? 0.96 : 0.55,
                })
              );
              line.userData.subsystem = subTag;
              line.userData.isKeyHighlight = isKeyHighlight;
              mesh.add(line);
              bodyEdgesRef.current.push(line);
            } catch {
              // Ignore unsupported geometry
            }
          }

          // Get sensible aerodynamic explosion vector
          const worldExplodeDir = calculateFineExplodeVector(
            meshWorldPos.x,
            meshWorldPos.y,
            meshWorldPos.z,
            mesh.name || ''
          );

          // Convert world explosion direction into mesh parent's local space
          let localExplodeDir = worldExplodeDir.clone();
          if (mesh.parent) {
            mesh.parent.updateWorldMatrix(true, false);
            const invMatrix = new THREE.Matrix4().copy(mesh.parent.matrixWorld).invert();
            localExplodeDir = worldExplodeDir.clone().transformDirection(invMatrix).multiplyScalar(worldExplodeDir.length());
          }

          explodedParts.push({
            mesh,
            basePos: mesh.position.clone(),
            explodeDir: localExplodeDir,
          });
        });

        explodedPartsRef.current = explodedParts;
        if (explodedRatioRef.current > 0) {
          const ratio = explodedRatioRef.current;
          explodedParts.forEach(({ mesh, basePos, explodeDir }) => {
            mesh.position.set(
              basePos.x + explodeDir.x * ratio,
              basePos.y + explodeDir.y * ratio,
              basePos.z + explodeDir.z * ratio
            );
          });
        }
      },
      (xhr) => {
        if (xhr.total > 0) {
          setLoadingProgress(Math.round((xhr.loaded / xhr.total) * 100));
        }
      },
      (err) => {
        console.warn('GLB load error or fallback needed:', err);
        setLoadingProgress(null);
      }
    );

    explodedPartsRef.current = explodedParts;
    rotatingWheelsRef.current = rotatingWheels;

    // ── 7. HIGH-SPEED REALISTIC ANIMATION & DYNAMICS LOOP ───────────
    const clock = new THREE.Clock();
    let frameCounter = 0;

    // Pre-allocated scratch objects to eliminate per-frame GC pressure (crucial for jitter-free 60fps)
    const _scratchColorA = new THREE.Color();
    const _scratchColorB = new THREE.Color();
    let prevFocus: SubsystemFocus | null = null;
    let prevSmoothOpacity = -1;
    let prevBrakeGlow = -1;
    let isSpotlightSettled = false;

    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05); // Clamp large lag spikes
      const elapsed = clock.getElapsedTime();
      frameCounter++;

      // 1. Kinematic Velocity Smoothing with Powertrain Inertia
      const targetKmh = isTrackMovingRef.current ? simSpeedKmhRef.current : 0;
      // F1 V6 turbo hybrid accelerates quickly, and carbon-carbon brakes stop even faster
      const dampRate = targetKmh >= smoothSpeedKmhRef.current ? 2.6 : 4.5;
      smoothSpeedKmhRef.current = THREE.MathUtils.damp(
        smoothSpeedKmhRef.current,
        targetKmh,
        dampRate,
        delta
      );
      const currentKmh = smoothSpeedKmhRef.current;
      // Physical linear speed in m/s: v = (km/h * 1000) / 3600
      const physicalSpeedMs = (currentKmh * 1000) / 3600;
      const worldSpeed = physicalSpeedMs; // 1 unit in 3D scene = 1 meter
      const speedRatio = Math.min(1.0, currentKmh / 365);

      // Distance traveled in this frame: delta_d = v * delta (meters)
      const distDelta = (isTrackMovingRef.current && currentKmh > 0.3) ? physicalSpeedMs * delta : 0;

      // Dynamic acceleration / braking rate for weight transfer
      const accelRate = (currentKmh - prevSpeedRef.current) / Math.max(delta, 0.001);
      prevSpeedRef.current = currentKmh;

      // 2. Physically Synchronized Asphalt Track & Road Markings Scrolling
      // Track plane is 120m long with 16 texture repeats (each procedural tile cycle = 7.5 meters)
      // Moving texture offset by distDelta / 7.5 locks road markings 1:1 with tyre ground contact patch!
      if (trackTextureRef.current && distDelta > 0) {
        trackTextureRef.current.offset.x = (trackTextureRef.current.offset.x + (distDelta / 7.5)) % 1.0;
      }

      // 3. Physically Synchronized Wheel & Tyre Rotation (ω = v / r) + High-Speed BBS Blur
      if (distDelta > 0) {
        rotatingWheelsRef.current.forEach((w) => {
          const r = (w.userData?.radius as number) || 0.35;
          // Angular displacement: delta_theta = delta_d / radius (radians)
          w.rotation.z -= distDelta / r;
        });

        // BBS Forged Alloy Rotational Motion Blur Disk:
        // 0.0 at low speeds (0–60 km/h) ensuring Pirelli sidewalls and BBS spokes remain ultra-crisp,
        // blending smoothly to 0.82 density at top speed (365 km/h)
        const blurOpacity = currentKmh > 60 
          ? Math.min(0.82, Math.pow((currentKmh - 60) / 305, 0.85) * 0.80) 
          : 0;
        blurRingsRef.current.forEach((br) => {
          if (br.material instanceof THREE.MeshBasicMaterial) {
            br.material.opacity = blurOpacity;
          }
        });

        // Subtle organic driver micro-steering corrections according to speed (locked straight on center)
        const microSteer = Math.sin(elapsed * 4.8) * 0.007 * (currentKmh > 40 ? 1 : 0);
        frontWheelGroupsRef.current.forEach((fw) => {
          fw.rotation.y = microSteer;
        });
      } else {
        // Stationary: zero blur, wheels neutral
        blurRingsRef.current.forEach((br) => {
          if (br.material instanceof THREE.MeshBasicMaterial) {
            br.material.opacity = 0;
          }
        });
        frontWheelGroupsRef.current.forEach((fw) => {
          fw.rotation.y = 0;
        });
      }

      // 4. Dynamic Carbon Brake Rotor Thermal Glow on Braking (dirty-checked for zero overhead)
      const isBraking = accelRate < -10;
      const brakeGlow = isBraking ? Math.min(1.0, Math.abs(accelRate) / 50) : 0.02;
      if (Math.abs(brakeGlow - prevBrakeGlow) > 0.01) {
        prevBrakeGlow = brakeGlow;
        brakeRotorsRef.current.forEach((br) => {
          if (br.material instanceof THREE.MeshStandardMaterial) {
            br.material.emissive.setHex(0xff3300);
            br.material.emissiveIntensity = brakeGlow * 1.2;
          }
        });
      }

      // 5. Authentic Ground-Effect Suspension Kinematics (Downforce Squat, Porpoising & Pitch Dive)
      if (carRootRef.current) {
        // Aerodynamic downforce pulls Venturi floor closer to track at high speed (scales with v^2)
        const downforceSquat = -Math.pow(speedRatio, 2) * 0.022;
        // High-frequency stiff heave oscillations active predominantly at high speed (>200 km/h)
        const microHeave = (Math.sin(elapsed * 52) * 0.0016 + Math.cos(elapsed * 29) * 0.0011) * Math.pow(speedRatio, 1.8);
        // Pitch dive on heavy braking, squat on acceleration (pure pitch along Z axis)
        const pitchSquatDive = Math.max(-0.014, Math.min(0.010, -accelRate * 0.00022));
        const roadPitch = Math.sin(elapsed * 34) * 0.0006 * speedRatio;

        // Position: vertical heave/downforce always applied.
        // Lateral Z and yaw Y are ONLY zeroed when NOT in ERS battle mode —
        // during ERS overtake those axes are controlled by the trajectory code below.
        carRootRef.current.position.y = downforceSquat + microHeave;
        const ersActive = activeFocusRef.current === 'ers' && rivalCarRootRef.current !== null;
        if (!ersActive) {
          carRootRef.current.position.z = 0;
          // Rotation: strictly zero yaw (Y) and roll (X), only subtle pitch (Z) in normal mode
          carRootRef.current.rotation.x = 0;
          carRootRef.current.rotation.y = 0;
        } else {
          carRootRef.current.rotation.x = 0;
        }
        carRootRef.current.rotation.z = roadPitch + pitchSquatDive;
      }

      // 6. CFD Aerodynamic Streamline Ribbons Physics Update
      if (particlesGeomRef.current && (isTrackMovingRef.current || currentKmh > 0.5)) {
        const posAttr = particlesGeomRef.current.getAttribute('position') as THREE.BufferAttribute;
        const pArr = posAttr.array as Float32Array;
        const isSparksOnly = aeroFlowModeRef.current === 'SPARKS';
        const isVorticesOnly = aeroFlowModeRef.current === 'VORTICES';
        const streamActive = !isSparksOnly;
        // Scales naturally: slow gentle laminar ribbons at 60 km/h, fast screaming ribbons at 340+ km/h
        const streamSpeed = isTrackMovingRef.current 
          ? (currentKmh > 1 ? Math.max(1.2, 2.0 + (currentKmh / 365) * 22.0) : 0.4) 
          : 6.0;

        for (let i = 0; i < particleCount; i++) {
          const pSpeed = streamSpeed * particleVels[i];
          pArr[i * 3] -= pSpeed * delta; // Stream backward along -X

          // In VORTICES mode, amplify rotational corkscrew dynamics on front outwash and rear wing tips
          if (isVorticesOnly && (i < 120 || i >= 360)) {
            const swirlRadius = i >= 360 ? 0.22 : 0.16;
            const swirlPhase = elapsed * 14 + i * 0.25;
            pArr[i * 3 + 1] += Math.sin(swirlPhase) * swirlRadius * delta * 4.0;
            pArr[i * 3 + 2] += Math.cos(swirlPhase) * swirlRadius * delta * 4.0;
          }

          // Domain-specific recycle and aerodynamic curvature
          if (pArr[i * 3] < -14.0) {
            if (i < 120) {
              // Front wing outwash
              pArr[i * 3] = 4.5 + Math.random() * 3.5;
              pArr[i * 3 + 1] = 0.08 + Math.random() * 0.4;
              pArr[i * 3 + 2] = (Math.random() - 0.5) * 2.0;
            } else if (i < 240) {
              // Underfloor Venturi tunnels
              pArr[i * 3] = 2.0 + Math.random() * 1.5;
              pArr[i * 3 + 1] = 0.04 + Math.random() * 0.08;
              pArr[i * 3 + 2] = (Math.random() - 0.5) * 0.85;
            } else if (i < 360) {
              // Sidepod undercut
              pArr[i * 3] = 1.6 + Math.random() * 2.0;
              pArr[i * 3 + 1] = 0.22 + Math.random() * 0.45;
              const sSign = i % 2 === 0 ? 1 : -1;
              pArr[i * 3 + 2] = sSign * (0.35 + Math.random() * 0.35);
            } else {
              // Rear wing corkscrew vortices
              pArr[i * 3] = -1.5;
              pArr[i * 3 + 1] = 0.85 + Math.sin(elapsed * 12 + i) * 0.12;
              const sSign = i % 2 === 0 ? 1 : -1;
              pArr[i * 3 + 2] = sSign * (0.70 + Math.cos(elapsed * 12 + i) * 0.12);
            }
          }
        }
        posAttr.needsUpdate = true;
      }

      // 7. Titanium Skid-Block Plank Sparks Physics
      const isSparksMode = aeroFlowModeRef.current === 'SPARKS';
      const canSpark = aeroFlowModeRef.current !== 'VORTICES' && (isSparksMode || (isTrackMovingRef.current && currentKmh > 220));
      if (sparksGeomRef.current && canSpark) {
        const sPosAttr = sparksGeomRef.current.getAttribute('position') as THREE.BufferAttribute;
        const sArr = sPosAttr.array as Float32Array;

        for (let i = 0; i < sparkCount; i++) {
          sparkLifetimes[i] += delta;
          if (sparkLifetimes[i] < sparkMaxLifetimes[i]) {
            // Apply velocities
            sArr[i * 3] += sparkVelocities[i * 3] * delta;
            sArr[i * 3 + 1] += sparkVelocities[i * 3 + 1] * delta;
            sArr[i * 3 + 2] += sparkVelocities[i * 3 + 2] * delta;

            // Gravity & Ground friction bounce
            sparkVelocities[i * 3 + 1] -= 9.8 * delta;
            if (sArr[i * 3 + 1] <= 0.01) {
              sArr[i * 3 + 1] = 0.01;
              sparkVelocities[i * 3 + 1] = -sparkVelocities[i * 3 + 1] * 0.42; // Ricochet off tarmac
              sparkVelocities[i * 3] *= 0.88; // Ground friction drag
            }
          } else if (canSpark && (isSparksMode || Math.random() < speedRatio * 0.45)) {
            // Spawn glowing incandescent spark from under the plank/diffuser
            sparkLifetimes[i] = 0;
            sparkMaxLifetimes[i] = 0.18 + Math.random() * 0.32;
            sArr[i * 3] = -0.6 - Math.random() * 0.8;    // Under chassis plank
            sArr[i * 3 + 1] = 0.02 + Math.random() * 0.02; // Close to ground
            sArr[i * 3 + 2] = (Math.random() - 0.5) * 0.28; // Plank width
            const ejectionSpeed = isTrackMovingRef.current ? (worldSpeed * 1.5 + Math.random() * 5.0) : (8.0 + Math.random() * 4.0);
            sparkVelocities[i * 3] = -ejectionSpeed; // Shoots rearward
            sparkVelocities[i * 3 + 1] = 0.7 + Math.random() * 1.8; // Upward spark bounce
            sparkVelocities[i * 3 + 2] = (Math.random() - 0.5) * 2.4; // Lateral spray
          } else {
            sArr[i * 3 + 1] = -100; // Hidden
          }
        }
        sPosAttr.needsUpdate = true;
      }

      // Subtle dynamic camera FOV dilation at high velocity for authentic optical speed sensation
      if (cameraRef.current && !isCameraTransitioningRef.current) {
        const targetFov = 42.0 + Math.pow(speedRatio, 1.6) * 3.5;
        if (Math.abs(cameraRef.current.fov - targetFov) > 0.02) {
          cameraRef.current.fov = THREE.MathUtils.lerp(cameraRef.current.fov, targetFov, delta * 3.5);
          cameraRef.current.updateProjectionMatrix();
        }
      }

      // 7b. Smooth Exploded View Mesh Decoupling (120 FPS continuous WebGL damping)
      if (explodedPartsRef.current.length > 0) {
        const targetExp = explodedRatioRef.current;
        const currentExp = smoothExplodedRatioRef.current;
        if (Math.abs(targetExp - currentExp) > 0.0003) {
          const nextExp = THREE.MathUtils.damp(currentExp, targetExp, 14.0, delta);
          smoothExplodedRatioRef.current = nextExp;
          for (let i = 0; i < explodedPartsRef.current.length; i++) {
            const part = explodedPartsRef.current[i];
            part.mesh.position.set(
              part.basePos.x + part.explodeDir.x * nextExp,
              part.basePos.y + part.explodeDir.y * nextExp,
              part.basePos.z + part.explodeDir.z * nextExp
            );
          }
        }
      }

      // 7c. Smooth Physical Bodywork Transparency Optical Interpolation
      const targetBodyOpacity = bodyOpacityRef.current;
      const currentBodyOpacity = smoothBodyOpacityRef.current;
      if (Math.abs(targetBodyOpacity - currentBodyOpacity) > 0.003) {
        const nextBodyOpacity = THREE.MathUtils.damp(currentBodyOpacity, targetBodyOpacity, 12.0, delta);
        smoothBodyOpacityRef.current = nextBodyOpacity;

        const isSolid = nextBodyOpacity >= 0.70;
        bodyMeshesRef.current.forEach((mesh) => {
          if (mesh.material instanceof THREE.MeshPhysicalMaterial) {
            mesh.material.opacity = nextBodyOpacity;
            mesh.material.roughness = THREE.MathUtils.lerp(0.06, 0.38, nextBodyOpacity);
            mesh.material.metalness = THREE.MathUtils.lerp(0.96, 0.5, nextBodyOpacity);
            mesh.material.clearcoat = THREE.MathUtils.lerp(0.08, 0.90, nextBodyOpacity);
            // Reuse scratch Color objects — avoids GC allocation every frame
            _scratchColorA.setHex(0x72aaff);
            _scratchColorB.setHex(0xd90429);
            _scratchColorA.lerp(_scratchColorB, Math.pow(nextBodyOpacity, 1.35));
            mesh.material.color.copy(_scratchColorA);

            const isKey = mesh.userData?.isKeyHighlight || mesh.userData?.subsystem === 'nose' || mesh.userData?.subsystem === 'cockpit';
            if (isSolid) {
              mesh.material.depthWrite = true;
              if (isKey) {
                mesh.material.clearcoat = 1.0;
                mesh.material.clearcoatRoughness = 0.03;
                mesh.material.roughness = 0.18;
                mesh.material.metalness = 0.65;
                mesh.material.emissive.setHex(0x0e1726);
                mesh.material.emissiveIntensity = 0.35;
              } else {
                mesh.material.clearcoat = 0.88;
                mesh.material.clearcoatRoughness = 0.08;
                mesh.material.emissive.setHex(0x000000);
                mesh.material.emissiveIntensity = 0.0;
              }
            } else {
              mesh.material.depthWrite = false;
              mesh.material.emissive.setHex(0x000000);
              mesh.material.emissiveIntensity = 0.0;
            }
          }
        });
      }

      // 8. Smooth Cinematic Broadcast Camera Glide (Exponential Damped Glide without Jitter)
      if (isCameraTransitioningRef.current && cameraRef.current && controlsRef.current) {
        const dampFactor = 8.5;
        cameraRef.current.position.x = THREE.MathUtils.damp(
          cameraRef.current.position.x,
          cameraTargetPosRef.current.x,
          dampFactor,
          delta
        );
        cameraRef.current.position.y = THREE.MathUtils.damp(
          cameraRef.current.position.y,
          cameraTargetPosRef.current.y,
          dampFactor,
          delta
        );
        cameraRef.current.position.z = THREE.MathUtils.damp(
          cameraRef.current.position.z,
          cameraTargetPosRef.current.z,
          dampFactor,
          delta
        );

        controlsRef.current.target.x = THREE.MathUtils.damp(
          controlsRef.current.target.x,
          cameraLookAtRef.current.x,
          dampFactor,
          delta
        );
        controlsRef.current.target.y = THREE.MathUtils.damp(
          controlsRef.current.target.y,
          cameraLookAtRef.current.y,
          dampFactor,
          delta
        );
        controlsRef.current.target.z = THREE.MathUtils.damp(
          controlsRef.current.target.z,
          cameraLookAtRef.current.z,
          dampFactor,
          delta
        );

        const posDist = cameraRef.current.position.distanceTo(cameraTargetPosRef.current);
        const lookDist = controlsRef.current.target.distanceTo(cameraLookAtRef.current);

        controlsRef.current.update();

        if (posDist < 0.015 && lookDist < 0.015) {
          cameraRef.current.position.copy(cameraTargetPosRef.current);
          controlsRef.current.target.copy(cameraLookAtRef.current);
          controlsRef.current.enabled = true;
          controlsRef.current.enableDamping = true;
          controlsRef.current.update();
          isCameraTransitioningRef.current = false;
        }
      }

      // 9. Ultra-smooth direct DOM telemetry update (0ms React reconciliation, zero jitter)
      if (frameCounter % 3 === 0) {
        const nextSpeedKmh = Math.round(currentKmh);
        const nextDownforce = Math.round(210 + Math.pow(speedRatio, 2) * 1740);
        const nextSuction = (2.4 + Math.pow(speedRatio, 2) * 4.2).toFixed(1);
        const nextDrag = Math.round(90 + Math.pow(speedRatio, 2) * 880);
        const nextBrake = Math.round(440 + speedRatio * 430);
        const gearStr = nextSpeedKmh <= 2
          ? 'N'
          : nextSpeedKmh < 90 ? 'G2' : nextSpeedKmh < 140 ? 'G3' : nextSpeedKmh < 195 ? 'G4' : nextSpeedKmh < 250 ? 'G5' : nextSpeedKmh < 295 ? 'G6' : nextSpeedKmh < 335 ? 'G7' : 'G8';
        const drsStr = nextSpeedKmh >= 300 ? ' • DRS' : '';

        if (liveSpeedTopRef.current) {
          liveSpeedTopRef.current.textContent = nextSpeedKmh <= 2 ? '0 KM/H (IDLE)' : `${nextSpeedKmh} KM/H`;
        }
        if (liveAeroTopRef.current) {
          liveAeroTopRef.current.textContent = `${nextDownforce} KGF AERO`;
        }
        if (liveSpeedDeckRef.current) {
          liveSpeedDeckRef.current.textContent = nextSpeedKmh <= 2 ? '0 KM/H • N' : `${nextSpeedKmh} KM/H • ${gearStr}${drsStr}`;
        }
        if (liveDownforceDeckRef.current) {
          liveDownforceDeckRef.current.textContent = `${nextDownforce} KGF`;
        }
        if (liveSuctionDeckRef.current) {
          liveSuctionDeckRef.current.textContent = `-${nextSuction} KPA`;
        }
        if (liveDragDeckRef.current) {
          liveDragDeckRef.current.textContent = `${nextDrag} N`;
        }
        if (liveBrakeDeckRef.current) {
          liveBrakeDeckRef.current.textContent = `${nextBrake} °C`;
        }
      }

      // 10. Live Battery Glow Pulse
      if (batteryGlowMeshRef.current?.material instanceof THREE.MeshStandardMaterial) {
        const pulse = 0.35 + 0.25 * Math.sin(elapsed * 4.0);
        batteryGlowMeshRef.current.material.emissiveIntensity = pulse;
      }

      // 11. MGU-K Power Flow Pulse
      if (mgukMeshRef.current?.material instanceof THREE.MeshStandardMaterial) {
        const currentAction = actionRef.current;
        const mgukIntensity = currentAction === 'OVERTAKE' ? 0.95 : currentAction === 'RECOVER' ? 0.65 : 0.35;
        mgukMeshRef.current.material.emissiveIntensity = mgukIntensity + 0.15 * Math.sin(elapsed * 8);
      }

      // 11B. ERS Energy Conservation, Slipstream Tow & Autonomous Overtake Simulation
      if (rivalCarRootRef.current) {
        if (activeFocusRef.current === 'ers') {
          rivalCarRootRef.current.visible = true;

          const isOvertake = ersBattlePhaseRef.current === 'OVERTAKE';
          const isAhead = ersBattlePhaseRef.current === 'AHEAD';
          const isConserving = ersBattlePhaseRef.current === 'CONSERVE';

          // 1. Target Overtake Progression (-1.0 = trailing in slipstream, 0.0 = wheel-to-wheel, +1.0 = ahead)
          const targetProgress = isAhead ? 1.0 : isOvertake ? 1.0 : -1.0;
          const progressRate = isOvertake ? 0.36 : 0.42;
          ersOvertakeProgressRef.current = THREE.MathUtils.damp(
            ersOvertakeProgressRef.current,
            targetProgress,
            progressRate * 4.0,
            delta
          );
          const prog = ersOvertakeProgressRef.current;

          // 2. Dynamic Battery SOC & MGU-K Power Flow
          if (isConserving) {
            aheadHoldTimerRef.current = 0;
            // Slipstream tow harvesting: +11%/sec
            ersBattleSocRef.current = Math.min(99.0, ersBattleSocRef.current + delta * 11.0);
            // AI tactical decision: launch overtake once battery reaches 72% AND car has settled in slipstream tow
            if (ersBattleAutoAiRef.current && ersBattleSocRef.current >= 72.0 && prog <= -0.80) {
              if (ersBattlePhaseRef.current !== 'OVERTAKE') {
                ersBattlePhaseRef.current = 'OVERTAKE';
                setErsBattlePhase('OVERTAKE');
              }
            }
          } else if (isOvertake) {
            aheadHoldTimerRef.current = 0;
            // Heavy 120kW discharge (-11.5% / sec)
            ersBattleSocRef.current = Math.max(18.0, ersBattleSocRef.current - delta * 11.5);
            // Once primary car completes pass and reaches lead (+1.0 ahead)
            if (prog >= 0.95) {
              if (ersBattlePhaseRef.current !== 'AHEAD') {
                ersBattlePhaseRef.current = 'AHEAD';
                setErsBattlePhase('AHEAD');
              }
            }
          } else if (isAhead) {
            // Sustaining P1 lead in clean air (+2.5%/sec regen)
            ersBattleSocRef.current = Math.min(95.0, ersBattleSocRef.current + delta * 2.5);
            aheadHoldTimerRef.current += delta;
            // Auto-loop: when AI mode is on, hold P1 lead for 3.5 seconds so overtake is clearly visible and savored
            if (ersBattleAutoAiRef.current && aheadHoldTimerRef.current >= 3.5) {
              aheadHoldTimerRef.current = 0;
              ersBattleSocRef.current = 28.0; // Realistic post-overtake depleted SOC
              if (ersBattlePhaseRef.current !== 'CONSERVE') {
                ersBattlePhaseRef.current = 'CONSERVE';
                setErsBattlePhase('CONSERVE');
              }
            }
          }

          // 3. 3D Relative Vehicle Trajectories — Wide, Clean Side-by-Side Overtake
          const primaryTargetX = THREE.MathUtils.lerp(-0.5, 7.5, (prog + 1) / 2);
          const rivalTargetX = THREE.MathUtils.lerp(10.5, -6.5, (prog + 1) / 2);

          // Lateral passing lane (negative Z = inside passing lane):
          // Ramp in early between prog -0.92 and -0.20 (swings out into passing lane well before drawing level)
          const lateralEntry = Math.min(1.0, Math.max(0.0, (prog + 0.92) / 0.72));
          // Ramp out late between prog +0.25 and +0.90 (merges back only after nose is well ahead)
          const lateralExit  = Math.min(1.0, Math.max(0.0, (prog - 0.25) / 0.65));
          const lateralEnvelope = lateralEntry * lateralEntry * (3 - 2 * lateralEntry)
                                - lateralExit  * lateralExit  * (3 - 2 * lateralExit);

          // Primary car moves 2.5m into the side passing lane (wide, clear separation)
          const primaryTargetZ = -lateralEnvelope * 2.5;
          // Rival car yields slightly (0.4m) outward
          const rivalTargetZ   =  lateralEnvelope * 0.4;

          if (carRootRef.current) {
            carRootRef.current.position.x = THREE.MathUtils.damp(carRootRef.current.position.x, primaryTargetX, 7.5, delta);
            carRootRef.current.position.z = THREE.MathUtils.damp(carRootRef.current.position.z, primaryTargetZ, 7.5, delta);
          }
          rivalCarRootRef.current.position.x = THREE.MathUtils.damp(rivalCarRootRef.current.position.x, rivalTargetX, 7.5, delta);
          rivalCarRootRef.current.position.z = THREE.MathUtils.damp(rivalCarRootRef.current.position.z, rivalTargetZ, 7.5, delta);
          rivalCarRootRef.current.position.y = carRootRef.current?.position.y ?? 0;

          // Yaw both cars to face their direction of travel (subtle steering into/out of the passing lane)
          const lateralVelocity = (primaryTargetZ - (carRootRef.current?.position.z ?? 0));
          const primaryYaw = Math.max(-0.18, Math.min(0.18, lateralVelocity * 0.08));
          const rivalYaw   = Math.max(-0.10, Math.min(0.10, -rivalTargetZ * 0.04));
          if (carRootRef.current) carRootRef.current.rotation.y = THREE.MathUtils.damp(carRootRef.current.rotation.y, primaryYaw, 5.0, delta);
          rivalCarRootRef.current.rotation.y = THREE.MathUtils.damp(rivalCarRootRef.current.rotation.y, rivalYaw, 5.0, delta);

          // 4. Synchronize Rival BBS Wheel Rotation with Track Speed
          if (distDelta > 0) {
            rivalWheelsRef.current.forEach((w) => {
              const r = (w.userData?.radius as number) || 0.35;
              w.rotation.z -= distDelta / r;
            });
          }

          // 5. Flashing Rear FIA Rain Light on Rival Car
          if (rivalRainLightRef.current?.material instanceof THREE.MeshBasicMaterial) {
            const isFlashing = Math.sin(elapsed * 24) > 0;
            rivalRainLightRef.current.material.opacity = isFlashing ? 1.0 : 0.15;
          }

          // 6. DRS Flap Animation on Primary Car
          if (drsFlapMeshRef.current) {
            const targetDrsAngle = isOvertake ? -0.42 : 0;
            drsFlapMeshRef.current.rotation.z = THREE.MathUtils.damp(
              drsFlapMeshRef.current.rotation.z,
              targetDrsAngle,
              14.0,
              delta
            );
          }

          // 7. Ultra-smooth direct DOM telemetry update for ERS Battle HUD (0ms React reconciliation)
          if (frameCounter % 3 === 0) {
            const primaryPosX = carRootRef.current?.position.x ?? primaryTargetX;
            const rivalPosX = rivalCarRootRef.current.position.x;
            const gapM = Math.max(0, Math.abs(rivalPosX - primaryPosX)).toFixed(1);
            const gapS = (parseFloat(gapM) / Math.max(1, physicalSpeedMs)).toFixed(2);
            const mguKw = isOvertake ? -120 : isConserving ? 78 : 35;
            const currentSoc = Math.round(ersBattleSocRef.current);
            const chaseKmh = Math.round(currentKmh + (isOvertake ? 18 : 0));
            const leadKmh  = Math.round(currentKmh - (isOvertake ? 16 : 0));

            if (ersSocValRef.current) {
              ersSocValRef.current.textContent = `${currentSoc}% (${((currentSoc / 100) * 4.0).toFixed(2)} MJ)`;
            }
            if (ersSocBarRef.current) {
              ersSocBarRef.current.style.width = `${currentSoc}%`;
              ersSocBarRef.current.className = `ers-soc-fill ers-soc-fill--${ersBattlePhaseRef.current.toLowerCase()}`;
            }
            if (ersGapValRef.current) {
              ersGapValRef.current.textContent = `${gapM}m (${gapS}s)`;
            }
            if (ersSubValRef.current) {
              ersSubValRef.current.textContent = isConserving
                ? 'TOW: -32% DRAG'
                : isOvertake
                ? 'SURGE: DELTA +24 KM/H'
                : 'CLEAN AIR LEAD';
            }
            if (ersSpeedValRef.current) {
              ersSpeedValRef.current.textContent = `${chaseKmh} vs ${leadKmh} KM/H`;
            }
            if (ersMguSubValRef.current) {
              ersMguSubValRef.current.textContent = `MGU-K: ${mguKw > 0 ? `+${mguKw}` : mguKw} kW`;
            }
          }
        } else {
          rivalCarRootRef.current.visible = false;
          if (carRootRef.current) {
            carRootRef.current.position.x = THREE.MathUtils.damp(carRootRef.current.position.x, 0, 6.0, delta);
            carRootRef.current.position.z = THREE.MathUtils.damp(carRootRef.current.position.z, 0, 6.0, delta);
            // Smoothly reset yaw so car faces forward again after leaving ERS view
            carRootRef.current.rotation.y = THREE.MathUtils.damp(carRootRef.current.rotation.y, 0, 6.0, delta);
          }
          rivalCarRootRef.current.rotation.y = THREE.MathUtils.damp(rivalCarRootRef.current.rotation.y, 0, 6.0, delta);
        }
      }

      // 12. Dynamic Subsystem Spotlight & Dimming (Dirty-checked for 60+ FPS performance)
      const currentFocus = hoveredFocusRef.current || activeFocusRef.current;
      const isSpecificSubsystem = currentFocus !== 'all' && currentFocus !== 'chase';
      const focusChanged = currentFocus !== prevFocus;
      const opacityChanging = Math.abs(smoothBodyOpacityRef.current - prevSmoothOpacity) > 0.002;

      if (focusChanged || opacityChanging || !isSpotlightSettled) {
        prevFocus = currentFocus;
        prevSmoothOpacity = smoothBodyOpacityRef.current;
        let anyMeshDamping = false;

        highlightRegistryRef.current.forEach((item) => {
          const mesh = item.mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
          if (!mat) return;

          const isBodyPart =
            item.subsystem === 'chassis' ||
            item.subsystem === 'nose' ||
            item.subsystem === 'cockpit' ||
            item.subsystem === 'sidepods' ||
            item.subsystem === 'rearwing';

          const isHighlighted =
            !isSpecificSubsystem ||
            (currentFocus === 'ers' && (item.subsystem === 'ers' || item.subsystem === 'engine')) ||
            (currentFocus === item.subsystem);

          let targetOpacity = item.baseOpacity;
          let targetEmissiveIntensity = item.baseEmissiveIntensity;

          if (isBodyPart) {
            // CRITICAL: Exterior bodywork MUST NEVER become transparent when switching camera views!
            // It always strictly maintains the user's selected bodyOpacity setting smoothly.
            targetOpacity = smoothBodyOpacityRef.current;
            targetEmissiveIntensity = item.baseEmissiveIntensity;
          } else if (isSpecificSubsystem) {
            // Internal mechanical systems (powertrain, cooling, brakes, wheels)
            if (isHighlighted) {
              targetOpacity = 1.0;
              if (item.baseEmissiveIntensity > 0) {
                targetEmissiveIntensity = Math.max(item.baseEmissiveIntensity * 1.8, 0.95);
              } else if (item.subsystem === 'engine') {
                if (mat.emissive.getHex() !== 0xd97706) {
                  mat.emissive.setHex(0xd97706);
                }
                targetEmissiveIntensity = 0.45;
              }
            } else {
              // Softly dim other internal non-focused components without hiding the car
              targetOpacity = item.subsystem === 'tyres' ? 0.40 : 0.30;
              targetEmissiveIntensity = 0.04;
              if (item.subsystem === 'engine' && mat.emissive.getHex() !== 0x000000) {
                mat.emissive.setHex(0x000000);
              }
            }
          } else {
            // Normal balanced mode for internal systems
            targetOpacity = item.baseOpacity;
            targetEmissiveIntensity = item.baseEmissiveIntensity;
            if (item.subsystem === 'engine' && mat.emissive.getHex() !== 0x000000) {
              mat.emissive.setHex(0x000000);
            }
          }

          if (Math.abs(mat.opacity - targetOpacity) > 0.003) {
            mat.opacity = THREE.MathUtils.damp(mat.opacity, targetOpacity, 10.0, delta);
            anyMeshDamping = true;
          } else {
            mat.opacity = targetOpacity;
          }

          if ('emissiveIntensity' in mat) {
            if (Math.abs(mat.emissiveIntensity - targetEmissiveIntensity) > 0.005) {
              mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, targetEmissiveIntensity, 10.0, delta);
              anyMeshDamping = true;
            } else {
              mat.emissiveIntensity = targetEmissiveIntensity;
            }
          }
        });

        // Update bodywork holographic wireframe opacity
        bodyEdgesRef.current.forEach((line) => {
          const parentSub = line.userData?.subsystem || line.parent?.userData?.subsystem || 'chassis';
          const isKey = line.userData?.isKeyHighlight || parentSub === 'nose' || parentSub === 'cockpit' || parentSub === 'rearwing';
          const isHighlighted =
            !isSpecificSubsystem ||
            (currentFocus === 'ers' && (parentSub === 'ers' || parentSub === 'engine')) ||
            (currentFocus === parentSub);

          let edgeTargetOpacity = Math.max(0.04, smoothBodyOpacityRef.current * 0.65);
          if (smoothBodyOpacityRef.current >= 0.70) {
            edgeTargetOpacity = isHighlighted ? 0.96 : (isKey ? 0.65 : 0.35);
          } else if (isSpecificSubsystem && isHighlighted) {
            edgeTargetOpacity = 0.92;
          }

          const lineMat = line.material as THREE.LineBasicMaterial;
          if (focusChanged) {
            if (isSpecificSubsystem && isHighlighted) {
              lineMat.color.setHex(0x00f0ff);
            } else if (smoothBodyOpacityRef.current >= 0.70) {
              lineMat.color.setHex(isKey ? 0x38bdf8 : 0x0284c7);
            } else {
              lineMat.color.setHex(0x00d2be);
            }
          }

          if (Math.abs(lineMat.opacity - edgeTargetOpacity) > 0.003) {
            lineMat.opacity = THREE.MathUtils.damp(lineMat.opacity, edgeTargetOpacity, 10.0, delta);
            anyMeshDamping = true;
          } else {
            lineMat.opacity = edgeTargetOpacity;
          }
        });

        isSpotlightSettled = !anyMeshDamping;
      }

      // 13. Orbit Controls Update — only when NOT transitioning (transition branch calls update() itself)
      if (!isCameraTransitioningRef.current && controlsRef.current) {
        controlsRef.current.update();
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    };
    window.addEventListener('resize', handleResize);

    // 13. Direct 3D Subsystem Pointer Touch / Click Raycasting
    const raycaster = new THREE.Raycaster();
    let pointerDownTime = 0;
    let pointerDownX = 0;
    let pointerDownY = 0;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownTime = performance.now();
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
    };

    let lastRaycastTime = 0;
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastRaycastTime < 45) return; // Cap hover raycasting at ~22Hz to eliminate CPU spikes
      lastRaycastTime = now;
      if (!container || !cameraRef.current || !carRootRef.current) return;
      const rect = container.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);
      const hits = raycaster.intersectObjects(carRootRef.current.children, true);

      let foundSubsystem: SubsystemFocus | null = null;
      for (const hit of hits) {
        if (!hit.object.visible) continue;
        let cur: THREE.Object3D | null = hit.object;
        while (cur && cur !== carRootRef.current) {
          if (cur.userData?.subsystem) {
            const s = cur.userData.subsystem;
            foundSubsystem = s === 'engine' ? 'ers' : (s as SubsystemFocus);
            break;
          }
          cur = cur.parent;
        }
        if (foundSubsystem) break;
      }

      if (foundSubsystem && foundSubsystem !== 'all') {
        container.style.cursor = 'pointer';
      } else {
        container.style.cursor = 'default';
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const elapsed = performance.now() - pointerDownTime;
      const dist = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
      if (elapsed < 350 && dist < 6) {
        if (!container || !cameraRef.current || !carRootRef.current) return;
        const rect = container.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);
        const hits = raycaster.intersectObjects(carRootRef.current.children, true);

        let targetSub: SubsystemFocus | null = null;
        for (const hit of hits) {
          if (!hit.object.visible) continue;
          let cur: THREE.Object3D | null = hit.object;
          while (cur && cur !== carRootRef.current) {
            if (cur.userData?.subsystem) {
              const s = cur.userData.subsystem;
              targetSub = s === 'engine' ? 'ers' : (s as SubsystemFocus);
              break;
            }
            cur = cur.parent;
          }
          if (targetSub) break;
        }

        if (targetSub) {
          if (targetSub === 'ers') {
            handleFocusChange('ers');
            setSelectedHotspot('ers-battery');
          } else if (targetSub === 'cooling') {
            handleFocusChange('cooling');
            setSelectedHotspot('cooling-radiator');
          } else if (targetSub === 'tyres') {
            handleFocusChange('tyres');
            setSelectedHotspot('tyres-pirelli');
          } else if (targetSub === 'nose') {
            handleFocusChange('nose');
            setSelectedHotspot('aero-cfd');
          } else if (targetSub === 'cockpit') {
            handleFocusChange('cockpit');
          } else {
            handleFocusChange('all');
          }
        }
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      renderer.dispose();
      container.innerHTML = '';
    };
  }, []); // Run once on mount: button clicks smoothly glide camera without scene re-initialization!

  return (
    <div className="f1-3d-viewer" role="region" aria-label="3D F1 Car X-Ray Telemetry Explorer">
      {/* ── Loading Overlay ────────────────────────────────────────── */}
      {loadingProgress !== null && (
        <div className="f1-3d__loading-overlay" aria-live="polite">
          <div className="loading-card">
            <Loader2 size={24} className="loading-spinner" />
            <div className="loading-texts">
              <span className="loading-title">INITIALIZING FERRARI SF-25 3D MODEL</span>
              <span className="loading-sub mono">
                TRANSLUCENT BODYWORK APPLIED • ERS & TYRES RETAINED ({loadingProgress}%)
              </span>
            </div>
            <div className="loading-bar">
              <div className="loading-bar-fill" style={{ width: `${loadingProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Top Floating Broadcast Bar ─────────────────────────────── */}
      <div className="f1-3d__top-bar">
        <div className="f1-3d__title-box">
          <div className="f1-3d__badge-row">
            <span className="f1-3d__badge">FERRARI SF-25 SPEC</span>
            {glbLoaded && (
              <span className="glb-loaded-pill">
                <CheckCircle2 size={10} /> GLB ACTIVE
              </span>
            )}
            <span className="live-speed-tag mono">
              <Gauge size={10} /> <span ref={liveSpeedTopRef}>{displaySpeedKmh <= 2 ? '0 KM/H (IDLE)' : `${displaySpeedKmh} KM/H`}</span>
            </span>
            <span className="live-aero-pill mono">
              <Activity size={10} /> <span ref={liveAeroTopRef}>{liveDownforceKg} KGF AERO</span>
            </span>
            {activeFocus === 'ers' && (
              <span className="spotlight-active-badge ers mono">
                <Zap size={10} /> SPOTLIGHT: ERS & V6
              </span>
            )}
            {activeFocus === 'cooling' && (
              <span className="spotlight-active-badge cooling mono">
                <Thermometer size={10} /> SPOTLIGHT: COOLING
              </span>
            )}
            {activeFocus === 'tyres' && (
              <span className="spotlight-active-badge tyres mono">
                <Disc size={10} /> SPOTLIGHT: TYRES & BRAKES
              </span>
            )}
            {activeFocus === 'nose' && (
              <span className="spotlight-active-badge nose mono">
                <Compass size={10} /> SPOTLIGHT: NOSE AERO
              </span>
            )}
            {activeFocus === 'cockpit' && (
              <span className="spotlight-active-badge cockpit mono">
                <ShieldCheck size={10} /> SPOTLIGHT: COCKPIT
              </span>
            )}
          </div>
          <h2 className="f1-3d__title">SF-25 X-RAY TELEMETRY // ERS, COOLING & TYRES SOLID</h2>
        </div>

        {/* Camera Subsystem Focus Presets Toolbar */}
        <div className="f1-3d__focus-presets" role="radiogroup" aria-label="Camera Subsystem Focus">
          <button
            type="button"
            className={`preset-btn ${activeFocus === 'all' ? 'preset-btn--active' : ''}`}
            onClick={() => handleFocusChange('all')}
            onMouseEnter={() => { hoveredFocusRef.current = 'all'; }}
            onMouseLeave={() => { hoveredFocusRef.current = null; }}
            title="Balanced 360° Inspection of entire vehicle"
          >
            <Eye size={12} />
            <span>CHASSIS</span>
          </button>
          <button
            type="button"
            className={`preset-btn ${activeFocus === 'chase' ? 'preset-btn--active preset-btn--cam' : ''}`}
            onClick={() => handleFocusChange('chase')}
            onMouseEnter={() => { hoveredFocusRef.current = 'chase'; }}
            onMouseLeave={() => { hoveredFocusRef.current = null; }}
            title="Behind Roll-Hoop Dynamic Chase Camera"
          >
            <Video size={12} />
            <span>CHASE</span>
          </button>
          <button
            type="button"
            className={`preset-btn preset-btn--nose ${activeFocus === 'nose' ? 'preset-btn--active' : ''}`}
            onClick={() => {
              handleFocusChange('nose');
              setSelectedHotspot('aero-cfd');
            }}
            onMouseEnter={() => { hoveredFocusRef.current = 'nose'; }}
            onMouseLeave={() => { hoveredFocusRef.current = null; }}
            title="Highlight Front Wing & Nosecone Aerodynamics"
          >
            <Compass size={12} />
            <span>NOSE AERO</span>
          </button>
          <button
            type="button"
            className={`preset-btn preset-btn--ers ${activeFocus === 'ers' ? 'preset-btn--active' : ''}`}
            onClick={() => {
              handleFocusChange('ers');
              setSelectedHotspot('ers-battery');
            }}
            onMouseEnter={() => { hoveredFocusRef.current = 'ers'; }}
            onMouseLeave={() => { hoveredFocusRef.current = null; }}
            title="Highlight ERS Battery, MGU-K, MGU-H & 1.6L V6 Turbo PU"
          >
            <Zap size={12} />
            <span>ERS & OVERTAKE</span>
          </button>
          <button
            type="button"
            className={`preset-btn preset-btn--cooling ${activeFocus === 'cooling' ? 'preset-btn--active' : ''}`}
            onClick={() => {
              handleFocusChange('cooling');
              setSelectedHotspot('cooling-radiator');
            }}
            onMouseEnter={() => { hoveredFocusRef.current = 'cooling'; }}
            onMouseLeave={() => { hoveredFocusRef.current = null; }}
            title="Highlight 6-Core Sidepod Intercooler & Radiators"
          >
            <Thermometer size={12} />
            <span>COOLING</span>
          </button>
          <button
            type="button"
            className={`preset-btn preset-btn--tyres ${activeFocus === 'tyres' ? 'preset-btn--active' : ''}`}
            onClick={() => {
              handleFocusChange('tyres');
              setSelectedHotspot('tyres-pirelli');
            }}
            onMouseEnter={() => { hoveredFocusRef.current = 'tyres'; }}
            onMouseLeave={() => { hoveredFocusRef.current = null; }}
            title="Highlight Tyres, BBS Forged Rims & Brembo Brakes"
          >
            <Disc size={12} />
            <span>TYRES</span>
          </button>
          <button
            type="button"
            className={`preset-btn preset-btn--cockpit ${activeFocus === 'cockpit' ? 'preset-btn--active' : ''}`}
            onClick={() => handleFocusChange('cockpit')}
            onMouseEnter={() => { hoveredFocusRef.current = 'cockpit'; }}
            onMouseLeave={() => { hoveredFocusRef.current = null; }}
            title="Highlight Titanium Halo & Driver Monocoque"
          >
            <ShieldCheck size={12} />
            <span>COCKPIT</span>
          </button>
        </div>

        {/* Track Motion Toggle, Auto Orbit & Reset */}
        <div className="f1-3d__top-actions">
          <button
            type="button"
            className={`action-btn ${isTrackMoving ? 'action-btn--moving' : ''}`}
            onClick={() => setIsTrackMoving(!isTrackMoving)}
            title="Toggle High-Speed Circuit Track Motion"
          >
            {isTrackMoving ? <Pause size={12} /> : <Play size={12} />}
            <span>{isTrackMoving ? 'TRACK ON' : 'TRACK OFF'}</span>
          </button>
          <button
            type="button"
            className={`action-btn ${autoRotate ? 'action-btn--active' : ''}`}
            onClick={() => setAutoRotate(!autoRotate)}
            title="Toggle 360 Turntable Orbit"
          >
            <RotateCcw size={12} />
            <span>{autoRotate ? 'ORBIT ON' : 'ORBIT OFF'}</span>
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={() => handleFocusChange('all')}
            title="Reset Camera to Default Inspection Angle"
          >
            <Maximize2 size={12} />
            <span>RESET</span>
          </button>
        </div>
      </div>

      {/* ── ERS Energy Conservation & Overtake Simulation Tactical HUD ── */}
      {activeFocus === 'ers' && (
        <div className="f1-3d__ers-battle-hud" role="region" aria-label="ERS Battle Telemetry">
          <div className="ers-battle__header">
            <div className="ers-battle__title-box">
              <Zap size={13} className="ers-battle__icon" />
              <span>ERS TACTICAL OVERTAKE BATTLE</span>
            </div>
            <div className={`ers-battle__phase-badge ers-battle__phase-badge--${ersBattlePhase.toLowerCase()}`}>
              {ersBattlePhase === 'CONSERVE' && (
                <>
                  <span className="ers-dot ers-dot--green" />
                  <span>SLIPSTREAM HARVESTING (+{ersBattleTelemetry.mguKw} kW)</span>
                </>
              )}
              {ersBattlePhase === 'OVERTAKE' && (
                <>
                  <span className="ers-dot ers-dot--red" />
                  <span>ATTACK PROTOCOL ACTIVE (-120 kW)</span>
                </>
              )}
              {ersBattlePhase === 'AHEAD' && (
                <>
                  <Trophy size={10} />
                  <span>P1 POSITION SECURED // PASS COMPLETE</span>
                </>
              )}
            </div>
          </div>

          <div className="ers-battle__metrics-grid">
            <div className="ers-metric-box">
              <span className="ers-metric-lbl">
                <BatteryCharging size={10} /> BATTERY SOC (FIA 4MJ):
              </span>
              <span className="ers-metric-val">
                <span ref={ersSocValRef}>
                  {ersBattleTelemetry.soc}%{' '}
                  <small className="mono">({((ersBattleTelemetry.soc / 100) * 4.0).toFixed(2)} MJ)</small>
                </span>
              </span>
              <div className="ers-soc-bar">
                <div
                  ref={ersSocBarRef}
                  className={`ers-soc-fill ers-soc-fill--${ersBattlePhase.toLowerCase()}`}
                  style={{ width: `${ersBattleTelemetry.soc}%` }}
                />
              </div>
            </div>

            <div className="ers-metric-box">
              <span className="ers-metric-lbl">
                <Wind size={10} /> RIVAL GAP & TOW:
              </span>
              <span className="ers-metric-val">
                <span ref={ersGapValRef}>
                  {ersBattleTelemetry.gapM}m{' '}
                  <small className="mono">({ersBattleTelemetry.gapS}s)</small>
                </span>
              </span>
              <span ref={ersSubValRef} className="ers-metric-sub mono">
                {ersBattlePhase === 'CONSERVE'
                  ? `TOW: -${ersBattleTelemetry.dragReductionPct}% DRAG`
                  : ersBattlePhase === 'OVERTAKE'
                  ? 'SURGE: DELTA +24 KM/H'
                  : 'CLEAN AIR LEAD'}
              </span>
            </div>

            <div className="ers-metric-box">
              <span className="ers-metric-lbl">
                <Gauge size={10} /> SPEED DELTA:
              </span>
              <span className="ers-metric-val">
                <span ref={ersSpeedValRef}>
                  {ersBattleTelemetry.chaseSpeedKmh}{' '}
                  <small className="mono">vs {ersBattleTelemetry.leadSpeedKmh} KM/H</small>
                </span>
              </span>
              <span ref={ersMguSubValRef} className="ers-metric-sub mono">
                MGU-K: {ersBattleTelemetry.mguKw > 0 ? `+${ersBattleTelemetry.mguKw}` : ersBattleTelemetry.mguKw} kW
              </span>
            </div>
          </div>

          <div className="ers-battle__actions">
            <button
              type="button"
              className="ers-action-btn ers-action-btn--attack"
              onClick={handleTriggerOvertake}
              title="Deploy Maximum 120kW MGU-K Boost & Launch Overtake"
            >
              <Zap size={11} />
              <span>LAUNCH OVERTAKE</span>
            </button>
            <button
              type="button"
              className="ers-action-btn ers-action-btn--conserve"
              onClick={handleHoldConserve}
              title="Stay in Slipstream Tow & Harvest Energy into Battery"
            >
              <Wind size={11} />
              <span>CONSERVE ENERGY</span>
            </button>
            <button
              type="button"
              className="ers-action-btn"
              onClick={handleResetBattle}
              title="Reset Dual Car Duel & Start from Slipstream"
            >
              <RotateCcw size={11} />
              <span>RESET DUEL</span>
            </button>
            <button
              type="button"
              className={`ers-action-btn ${ersBattleAutoAi ? 'ers-action-btn--active' : ''}`}
              onClick={() => {
                const nextAi = !ersBattleAutoAi;
                setErsBattleAutoAi(nextAi);
                ersBattleAutoAiRef.current = nextAi;
              }}
              title="Toggle Autonomous Tactical AI Decision Engine"
            >
              <Cpu size={11} />
              <span>AUTO AI: {ersBattleAutoAi ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Three.js WebGL Canvas Mount ───────────────────────────── */}
      <div ref={mountRef} className="f1-3d__canvas-container" />

      {/* ── Left Floating Unified Control Deck ──────────────────────── */}
      <div className="f1-3d__left-panel">
        {/* Module 1: Chassis Transparency */}
        <div className="deck-module">
          <div className="deck-header">
            <span className="picker-lbl">
              <Eye size={11} /> CHASSIS OPACITY:
            </span>
            <span className="transparency-val mono">
              {Math.round((1 - bodyOpacity) * 100)}% ({bodyOpacity >= 0.85 ? 'SOLID // HIGHLIGHTS' : bodyOpacity <= 0.05 ? 'CRYSTAL' : bodyOpacity <= 0.18 ? 'GHOST' : 'TINTED'})
            </span>
          </div>
          <input
            type="range"
            className="transparency-range-slider"
            min="0.01"
            max="0.95"
            step="0.01"
            value={bodyOpacity}
            onChange={(e) => setBodyOpacity(parseFloat(e.target.value))}
            title="Drag to select chassis transparency (down to 99% pure optical glass)"
          />
          <div className="transparency-preset-grid">
            <button
              type="button"
              className={`preset-pill ${bodyOpacity <= 0.08 ? 'active' : ''}`}
              onClick={() => setBodyOpacity(0.02)}
              title="Ultra-transparent pure optical glass (98% transparent)"
            >
              2% GLASS
            </button>
            <button
              type="button"
              className={`preset-pill ${bodyOpacity > 0.08 && bodyOpacity < 0.7 ? 'active' : ''}`}
              onClick={() => setBodyOpacity(0.40)}
              title="Subtle translucent racing tint (60% transparent)"
            >
              40% TINT
            </button>
            <button
              type="button"
              className={`preset-pill ${bodyOpacity >= 0.7 ? 'active' : ''}`}
              onClick={() => setBodyOpacity(0.92)}
              title="Solid Rosso Corsa bodywork with prominent aerodynamic chassis highlights (8% transparent)"
            >
              92% SOLID
            </button>
          </div>
        </div>

        {/* Module 2: Velocity Controller */}
        <div className="deck-module">
          <div className="deck-header">
            <span className="picker-lbl">
              <Wind size={11} /> VELOCITY:
            </span>
            <span className="speed-live-tag mono">
              <span ref={liveSpeedDeckRef}>
                {displaySpeedKmh <= 2
                  ? '0 KM/H • N'
                  : `${displaySpeedKmh} KM/H • ${displaySpeedKmh < 90 ? 'G2' : displaySpeedKmh < 140 ? 'G3' : displaySpeedKmh < 195 ? 'G4' : displaySpeedKmh < 250 ? 'G5' : displaySpeedKmh < 295 ? 'G6' : displaySpeedKmh < 335 ? 'G7' : 'G8'}${displaySpeedKmh >= 300 ? ' • DRS' : ''}`}
              </span>
            </span>
          </div>
          <div className="speed-slider-wrapper">
            <input
              type="range"
              className="speed-range-slider"
              min="0"
              max="365"
              step="5"
              value={simSpeedKmh}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setSimSpeedKmh(val);
                setIsTrackMoving(val > 0);
              }}
              title="Drag to dial velocity smoothly from 0 to 365 KM/H"
            />
            <div className="speed-scale-markers mono">
              <span>0 (IDLE)</span>
              <span>120</span>
              <span>240</span>
              <span>365 (MAX)</span>
            </div>
          </div>
          <div className="speed-preset-grid">
            <button
              type="button"
              className={`speed-pill ${simSpeedKmh === 0 ? 'active' : ''}`}
              onClick={() => {
                setSimSpeedKmh(0);
                setIsTrackMoving(false);
              }}
              title="Neutral Standstill (0 KM/H)"
            >
              STOP
            </button>
            <button
              type="button"
              className={`speed-pill ${simSpeedKmh === 60 ? 'active' : ''}`}
              onClick={() => {
                setSimSpeedKmh(60);
                setIsTrackMoving(true);
              }}
              title="Pit Lane Speed Limiter (60 KM/H)"
            >
              60
            </button>
            <button
              type="button"
              className={`speed-pill ${simSpeedKmh === 160 ? 'active' : ''}`}
              onClick={() => {
                setSimSpeedKmh(160);
                setIsTrackMoving(true);
              }}
              title="Medium Speed Corner (160 KM/H)"
            >
              160
            </button>
            <button
              type="button"
              className={`speed-pill ${simSpeedKmh === 320 ? 'active' : ''}`}
              onClick={() => {
                setSimSpeedKmh(320);
                setIsTrackMoving(true);
              }}
              title="High-Speed DRS Straight (320 KM/H)"
            >
              320
            </button>
            <button
              type="button"
              className={`speed-pill speed-pill--max ${simSpeedKmh === 365 ? 'active' : ''}`}
              onClick={() => {
                setSimSpeedKmh(365);
                setIsTrackMoving(true);
              }}
              title="Max Terminal Velocity (365 KM/H)"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Module 3: Tyre Compound (18") */}
        <div className="deck-module">
          <span className="picker-lbl">
            <Disc size={11} /> TYRE COMPOUND (18"):
          </span>
          <div className="tyre-preset-grid">
            <button
              type="button"
              className={`compound-btn compound-btn--soft ${tyreCompound === 'SOFT' ? 'active' : ''}`}
              onClick={() => setTyreCompound('SOFT')}
              title="P Zero Soft (Red Slick - C5)"
            >
              SOFT
            </button>
            <button
              type="button"
              className={`compound-btn compound-btn--medium ${tyreCompound === 'MEDIUM' ? 'active' : ''}`}
              onClick={() => setTyreCompound('MEDIUM')}
              title="P Zero Medium (Yellow Slick - C3)"
            >
              MED
            </button>
            <button
              type="button"
              className={`compound-btn compound-btn--hard ${tyreCompound === 'HARD' ? 'active' : ''}`}
              onClick={() => setTyreCompound('HARD')}
              title="P Zero Hard (White Slick - C1)"
            >
              HARD
            </button>
            <button
              type="button"
              className={`compound-btn compound-btn--inter ${tyreCompound === 'INTER' ? 'active' : ''}`}
              onClick={() => setTyreCompound('INTER')}
              title="Cinturato Intermediate (Green Directional Rain Grooves)"
            >
              INTER
            </button>
            <button
              type="button"
              className={`compound-btn compound-btn--wet ${tyreCompound === 'WET' ? 'active' : ''}`}
              onClick={() => setTyreCompound('WET')}
              title="Cinturato Full Wet (Blue Deep Aqua-Drainage Blocks)"
            >
              WET
            </button>
          </div>
        </div>

        {/* Module 4: CFD Aero Flow Mode */}
        <div className="deck-module">
          <span className="picker-lbl">
            <Sparkles size={11} /> CFD AERO DYNAMICS:
          </span>
          <div className="aero-preset-grid">
            <button
              type="button"
              className={`aero-pill ${aeroFlowMode === 'ALL' ? 'active' : ''}`}
              onClick={() => setAeroFlowMode('ALL')}
              title="Full Aerodynamic CFD Streamlines"
            >
              ALL
            </button>
            <button
              type="button"
              className={`aero-pill ${aeroFlowMode === 'VORTICES' ? 'active' : ''}`}
              onClick={() => setAeroFlowMode('VORTICES')}
              title="Corkscrew Wingtip & Endplate Vortices Only"
            >
              VORTICES
            </button>
            <button
              type="button"
              className={`aero-pill ${aeroFlowMode === 'SPARKS' ? 'active' : ''}`}
              onClick={() => setAeroFlowMode('SPARKS')}
              title="High-Speed Titanium Skid Block Sparks"
            >
              <Flame size={9} /> SPARKS
            </button>
          </div>
        </div>
      </div>

      {/* ── Subsystem Live Telemetry Cards (Right Floating HUD) ────── */}
      <div className="f1-3d__telemetry-hud">
        {/* Card 0: Real-time Aerodynamic Computing HUD */}
        <div
          className={`hud-card hud-card--aero ${selectedHotspot === 'aero-cfd' ? 'hud-card--selected' : ''}`}
          onClick={() => {
            setSelectedHotspot('aero-cfd');
            handleFocusChange('nose');
          }}
          title="Click to spotlight Front Wing & Nose Aerodynamics"
        >
          <div className="hud-card__header">
            <div className="hud-card__indicator hud-card__indicator--cyan" />
            <span className="hud-card__title">CFD AERO DYNAMICS (GROUND EFFECT)</span>
            <span className="hud-card__status mono">{isTrackMoving ? 'COMPRESSING' : 'STATIC'}</span>
          </div>
          <div className="hud-card__metrics">
            <div className="hud-metric">
              <span className="hud-metric__label">TOTAL DOWNFORCE</span>
              <strong className="hud-metric__val mono cyan-glow">
                <span ref={liveDownforceDeckRef}>{liveDownforceKg}</span> <small>KGF</small>
              </strong>
            </div>
            <div className="hud-metric">
              <span className="hud-metric__label">VENTURI SUCTION</span>
              <strong className="hud-metric__val mono cyan-glow">
                <span ref={liveSuctionDeckRef}>-{liveSuctionKpa}</span> <small>KPA</small>
              </strong>
            </div>
            <div className="hud-metric">
              <span className="hud-metric__label">AERO DRAG (CdA)</span>
              <strong className="hud-metric__val mono">
                <span ref={liveDragDeckRef}>{liveDragN}</span> <small>N</small>
              </strong>
            </div>
            <div className="hud-metric">
              <span className="hud-metric__label">CARBON ROTOR HEAT</span>
              <strong className="hud-metric__val mono red-glow">
                <span ref={liveBrakeDeckRef}>{liveBrakeTempC}</span> <small>°C</small>
              </strong>
            </div>
          </div>
        </div>

        {/* Card 1: ERS & Power Unit (Non-Transparent Solid) */}
        <div
          className={`hud-card hud-card--ers ${selectedHotspot === 'ers-battery' ? 'hud-card--selected' : ''}`}
          onClick={() => {
            setSelectedHotspot('ers-battery');
            handleFocusChange('ers');
          }}
          title="Click to spotlight ERS Battery, MGU-K & V6 Engine"
        >
          <div className="hud-card__header">
            <div className="hud-card__indicator hud-card__indicator--cyan" />
            <span className="hud-card__title">ERS & V6 POWER UNIT</span>
            <span className="hud-card__status mono">{action}</span>
          </div>
          <div className="hud-card__metrics">
            <div className="hud-metric">
              <span className="hud-metric__label">ENERGY STORE (20-25kg)</span>
              <strong className="hud-metric__val mono cyan-glow">{batteryPercent.toFixed(1)}% <small>(4 MJ)</small></strong>
            </div>
            <div className="hud-metric">
              <span className="hud-metric__label">MGU-K (120 kW MAX)</span>
              <strong className="hud-metric__val mono">
                {action === 'OVERTAKE' ? '-120 kW (BOOST)' : action === 'RECOVER' ? '+95 kW (REGEN)' : 'BALANCED'}
              </strong>
            </div>
            <div className="hud-metric">
              <span className="hud-metric__label">MGU-H (E-TURBO)</span>
              <strong className="hud-metric__val mono">124,500 <small>RPM</small></strong>
            </div>
            <div className="hud-metric">
              <span className="hud-metric__label">1.6L 90° V6 TURBO</span>
              <strong className="hud-metric__val mono">14,800 <small>RPM</small></strong>
            </div>
          </div>
        </div>

        {/* Card 2: Cooling & Radiators (Non-Transparent Solid) */}
        <div
          className={`hud-card hud-card--cooling ${selectedHotspot === 'cooling-radiator' ? 'hud-card--selected' : ''}`}
          onClick={() => {
            setSelectedHotspot('cooling-radiator');
            handleFocusChange('cooling');
          }}
          title="Click to spotlight 6-Core Cooling Radiators"
        >
          <div className="hud-card__header">
            <div className="hud-card__indicator hud-card__indicator--amber" />
            <span className="hud-card__title">6-CORE COOLING MATRIX</span>
            <span className="hud-card__status mono">98.2°C OPTIMAL</span>
          </div>
          <div className="hud-card__metrics">
            <div className="hud-metric">
              <span className="hud-metric__label">RH 6-CORE INTERCOOLER</span>
              <strong className="hud-metric__val mono amber-glow">46.2 <small>°C</small></strong>
            </div>
            <div className="hud-metric">
              <span className="hud-metric__label">LH WATER RADIATOR</span>
              <strong className="hud-metric__val mono amber-glow">97.8 <small>°C</small></strong>
            </div>
            <div className="hud-metric">
              <span className="hud-metric__label">CHARGE AIR BOOST</span>
              <strong className="hud-metric__val mono">3.85 <small>bar</small></strong>
            </div>
            <div className="hud-metric">
              <span className="hud-metric__label">TURBO TEMP</span>
              <strong className="hud-metric__val mono">845 <small>°C</small></strong>
            </div>
          </div>
        </div>

        {/* Card 3: Tyres & Brakes (Non-Transparent Solid) */}
        <div
          className={`hud-card hud-card--tyres ${selectedHotspot === 'tyres-pirelli' ? 'hud-card--selected' : ''}`}
          onClick={() => {
            setSelectedHotspot('tyres-pirelli');
            handleFocusChange('tyres');
          }}
          title="Click to spotlight Piretti Tyres & Brembo Brakes"
        >
          <div className="hud-card__header">
            <div className="hud-card__indicator hud-card__indicator--red" />
            <span className="hud-card__title">PIRETTI P-CORSA TYRES</span>
            <span className="hud-card__status mono">{tyreCompound}</span>
          </div>
          <div className="hud-card__metrics">
            <div className="hud-metric">
              <span className="hud-metric__label">WEAR LEVEL</span>
              <strong className="hud-metric__val mono red-glow">{tyreDegradation.toFixed(1)}%</strong>
            </div>
            <div className="hud-metric">
              <span className="hud-metric__label">FRONT CARCASS</span>
              <strong className="hud-metric__val mono">102.4 <small>°C</small></strong>
            </div>
            <div className="hud-metric">
              <span className="hud-metric__label">REAR CARCASS</span>
              <strong className="hud-metric__val mono">106.1 <small>°C</small></strong>
            </div>
            <div className="hud-metric">
              <span className="hud-metric__label">BRAKE ROTOR (PEAK)</span>
              <strong className="hud-metric__val mono">840 <small>°C</small></strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── Fine-Grained Exploded View Slider (Bottom Centered) ─────── */}
      <div className="f1-3d__exploded-controller">
        <div className="exploded-slider-header">
          <span className="exploded-title">
            <Layers size={12} />
            <span>MULTI-COMPONENT AERO DISASSEMBLY:</span>
          </span>
          <div className="exploded-stats-row">
            {explodedRatio > 0.05 && (
              <span className="aero-subcomponents-badge mono">
                {explodedPartsRef.current.length || 32} SUB-COMPONENTS DECOUPLED
              </span>
            )}
            <strong className="exploded-pct mono">{Math.round(explodedRatio * 100)}%</strong>
          </div>
        </div>

        <input
          type="range"
          min="0"
          max="1.5"
          step="0.02"
          value={explodedRatio}
          onChange={(e) => setExplodedRatio(parseFloat(e.target.value))}
          className="f1-3d__exploded-range"
          aria-label="Fine-grained exploded bodywork slider"
        />

        <div className="exploded-labels">
          <span>PACKAGED (0%)</span>
          <span>WINGS & NOSE</span>
          <span>HALO & SIDEPODS</span>
          <span>OMNIDIRECTIONAL (100%)</span>
        </div>

        {/* Component Tags Strip when separated */}
        {explodedRatio > 0.15 && (
          <div className="exploded-components-strip">
            <span className="comp-tag">FRONT WING TIERS</span>
            <span className="comp-tag">NOSECONE BULKHEAD</span>
            <span className="comp-tag">TITANIUM HALO</span>
            <span className="comp-tag">COCKPIT COAMING</span>
            <span className="comp-tag">AERO MIRRORS</span>
            <span className="comp-tag">LH/RH SIDEPODS</span>
            <span className="comp-tag">UNDERCUT INLETS</span>
            <span className="comp-tag">AIRBOX T-CAM</span>
            <span className="comp-tag">SHARK FIN</span>
            <span className="comp-tag">ENGINE COVER</span>
            <span className="comp-tag">VENTURI FLOOR</span>
            <span className="comp-tag">DIFFUSER STRAKES</span>
            <span className="comp-tag">DRS UPPER FLAP</span>
            <span className="comp-tag">BEAM WING</span>
            <span className="comp-tag">REAR CRASH CONE</span>
            <span className="comp-tag comp-tag--solid">360° OMNIDIRECTIONAL</span>
          </div>
        )}

        <div className="exploded-footnote">
          <Info size={10} />
          <span>360° Omnidirectional Chassis Deconstruction • Scrolling tarmac, synchronized tyres & CFD active</span>
        </div>
      </div>
    </div>
  );
}
export default memo(F1Car3DViewer);
