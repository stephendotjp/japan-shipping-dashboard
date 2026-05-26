'use client';

import { useRef, useEffect } from 'react';

interface GlobeProps {
  usStatus: 'operational' | 'partial' | 'suspended' | 'unknown';
}

// Continent outlines as [lat, lng] arrays
const CONTINENTS: [number, number][][] = [
  // North America
  [[71,-166],[64,-168],[55,-163],[57,-135],[49,-124],[45,-124],[37,-122],[32,-117],[29,-110],
   [22,-106],[15,-92],[15,-87],[9,-79],[7,-77],[10,-75],[20,-87],[25,-80],[30,-81],
   [35,-75],[42,-70],[47,-53],[52,-55],[58,-62],[63,-68],[63,-73],[68,-80],[72,-85],
   [72,-105],[68,-130],[70,-145],[71,-166]],
  // South America
  [[12,-72],[10,-62],[5,-52],[0,-51],[-5,-35],[-10,-37],[-23,-43],[-30,-51],[-34,-53],
   [-42,-64],[-55,-68],[-56,-65],[-42,-63],[-25,-49],[-15,-76],[-5,-81],[0,-78],
   [5,-77],[12,-72]],
  // Europe
  [[71,28],[68,18],[65,14],[58,5],[51,2],[48,-5],[43,-9],[36,-9],[36,-5],[37,0],
   [40,3],[43,3],[44,8],[38,15],[38,24],[42,28],[44,29],[47,38],[47,32],
   [53,28],[54,18],[56,21],[58,25],[60,25],[65,25],[71,28]],
  // Africa
  [[37,-5],[37,10],[30,32],[22,37],[15,42],[12,43],[0,42],[-5,40],[-10,40],
   [-25,33],[-35,20],[-35,18],[-27,15],[-5,10],[4,2],[5,-5],[15,-17],
   [25,-17],[30,-10],[33,-8],[37,-5]],
  // Asia (main)
  [[71,30],[71,60],[65,65],[55,50],[50,53],[43,51],[38,45],[25,57],[22,65],
   [10,77],[8,77],[0,103],[-5,105],[5,103],[15,110],[20,110],[22,114],
   [25,121],[28,121],[32,122],[35,126],[38,128],[42,130],[45,135],[48,142],
   [52,142],[55,135],[55,120],[60,100],[65,90],[68,68],[71,58],[71,30]],
  // Australia
  [[-14,130],[-20,122],[-26,114],[-32,116],[-35,118],[-38,140],[-38,147],
   [-35,150],[-28,154],[-22,150],[-14,144],[-12,135],[-14,130]],
  // Greenland
  [[60,-44],[64,-53],[68,-54],[72,-55],[76,-60],[83,-35],[83,-25],
   [76,-18],[70,-22],[65,-37],[60,-44]],
];

// North America polygon (for USA status coloring)
const NORTH_AMERICA = CONTINENTS[0];

const JAPAN: [number, number] = [35, 135];
const DESTINATIONS: { name: string; pos: [number, number] }[] = [
  { name: 'Los Angeles', pos: [34, -118] },
  { name: 'London', pos: [51, -0] },
  { name: 'Singapore', pos: [1, 103] },
  { name: 'Sydney', pos: [-33, 151] },
  { name: 'Dubai', pos: [25, 55] },
];

const STATUS_FILL: Record<string, string> = {
  operational: 'rgba(0, 196, 140, 0.35)',
  partial:     'rgba(255, 193, 7, 0.35)',
  suspended:   'rgba(255, 71, 87, 0.35)',
  unknown:     'rgba(80, 100, 130, 0.2)',
};
const STATUS_STROKE: Record<string, string> = {
  operational: 'rgba(0, 230, 160, 0.6)',
  partial:     'rgba(255, 210, 60, 0.6)',
  suspended:   'rgba(255, 90, 90, 0.6)',
  unknown:     'rgba(100, 130, 180, 0.3)',
};

const TO_RAD = Math.PI / 180;

