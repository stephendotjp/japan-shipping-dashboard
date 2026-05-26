'use client';

import { useEffect, useState } from 'react';

const JAPAN: [number, number] = [139.7, 35.7];

const DESTINATIONS: {
  name: string;
  coords: [number, number];
  duration: string;
  delay: string;
}[] = [
  { name: 'Los Angeles', coords: [-118.2, 34.1], duration: '5.0s', delay: '0s' },
  { name: 'London',      coords: [-0.1,   51.5], duration: '7.2s', delay: '1.0s' },
  { name: 'Singapore',   coords: [103.8,   1.3], duration: '4.4s', delay: '1.8s' },
  { name: 'Sydney',      coords: [151.2, -33.9], duration: '6.2s', delay: '2.4s' },
  { name: 'Dubai',       coords: [55.3,   25.2], duration: '5.4s', delay: '0.5s' },
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

        const W = 1400, H = 450;
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
    <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', height: '100%' }}>
      <svg
        viewBox="0 0 1400 450"
        style={{ width: '100%', height: '100%', display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Ocean — institutional pale teal, like a government document map */}
        <rect width="1400" height="450" fill="#BEC8CA" />

        {!mapData && !error && (
          <text x="700" y="115" textAnchor="middle" fill="#9A9490"
            fontSize="11" fontFamily="var(--font-mono, monospace)" letterSpacing="0.12em">
            LOADING MAP DATA
          </text>
        )}

        {error && (
          <text x="700" y="115" textAnchor="middle" fill="#9A9490"
            fontSize="11" fontFamily="var(--font-mono, monospace)" letterSpacing="0.12em">
            MAP UNAVAILABLE
          </text>
        )}

        {mapData && (
          <>
            {/* Graticule */}
            <path d={mapData.graticulePath} fill="none"
              stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />

            {/* Countries */}
            {mapData.countries.map((d, i) => (
              <path key={i} d={d} fill="#A8B4B0" stroke="#8E9E9A" strokeWidth="0.5" />
            ))}

            {/* Japan (highlighted) */}
            {mapData.japanPath && (
              <path d={mapData.japanPath} fill="#7A6A30" stroke="#A08A42" strokeWidth="1" />
            )}

            {/* Arcs — dashed, slow deliberate flow outward from Japan */}
            {mapData.arcs.map((d, i) => d && (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="#A08A42"
                strokeWidth="1"
                strokeDasharray="6 10"
                strokeOpacity="0.65"
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
                  fill="#8A8480" stroke="#EDEAE2" strokeWidth="1" />
              ) : null
            ))}

            {/* Japan origin dot */}
            {mapData.japanXY && (
              <>
                <circle
                  cx={mapData.japanXY[0]} cy={mapData.japanXY[1]}
                  r="5" fill="#A08A42" stroke="#EDEAE2" strokeWidth="1.5"
                />
                <text
                  x={mapData.japanXY[0] + 9}
                  y={mapData.japanXY[1] - 7}
                  fill="#A08A42"
                  fontSize="10"
                  fontFamily="var(--font-mono, 'IBM Plex Mono', monospace)"
                  letterSpacing="0.12em"
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
