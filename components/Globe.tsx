'use client';

import { useRef, useEffect } from 'react';

interface GlobeProps {
  usStatus: 'operational' | 'partial' | 'suspended' | 'unknown';
}

// Simplified continent outlines as normalized [x, y] points (0–1)
const CONTINENTS = {
  northAmerica: [
    [0.05, 0.15], [0.22, 0.1], [0.28, 0.18], [0.32, 0.25], [0.3, 0.38],
    [0.22, 0.45], [0.18, 0.55], [0.12, 0.52], [0.08, 0.42], [0.05, 0.3],
  ],
  southAmerica: [
    [0.22, 0.52], [0.3, 0.5], [0.34, 0.6], [0.3, 0.75], [0.24, 0.82],
    [0.2, 0.75], [0.18, 0.62],
  ],
  europe: [
    [0.44, 0.12], [0.52, 0.1], [0.56, 0.18], [0.54, 0.26], [0.48, 0.3],
    [0.44, 0.25], [0.42, 0.18],
  ],
  africa: [
    [0.46, 0.32], [0.54, 0.3], [0.58, 0.38], [0.56, 0.55], [0.52, 0.68],
    [0.46, 0.65], [0.42, 0.52], [0.43, 0.38],
  ],
  asia: [
    [0.54, 0.1], [0.72, 0.08], [0.8, 0.15], [0.82, 0.25], [0.78, 0.35],
    [0.7, 0.4], [0.62, 0.42], [0.56, 0.38], [0.52, 0.28], [0.52, 0.18],
  ],
  australia: [
    [0.72, 0.56], [0.82, 0.54], [0.86, 0.62], [0.82, 0.7], [0.74, 0.72],
    [0.7, 0.64],
  ],
};

// Key locations as normalized [x, y]
const JAPAN = [0.79, 0.27];
const DESTINATIONS = [
  { name: 'Los Angeles', pos: [0.12, 0.32] as [number, number] },
  { name: 'London', pos: [0.47, 0.18] as [number, number] },
  { name: 'Singapore', pos: [0.71, 0.48] as [number, number] },
  { name: 'Sydney', pos: [0.8, 0.65] as [number, number] },
  { name: 'Dubai', pos: [0.6, 0.35] as [number, number] },
];

const USA_STATUS_COLORS: Record<string, string> = {
  operational: 'rgba(0, 196, 140, 0.3)',
  partial: 'rgba(255, 193, 7, 0.3)',
  suspended: 'rgba(255, 71, 87, 0.3)',
  unknown: 'rgba(136, 136, 136, 0.15)',
};

interface Vehicle {
  t: number;
  speed: number;
  trail: [number, number][];
  destIndex: number;
}

function bezierPoint(
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number]
): [number, number] {
  const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0];
  const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1];
  return [x, y];
}

function controlPoint(from: [number, number], to: [number, number]): [number, number] {
  const mx = (from[0] + to[0]) / 2;
  const my = (from[1] + to[1]) / 2;
  const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return [mx, my - dist * 0.4];
}