function project(lat: number, lng: number, centerLng: number, cx: number, cy: number, r: number) {
  const phi = lat * TO_RAD;
  const lam = (lng - centerLng) * TO_RAD;
  const x = Math.cos(phi) * Math.sin(lam);
  const y = -Math.sin(phi);
  const z = Math.cos(phi) * Math.cos(lam);
  return { sx: cx + r * x, sy: cy + r * y, z };
}

function slerp(lat1: number, lng1: number, lat2: number, lng2: number, t: number): [number, number] {
  const p1 = lat1 * TO_RAD, l1 = lng1 * TO_RAD;
  const p2 = lat2 * TO_RAD, l2 = lng2 * TO_RAD;
  const ax = Math.cos(p1) * Math.cos(l1), ay = Math.cos(p1) * Math.sin(l1), az = Math.sin(p1);
  const bx = Math.cos(p2) * Math.cos(l2), by = Math.cos(p2) * Math.sin(l2), bz = Math.sin(p2);
  const dot = Math.min(1, Math.max(-1, ax * bx + ay * by + az * bz));
  const angle = Math.acos(dot);
  if (angle < 0.0001) return [lat1, lng1];
  const sa = Math.sin(angle);
  const f1 = Math.sin((1 - t) * angle) / sa;
  const f2 = Math.sin(t * angle) / sa;
  const cx_ = f1 * ax + f2 * bx, cy_ = f1 * ay + f2 * by, cz_ = f1 * az + f2 * bz;
  return [Math.atan2(cz_, Math.sqrt(cx_ * cx_ + cy_ * cy_)) / TO_RAD, Math.atan2(cy_, cx_) / TO_RAD];
}

interface Dot {
  t: number;
  speed: number;
  trail: [number, number][];
  destIdx: number;
}

