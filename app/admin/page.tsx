'use client';

import { useEffect, useState } from 'react';
import { ParsedStatus } from '@/lib/db';

const CARRIER_KEYS = ['japanpost', 'fedex', 'ups', 'dhl'];
const CARRIER_NAMES: Record<string, string> = {
  japanpost: 'Japan Post', fedex: 'FedEx', ups: 'UPS', dhl: 'DHL',
};

interface HistoryEntry {
  timestamp: string;
  success: boolean;
  error?: string;
  botBlocked?: boolean;
  contentLength?: number;
  confidence?: string;
}

interface StatusData extends ParsedStatus {
  stale: boolean;
  staleSince: string | null;
}

interface StatusResponse {
  lastUpdated: string | null;
  nextUpdate: string | null;
  carriers: Record<string, StatusData | null>;
}

function formatJST(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'Asia/Tokyo',
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }) + ' JST';
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#ccc', padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
          fontSize: '0.8rem', width: '100%', textAlign: 'left',
        }}
      >
        {open ? '▼' : '▶'} {title}
      </button>
      {open && (
        <pre style={{
          background: '#0d1526', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '0 0 6px 6px', padding: 12, overflowX: 'auto',
          fontSize: '0.72rem', color: '#9cf', margin: 0, maxHeight: 400,
        }}>
          {children}
        </pre>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [histories, setHistories] = useState<Record<string, HistoryEntry[]>>({});
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<string | null>(null);

  async function loadData() {
    const [statusRes, ...historyRes] = await Promise.all([
      fetch('/api/status').then((r) => r.json()),
      ...CARRIER_KEYS.map((k) =>
        fetch(`/api/admin/history?carrier=${k}`).then((r) => r.json()).catch(() => [])
      ),
    ]);
    setStatus(statusRes);
    const h: Record<string, HistoryEntry[]> = {};
    CARRIER_KEYS.forEach((k, i) => { h[k] = historyRes[i] ?? []; });
    setHistories(h);
  }

  useEffect(() => { loadData(); }, []);

  async function triggerScrape() {
    setScraping(true);
    setScrapeResult(null);
    try {
      const res = await fetch('/api/admin/trigger', { method: 'POST' });
      const json = await res.json();
      setScrapeResult(JSON.stringify(json, null, 2));
      await loadData();
    } catch (e) {
      setScrapeResult(String(e));
    } finally {
      setScraping(false);
    }
  }

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', color: '#fff', fontFamily: 'monospace', padding: 24 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Admin Panel</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <a href="/" style={{ color: '#4a9eff', fontSize: '0.8rem' }}>← Dashboard</a>
            <button
              onClick={triggerScrape}
              disabled={scraping}
              style={{
                background: scraping ? '#333' : '#1a4a8a',
                border: '1px solid #2a5aaa',
                color: '#fff', padding: '8px 16px', borderRadius: 6,
                cursor: scraping ? 'not-allowed' : 'pointer', fontSize: '0.85rem',
              }}
            >
              {scraping ? 'Scraping...' : 'Trigger Scrape Now'}
            </button>
          </div>
        </div>

        {status && (
          <div style={{ marginBottom: 16, fontSize: '0.8rem', color: '#888' }}>
            Last run: {status.lastUpdated ? formatJST(status.lastUpdated) : 'Never'} |{' '}
            Next run: {status.nextUpdate ? formatJST(status.nextUpdate) : 'Unknown'}
          </div>
        )}

        {scrapeResult && (
          <pre style={{
            background: '#0d1526', border: '1px solid #2a5aaa', borderRadius: 8,
            padding: 12, fontSize: '0.75rem', color: '#9cf', marginBottom: 20, overflowX: 'auto',
          }}>
            {scrapeResult}
          </pre>
        )}

        {CARRIER_KEYS.map((key) => {
          const d = status?.carriers[key];
          const history = histories[key] ?? [];
          return (
            <div key={key} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: 16, marginBottom: 16,
            }}>
              <h2 style={{ margin: '0 0 12px', fontSize: '1rem' }}>{CARRIER_NAMES[key]}</h2>

              {d ? (
                <>
                  <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 10 }}>
                    Confidence: <span style={{ color: '#fff' }}>{d.confidence}</span> |{' '}
                    Content length: <span style={{ color: '#fff' }}>{d.scrapedContentLength} chars</span>
                  </div>
                  <Collapsible title="Parsed JSON">
                    {JSON.stringify(d, null, 2)}
                  </Collapsible>
                  <Collapsible title="Raw Summary">
                    {d.rawSummary}
                  </Collapsible>
                </>
              ) : (
                <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 10 }}>No data yet</div>
              )}

              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 6 }}>
                  Scrape history (last {history.length} runs):
                </div>
                {history.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: '#555' }}>No history</div>
                ) : (
                  history.map((h, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 10, fontSize: '0.72rem',
                      color: h.success ? '#00c48c' : '#ff4757',
                      padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <span style={{ color: '#888', minWidth: 160 }}>{formatJST(h.timestamp)}</span>
                      <span>{h.success ? '✓ OK' : `✗ ${h.botBlocked ? 'bot_blocked' : (h.error ?? 'error')}`}</span>
                      {h.success && <span style={{ color: '#666' }}>
                        {h.confidence} | {h.contentLength} chars
                      </span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