export default function Globe({ usStatus }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const vehiclesRef = useRef<Vehicle[]>(
    DESTINATIONS.map((_, i) => ({
      t: i / DESTINATIONS.length,
      speed: 0.0012 + Math.random() * 0.0006,
      trail: [],
      destIndex: i,
    }))
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dotOffset = 0;

    function toCanvas(nx: number, ny: number): [number, number] {
      return [nx * canvas!.width, ny * canvas!.height];
    }

    function drawContinent(points: number[][], fill: string) {
      if (points.length < 2) return;
      ctx!.beginPath();
      const [sx, sy] = toCanvas(points[0][0], points[0][1]);
      ctx!.moveTo(sx, sy);
      for (let i = 1; i < points.length; i++) {
        const [px, py] = toCanvas(points[i][0], points[i][1]);
        ctx!.lineTo(px, py);
      }
      ctx!.closePath();
      ctx!.fillStyle = fill;
      ctx!.fill();
      ctx!.strokeStyle = 'rgba(100, 140, 200, 0.4)';
      ctx!.lineWidth = 0.8;
      ctx!.stroke();
    }

    function draw() {
      const W = canvas!.width;
      const H = canvas!.height;

      // Background
      ctx!.fillStyle = '#0a0f1e';
      ctx!.fillRect(0, 0, W, H);

      // Dot grid
      dotOffset = (dotOffset + 0.3) % 20;
      ctx!.fillStyle = 'rgba(100, 130, 180, 0.08)';
      for (let x = dotOffset % 20; x < W; x += 20) {
        for (let y = dotOffset % 20; y < H; y += 20) {
          ctx!.beginPath();
          ctx!.arc(x, y, 1, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      // Draw continents
      const usaFill = USA_STATUS_COLORS[usStatus] ?? USA_STATUS_COLORS.unknown;
      drawContinent(CONTINENTS.northAmerica, usaFill);
      drawContinent(CONTINENTS.southAmerica, 'rgba(60, 100, 160, 0.25)');
      drawContinent(CONTINENTS.europe, 'rgba(60, 100, 160, 0.25)');
      drawContinent(CONTINENTS.africa, 'rgba(60, 100, 160, 0.25)');
      drawContinent(CONTINENTS.asia, 'rgba(60, 100, 160, 0.25)');
      drawContinent(CONTINENTS.australia, 'rgba(60, 100, 160, 0.25)');

      // Draw routes (bezier curves)
      const jp = toCanvas(JAPAN[0], JAPAN[1]);
      DESTINATIONS.forEach((dest) => {
        const dp = toCanvas(dest.pos[0], dest.pos[1]);
        const cp = controlPoint(
          [JAPAN[0], JAPAN[1]],
          dest.pos
        );
        const cpCanvas = toCanvas(cp[0], cp[1]);

        ctx!.beginPath();
        ctx!.moveTo(jp[0], jp[1]);
        ctx!.quadraticCurveTo(cpCanvas[0], cpCanvas[1], dp[0], dp[1]);
        ctx!.strokeStyle = 'rgba(100, 180, 255, 0.15)';
        ctx!.lineWidth = 1;
        ctx!.setLineDash([4, 4]);
        ctx!.stroke();
        ctx!.setLineDash([]);
      });

      // Update and draw vehicles
      vehiclesRef.current.forEach((v) => {
        v.t += v.speed;
        if (v.t > 1) v.t -= 1;

        const dest = DESTINATIONS[v.destIndex];
        const cp = controlPoint([JAPAN[0], JAPAN[1]], dest.pos);
        const [nx, ny] = bezierPoint(v.t, [JAPAN[0], JAPAN[1]], cp, dest.pos);
        const [cx, cy] = toCanvas(nx, ny);

        v.trail.push([cx, cy]);
        if (v.trail.length > 20) v.trail.shift();

        // Draw trail
        for (let i = 1; i < v.trail.length; i++) {
          const alpha = (i / v.trail.length) * 0.6;
          ctx!.beginPath();
          ctx!.moveTo(v.trail[i - 1][0], v.trail[i - 1][1]);
          ctx!.lineTo(v.trail[i][0], v.trail[i][1]);
          ctx!.strokeStyle = `rgba(100, 220, 255, ${alpha})`;
          ctx!.lineWidth = 1.5;
          ctx!.stroke();
        }

        // Draw triangle (plane)
        const [prevNx, prevNy] = v.trail.length > 1
          ? v.trail[v.trail.length - 2]
          : [cx - 1, cy];
        const angle = Math.atan2(cy - prevNy, cx - prevNx);
        const size = 5;
        ctx!.save();
        ctx!.translate(cx, cy);
        ctx!.rotate(angle);
        ctx!.beginPath();
        ctx!.moveTo(size, 0);
        ctx!.lineTo(-size, -size * 0.6);
        ctx!.lineTo(-size, size * 0.6);
        ctx!.closePath();
        ctx!.fillStyle = 'rgba(150, 230, 255, 0.9)';
        ctx!.fill();
        ctx!.restore();
      });

      // Japan origin dot with glow
      const [jx, jy] = jp;
      const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 500);
      const grad = ctx!.createRadialGradient(jx, jy, 0, jx, jy, 18 * pulse);
      grad.addColorStop(0, 'rgba(255, 210, 50, 0.9)');
      grad.addColorStop(0.4, 'rgba(255, 180, 20, 0.4)');
      grad.addColorStop(1, 'rgba(255, 160, 0, 0)');
      ctx!.beginPath();
      ctx!.arc(jx, jy, 18 * pulse, 0, Math.PI * 2);
      ctx!.fillStyle = grad;
      ctx!.fill();
      ctx!.beginPath();
      ctx!.arc(jx, jy, 4, 0, Math.PI * 2);
      ctx!.fillStyle = '#ffd700';
      ctx!.fill();

      animRef.current = requestAnimationFrame(draw);
    }

    function resize() {
      canvas!.width = canvas!.offsetWidth;
      canvas!.height = canvas!.offsetHeight;
    }

    resize();
    window.addEventListener('resize', resize);
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [usStatus]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: 'clamp(250px, 35vw, 400px)',
        display: 'block',
        borderRadius: '12px',
      }}
    />
  );
}
