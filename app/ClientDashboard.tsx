'use client';

import { useEffect, useState, useCallback } from 'react';
import CarrierCard from '@/components/CarrierCard';
import RoutingMatrix from '@/components/RoutingMatrix';
import { ParsedStatus } from '@/lib/db';

type CarrierData = (ParsedStatus & { stale: boolean; staleSince: string | null }) | null;

interface StatusResponse {
  lastUpdated: string | null;
  nextUpdate: string | null;
  carriers: Record<string, CarrierData>;
}

interface Props { initial: StatusResponse; }

const CARRIER_KEYS = ['japanpost', 'fedex', 'ups', 'dhl'];
const CARRIER_LABELS: Record<string, string> = {
  japanpost: 'Japan Post', fedex: 'FedEx', ups: 'UPS', dhl: 'DHL',
};

function formatCountdown(nextUpdate: string | null): string {
  if (!nextUpdate) return '--:--:--';
  const diff = new Date(nextUpdate).getTime() - Date.now();
  if (diff <= 0) return '00:00:00';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatJST(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }) + ' JST';
}

export default function ClientDashboard({ initial }: Props) {
  const [data, setData] = useState<StatusResponse>(initial);
  const [countdown, setCountdown] = useState('--:--:--');
  const [clock, setClock] = useState('--:--:--');
  const [triggered, setTriggered] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) setData(await res.json());
    } catch { /* retain stale data */ }
  }, []);

  // Auto-trigger a scrape if KV is empty on first load
  useEffect(() => {
    if (triggered) return;
    const empty = Object.values(initial.carriers).every(c => c === null);
    if (empty) {
      setTriggered(true);
      fetch('/api/admin/trigger', { method: 'POST' }).catch(() => {});
    }
  }, [initial.carriers, triggered]);

  // Poll for fresh data every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Countdown to next scheduled scrape
  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(data.nextUpdate));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data.nextUpdate]);

  // Live local clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setClock(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Aggregate all alerts across carriers, preserving carrier attribution
  const allAlerts: Array<{
    carrierKey: string;
    title: string;
    description: string;
    severity: string;
  }> = [];
  for (const key of CARRIER_KEYS) {
    const carrier = data.carriers[key];
    if (carrier?.activeAlerts) {
      for (const alert of carrier.activeAlerts) {
        allAlerts.push({
          carrierKey: key,
          title: alert.title,
          description: alert.description,
          severity: alert.severity,
        });
      }
    }
  }

  return (
    <div className="dash">

      {/* ── Top bar ── */}
      <div className="top-bar">
        <div className="top-bar-left">
          <div className="pulse" />
          <div>
            <div className="top-title">Japan Shipping Ops — Carrier Status</div>
            <div className="top-sub">Verified {formatJST(data.lastUpdated)} · Scrape + AI Parse</div>
          </div>
        </div>
        <div className="top-bar-right">
          <a href="/admin" className="top-admin">Admin</a>
          <div className="clock">{clock}</div>
        </div>
      </div>

      {/* ── Carrier overview ── */}
      <div className="section-label">Carrier overview</div>
      <div className="carrier-strip">
        {CARRIER_KEYS.map(key => (
          <CarrierCard key={key} carrierKey={key} data={data.carriers[key] ?? null} />
        ))}
      </div>

      {/* ── Routing matrix ── */}
      <div className="section-label">Can we ship there right now?</div>
      <RoutingMatrix carriers={data.carriers} />

      {/* ── Active alerts ── */}
      <div className="section-label">
        Active alerts{allAlerts.length > 0 ? ` (${allAlerts.length})` : ''}
      </div>

      {allAlerts.length === 0 ? (
        <div className="no-alerts">
          No active alerts — all carriers reporting normal operations.
        </div>
      ) : (
        <div className="alerts-grid">
          {allAlerts.map((a, i) => (
            <div
              key={i}
              className={`alert-card ${
                a.severity === 'critical' ? 'crit' :
                a.severity === 'warning'  ? 'warn' : 'info'
              }`}
            >
              <span className={`alert-tag tag-${a.carrierKey}`}>
                {CARRIER_LABELS[a.carrierKey]}
              </span>
              <div className="alert-head">{a.title}</div>
              {a.description && (
                <div className="alert-body">{a.description}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Legend ── */}
      <div className="legend">
        <span className="legend-label">Legend:</span>
        <span className="legend-ok">✓ Operational</span>
        <span className="legend-warn">⚠ Caution / partial</span>
        <span className="legend-no">✕ Do not ship</span>
        <span className="legend-unk">? Monitoring / no data</span>
        <span className="legend-hint">Hover dots for details</span>
      </div>

      {/* ── Footer ── */}
      <div className="footer-bar">
        <span className="footer-txt">
          Data: Firecrawl scrape + Claude AI parse · Refreshes 06:00 &amp; 18:00 JST
        </span>
        <span className="next-refresh">Next: {countdown}</span>
      </div>

    </div>
  );
}