export default function Globe({ usStatus }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const rotRef = useRef<number>(135); // start centered on Japan
  const dotsRef = useRef<Dot[]>(
    DESTINATIONS.map((_, i) => ({
      t: i / DESTINATIONS.length,
      speed: 0.0018 + Math.random() * 0.001,
      trail: [],
      destIdx: i,
    }))
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize() {
      canvas!.width = canvas!.offsetWidth;
      canvas!.height = canvas!.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function drawPolygon(
      points: [number, number][],
      centerLng: number,
      cx: number, cy: number, r: number,
      fillStyle: string, strokeStyle: string, lw = 0.6
    ) {
      ctx!.beginPath();
      let penDown = false;
      for (const [lat, lng] of points) {
        const p = project(lat, lng, centerLng, cx, cy, r);
        if (p.z >= -0.08) {
          if (!penDown) { ctx!.moveTo(p.sx, p.sy); penDown = true; }
          else ctx!.lineTo(p.sx, p.sy);
        } else {
          penDown = false;
        }
      }
      ctx!.closePath();
      ctx!.fillStyle = fillStyle;
      ctx!.fill();
      ctx!.strokeStyle = strokeStyle;
      ctx!.lineWidth = lw;
      ctx!.stroke();
    }

    function drawArc(
      lat1: number, lng1: number, lat2: number, lng2: number,
      centerLng: number, cx: number, cy: number, r: number,
      color: string, lw: number, dash: number[]
    ) {
      const steps = 80;
      ctx!.beginPath();
      ctx!.setLineDash(dash);
      ctx!.strokeStyle = color;
      ctx!.lineWidth = lw;
      let penDown = false;
      for (let i = 0; i <= steps; i++) {
        const [lat, lng] = slerp(lat1, lng1, lat2, lng2, i / steps);
        const p = project(lat, lng, centerLng, cx, cy, r);
        if (p.z >= 0) {
          if (!penDown) { ctx!.moveTo(p.sx, p.sy); penDown = true; }
          else ctx!.lineTo(p.sx, p.sy);
        } else {
          penDown = false;
        }
      }
      ctx!.stroke();
      ctx!.setLineDash([]);
    }

    function frame() {
      const W = canvas!.width;
      const H = canvas!.height;
      const cx = W / 2;
      const cy = H / 2;
      const r = Math.min(W, H) * 0.46;

      // Slowly rotate globe
      rotRef.current -= 0.04; // degrees per frame (~7s per revolution at 60fps)

      const cLng = rotRef.current;

      // ── Background ──
      ctx!.fillStyle = '#020812';
      ctx!.fillRect(0, 0, W, H);

      // Stars
      ctx!.fillStyle = 'rgba(255,255,255,0.55)';
      // Use deterministic star positions based on canvas size
      const seed = W * 1000 + H;
      for (let i = 0; i < 120; i++) {
        const sx = ((Math.sin(seed + i * 137.5) + 1) / 2) * W;
        const sy = ((Math.cos(seed + i * 97.3) + 1) / 2) * H;
        const inside = (sx - cx) ** 2 + (sy - cy) ** 2 < (r + 20) ** 2;
        if (!inside) {
          const sz = 0.5 + ((Math.sin(i * 53) + 1) / 2) * 1.2;
          ctx!.beginPath();
          ctx!.arc(sx, sy, sz, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      // ── Atmosphere glow ──
      const atm = ctx!.createRadialGradient(cx, cy, r * 0.95, cx, cy, r * 1.12);
      atm.addColorStop(0, 'rgba(40, 130, 255, 0.25)');
      atm.addColorStop(0.5, 'rgba(20, 80, 200, 0.1)');
      atm.addColorStop(1, 'rgba(0, 20, 80, 0)');
      ctx!.beginPath();
      ctx!.arc(cx, cy, r * 1.12, 0, Math.PI * 2);
      ctx!.fillStyle = atm;
      ctx!.fill();

      // ── Ocean sphere ──
      const ocean = ctx!.createRadialGradient(cx - r * 0.25, cy - r * 0.2, r * 0.1, cx, cy, r);
      ocean.addColorStop(0, '#0d2b4a');
      ocean.addColorStop(0.7, '#061828');
      ocean.addColorStop(1, '#020d1a');
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.fillStyle = ocean;
      ctx!.fill();

      // ── Clip to sphere ──
      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.clip();

      // ── Latitude/longitude grid (subtle) ──
      ctx!.strokeStyle = 'rgba(50, 100, 160, 0.12)';
      ctx!.lineWidth = 0.5;
      for (let lat = -80; lat <= 80; lat += 20) {
        ctx!.beginPath();
        let first = true;
        for (let lng = -180; lng <= 180; lng += 3) {
          const p = project(lat, lng, cLng, cx, cy, r);
          if (p.z >= 0) {
            if (first) { ctx!.moveTo(p.sx, p.sy); first = false; }
            else ctx!.lineTo(p.sx, p.sy);
          } else { first = true; }
        }
        ctx!.stroke();
      }
      for (let lng = -180; lng < 180; lng += 30) {
        ctx!.beginPath();
        let first = true;
        for (let lat = -90; lat <= 90; lat += 3) {
          const p = project(lat, lng, cLng, cx, cy, r);
          if (p.z >= 0) {
            if (first) { ctx!.moveTo(p.sx, p.sy); first = false; }
            else ctx!.lineTo(p.sx, p.sy);
          } else { first = true; }
        }
        ctx!.stroke();
      }

      // ── Continents ──
      const contFill = '#162816';
      const contStroke = 'rgba(45, 100, 45, 0.7)';
      for (const poly of CONTINENTS) {
        if (poly === NORTH_AMERICA) continue; // draw separately with status color
        drawPolygon(poly, cLng, cx, cy, r, contFill, contStroke);
      }

      // North America with status coloring
      const naFill = STATUS_FILL[usStatus] ?? STATUS_FILL.unknown;
      const naStroke = STATUS_STROKE[usStatus] ?? STATUS_STROKE.unknown;
      drawPolygon(NORTH_AMERICA, cLng, cx, cy, r, naFill, naStroke, 1.2);

      // ── Route arcs ──
      for (const dest of DESTINATIONS) {
        drawArc(
          JAPAN[0], JAPAN[1], dest.pos[0], dest.pos[1],
          cLng, cx, cy, r,
          'rgba(80, 200, 255, 0.18)', 1, [4, 6]
        );
      }

      // ── Moving dots ──
      for (const dot of dotsRef.current) {
        dot.t += dot.speed;
        if (dot.t > 1) dot.t -= 1;

        const dest = DESTINATIONS[dot.destIdx];
        const [lat, lng] = slerp(JAPAN[0], JAPAN[1], dest.pos[0], dest.pos[1], dot.t);
        const p = project(lat, lng, cLng, cx, cy, r);

        if (p.z >= 0) {
          dot.trail.push([p.sx, p.sy]);
          if (dot.trail.length > 22) dot.trail.shift();

          // Trail
          for (let i = 1; i < dot.trail.length; i++) {
            const alpha = (i / dot.trail.length) * 0.7;
            ctx!.beginPath();
            ctx!.moveTo(dot.trail[i - 1][0], dot.trail[i - 1][1]);
            ctx!.lineTo(dot.trail[i][0], dot.trail[i][1]);
            ctx!.strokeStyle = `rgba(120, 220, 255, ${alpha})`;
            ctx!.lineWidth = 1.8;
            ctx!.stroke();
          }

          // Dot head
          const glowR = ctx!.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, 5);
          glowR.addColorStop(0, 'rgba(200, 240, 255, 1)');
          glowR.addColorStop(1, 'rgba(80, 200, 255, 0)');
          ctx!.beginPath();
          ctx!.arc(p.sx, p.sy, 5, 0, Math.PI * 2);
          ctx!.fillStyle = glowR;
          ctx!.fill();
          ctx!.beginPath();
          ctx!.arc(p.sx, p.sy, 2, 0, Math.PI * 2);
          ctx!.fillStyle = '#fff';
          ctx!.fill();
        } else {
          dot.trail = [];
        }
      }

      // ── Destination dots ──
      for (const dest of DESTINATIONS) {
        const p = project(dest.pos[0], dest.pos[1], cLng, cx, cy, r);
        if (p.z >= 0) {
          ctx!.beginPath();
          ctx!.arc(p.sx, p.sy, 3, 0, Math.PI * 2);
          ctx!.fillStyle = 'rgba(100, 200, 255, 0.7)';
          ctx!.fill();
          ctx!.beginPath();
          ctx!.arc(p.sx, p.sy, 1.5, 0, Math.PI * 2);
          ctx!.fillStyle = '#fff';
          ctx!.fill();
        }
      }

      // ── Japan origin pulsing dot ──
      const jp = project(JAPAN[0], JAPAN[1], cLng, cx, cy, r);
      if (jp.z >= 0) {
        const pulse = 0.55 + 0.45 * Math.sin(Date.now() / 450);
        const gR1 = ctx!.createRadialGradient(jp.sx, jp.sy, 0, jp.sx, jp.sy, 24 * pulse);
        gR1.addColorStop(0, 'rgba(255, 200, 30, 0.9)');
        gR1.addColorStop(0.4, 'rgba(255, 140, 0, 0.4)');
        gR1.addColorStop(1, 'rgba(255, 80, 0, 0)');
        ctx!.beginPath();
        ctx!.arc(jp.sx, jp.sy, 24 * pulse, 0, Math.PI * 2);
        ctx!.fillStyle = gR1;
        ctx!.fill();

        ctx!.beginPath();
        ctx!.arc(jp.sx, jp.sy, 5, 0, Math.PI * 2);
        ctx!.fillStyle = '#ffd700';
        ctx!.fill();
        ctx!.strokeStyle = '#fff';
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }

      ctx!.restore(); // end clip

      // ── Sphere edge highlight (rim light) ──
      const rim = ctx!.createRadialGradient(cx, cy, r * 0.85, cx, cy, r);
      rim.addColorStop(0, 'rgba(0,0,0,0)');
      rim.addColorStop(0.85, 'rgba(0,0,0,0)');
      rim.addColorStop(1, 'rgba(5, 20, 60, 0.7)');
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.fillStyle = rim;
      ctx!.fill();

      animRef.current = requestAnimationFrame(frame);
    }

    frame();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [usStatus]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
