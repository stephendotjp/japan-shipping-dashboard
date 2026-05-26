'use client';

import { useEffect, useState } from 'react';

const JAPAN: [number, number] = [139.7, 35.7];

const DESTINATIONS: {
  name: string;
  coords: [number, number];
  duration: string;
  delay: string;
}[] = [
  { name: 'Los Angeles', coords: [-118.2, 34.1], duration: '3.0s', delay: '0s' },
  { name: 'London',      coords: [-0.1,   51.5], duration: '4.2s', delay: '0.6s' },
  { name: 'Singapore',   coords: [103.8,   1.3], duration: '2.6s', delay: '1.0s' },
  { name: 'Sydney',      coords: [151.2, -33.9], duration: '3.6s', delay: '1.4s' },
  { name: 'Dubai',       coords: [55.3,   25.2], duration: '3.2s', delay: '0.3s' },
];

interface MapPaths {
  countries: string[];
  japanPath: string;
  arcs: string[];
  japanXY: [number, number];
  destXYs: [number, number][];
  graticulePath: string;
}

export default function WorldMap() {
  const [mapData, setMapData] = useState<MapPaths | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d3, topo, worldJson] = await Promise.all([
          import('d3'),
          import('topojson-client'),
          fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r => r.json()),
        ]);

        if (cancelled) return;

        const W = 1400, H = 220;
        const projection = d3.geoNaturalEarth1()
          .fitExtent([[8, 8], [W - 8, H - 8]], { type: 'Sphere' } as any);
        const pathGen = d3.geoPath(projection);

        const graticulePath = pathGen(d3.geoGraticule()()) ?? '';
        const countries = topo.feature(worldJson, (worldJson as any).objects.countries) as any;

        const countryPaths: string[] = [];
        let japanPath = '';

        for (const f of countries.features) {
          const d = pathGen(f) ?? '';
          if (!d) continue;
          if (String(f.id) === '392') japanPath = d;
          else countryPaths.push(d);
        }

        const arcs = DESTINATIONS.map(({ coords }) => {
          const d = pathGen({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [JAPAN, coords] },
            properties: {},
          } as any) ?? '';
          return d;
        });

        const japanXY = projection(JAPAN) as [number, number];
        const destXYs = DESTINATIONS.map(({ coords }) => projection(coords) as [number, number]);

        setMapData({ countries: countryPaths, japanPath, arcs, japanXY, destXYs, graticulePath });
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ background: '#fff', borderBottom: '1px solid var(--border)' }}>
      <svg
        viewBox="0 0 1400 220"
        style={{ width: '100%', height: '220px', display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Ocean */}
        <rect width="1400" height="220" fill="#1C2A3A" />

        {!mapData && !error && (
          <text x="700" y="115" textAnchor="middle" fill="rgba(255,255,255,0.15)"
            fontSize="11" fontFamily="var(--font-mono, monospace)" letterSpacing="0.1em">
            LOADING MAP DATA
          </text>
        )}

        {error && (
          <text x="700" y="115" textAnchor="middle" fill="rgba(255,255,255,0.2)"
            fontSize="11" fontFamily="var(--font-mono, monospace)" letterSpacing="0.1em">
            MAP UNAVAILABLE
          </text>
        )}

        {mapData && (
          <>
            {/* Graticule */}
            <path d={mapData.graticulePath} fill="none"
              stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />

            {/* Countries */}
            {mapData.countries.map((d, i) => (
              <path key={i} d={d} fill="#2E4034" stroke="#1A1A18" strokeWidth="0.4" />
            ))}

            {/* Japan (highlighted) */}
            {mapData.japanPath && (
              <path d={mapData.japanPath} fill="#3A2A08" stroke="#D4A017" strokeWidth="1" />
            )}

            {/* Arcs — dashed, animated outward from Japan */}
            {mapData.arcs.map((d, i) => d && (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="#D4A017"
                strokeWidth="1"
                strokeDasharray="8 8"
                strokeOpacity="0.55"
                style={{
                  animation: `dashFlow ${DESTINATIONS[i].duration} linear infinite`,
                  animationDelay: DESTINATIONS[i].delay,
                }}
              />
            ))}

            {/* Destination dots */}
            {mapData.destXYs.map(([x, y], i) => (
              x && y ? (
                <circle key={i} cx={x} cy={y} r="3"
                  fill="#B8B0A8" stroke="#F5F3EF" strokeWidth="1" />
              ) : null
            ))}

            {/* Japan origin dot */}
            {mapData.japanXY && (
              <>
                <circle
                  cx={mapData.japanXY[0]} cy={mapData.japanXY[1]}
                  r="5" fill="#D4A017" stroke="#F5F3EF" strokeWidth="1.5"
                />
                <text
                  x={mapData.japanXY[0] + 9}
                  y={mapData.japanXY[1] - 7}
                  fill="#D4A017"
                  fontSize="10"
                  fontFamily="var(--font-mono, 'IBM Plex Mono', monospace)"
                  letterSpacing="0.1em"
                  fontWeight="500"
                >
                  JPN
                </text>
              </>
            )}
          </>
        )}
      </svg>
    </div>
  );
}
