'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8010').replace(/\/+$/, '');

type SpotPlan = {
  enabled?: boolean;
  note?: string | null;
  buy1?: number | null;
  buy2?: number | null;
  buy3?: number | null;
  sell1?: number | null;
  sell2?: number | null;
  invalid?: number | null;
};

type FuturesPlan = {
  bias?: string | null;
  entryLow?: number | null;
  entryHigh?: number | null;
  tp1?: number | null;
  tp2?: number | null;
  tp3?: number | null;
  stop?: number | null;
};

type AiData = {
  symbol?: string;
  price?: number;
  trend?: string;
  momentum?: string;
  volatility?: string;
  supports?: number[];
  resistances?: number[];
  liquidityZones?: {
    topStopHunt?: number | null;
    bottomSweep?: number | null;
  };
  whaleLevels?: number[];
  futuresPlan?: FuturesPlan;
  spotPlan?: SpotPlan;
  aiComment?: string;
  disclaimer?: string;
};

function fmtPrice(v?: number | null) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '-';
  const n = Number(v);
  if (Math.abs(n) >= 1000) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(4);
  if (Math.abs(n) >= 0.01) return n.toFixed(5);
  return n.toFixed(8);
}

function compactLevels(values: Array<number | null | undefined>) {
  return values
    .filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)))
    .map((v) => fmtPrice(Number(v)))
    .join(' / ');
}

function sectionList(values?: number[]) {
  if (!Array.isArray(values) || values.length === 0) return <div className="ttook-muted">-</div>;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {values.map((v, i) => (
        <div key={`${v}-${i}`}>- {fmtPrice(v)}</div>
      ))}
    </div>
  );
}

function AiPageInner() {
  const searchParams = useSearchParams();
  const qpSymbol = useMemo(() => (searchParams.get('symbol') || 'BTCUSDT').toUpperCase(), [searchParams]);

  const [symbol, setSymbol] = useState(qpSymbol);
  const [input, setInput] = useState(qpSymbol);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<AiData | null>(null);

  useEffect(() => {
    setSymbol(qpSymbol);
    setInput(qpSymbol);
  }, [qpSymbol]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`${API_BASE}/ai-coin?symbol=${encodeURIComponent(symbol)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`AI endpoint failed: ${res.status}`);
        const json = await res.json();
        if (active) setData(json);
      } catch (e: any) {
        if (active) {
          setError(e?.message || 'AI verisi alınamadı');
          setData(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const timer = window.setInterval(() => {
      load();
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [symbol]);

  function applySymbol() {
    const s = input.trim().toUpperCase();
    if (!s) return;
    setSymbol(s);
    const url = new URL(window.location.href);
    url.searchParams.set('symbol', s);
    window.history.replaceState({}, '', url.toString());
  }

  return (
    <main className="ttook-page">
      <div className="ttook-hero">
        <div>
          <div className="ttook-hero-title">AI Odası</div>
          <div className="ttook-hero-subtitle">Detaylı coin yorumu • futures planı • spot planı</div>
        </div>
      </div>

      <div className="ttook-card" style={{ marginTop: 16 }}>
        <div className="ttook-card-title">Coin Analizi</div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="BTCUSDT"
            className="ttook-input"
            style={{ minWidth: 220 }}
          />
          <button className="ttook-button" onClick={applySymbol}>
            Analizle
          </button>
        </div>

        <div className="ttook-muted" style={{ marginTop: 10 }}>
          API: {API_BASE}
        </div>
      </div>

      {loading && <div className="ttook-card" style={{ marginTop: 16 }}>AI odası yükleniyor...</div>}
      {error && <div className="ttook-card" style={{ marginTop: 16 }}>Hata: {error}</div>}

      {data && (
        <>
          <div className="ttook-grid" style={{ marginTop: 16 }}>
            <div className="ttook-card">
              <div className="ttook-card-title">{data.symbol || symbol}</div>
              <div style={{ marginTop: 10 }}>Anlık fiyat: {fmtPrice(data.price)}</div>
              <div>Trend: {data.trend || '-'}</div>
              <div>Momentum: {data.momentum || '-'}</div>
              <div>Volatilite: {data.volatility || '-'}</div>
            </div>

            <div className="ttook-card">
              <div className="ttook-card-title">Likidite</div>
              <div style={{ marginTop: 10 }}>Üstte stop avı: {fmtPrice(data.liquidityZones?.topStopHunt)}</div>
              <div>Altta süpürme: {fmtPrice(data.liquidityZones?.bottomSweep)}</div>
            </div>
          </div>

          <div className="ttook-grid" style={{ marginTop: 16 }}>
            <div className="ttook-card">
              <div className="ttook-card-title">🧱 Destekler</div>
              <div style={{ marginTop: 10 }}>{sectionList(data.supports)}</div>
            </div>

            <div className="ttook-card">
              <div className="ttook-card-title">🚧 Dirençler</div>
              <div style={{ marginTop: 10 }}>{sectionList(data.resistances)}</div>
            </div>
          </div>

          <div className="ttook-card" style={{ marginTop: 16 }}>
            <div className="ttook-card-title">🐋 Balina Seviyeleri</div>
            <div style={{ marginTop: 10 }}>{sectionList(data.whaleLevels)}</div>
          </div>

          <div className="ttook-card" style={{ marginTop: 16 }}>
            <div className="ttook-card-title">🎯 Futures Planı</div>
            <div style={{ marginTop: 10 }}>Bias: {data.futuresPlan?.bias || '-'}</div>
            <div>
              Giriş alanı:{' '}
              {compactLevels([data.futuresPlan?.entryLow, data.futuresPlan?.entryHigh]) || '-'}
            </div>
            <div>
              TP:{' '}
              {compactLevels([data.futuresPlan?.tp1, data.futuresPlan?.tp2, data.futuresPlan?.tp3]) || '-'}
            </div>
            <div>Stop: {fmtPrice(data.futuresPlan?.stop)}</div>
          </div>

          {data.spotPlan && (
            <div className="ttook-card" style={{ marginTop: 16 }}>
              <div className="ttook-card-title">💼 Spot Planı</div>

              {data.spotPlan.enabled ? (
                <>
                  <div style={{ marginTop: 10 }}>
                    - Kademeli alım:{' '}
                    {compactLevels([data.spotPlan.buy1, data.spotPlan.buy2, data.spotPlan.buy3]) || '-'}
                  </div>
                  <div>
                    - Kar alma:{' '}
                    {compactLevels([data.spotPlan.sell1, data.spotPlan.sell2]) || '-'}
                  </div>
                  <div>- Yapı bozulursa dikkat: {fmtPrice(data.spotPlan.invalid)}</div>
                </>
              ) : (
                <>
                  <div style={{ marginTop: 10 }}>
                    - {data.spotPlan.note || 'Spot plan net değil, uygun yapı bulunamadı.'}
                  </div>

                  {compactLevels([data.spotPlan.buy1, data.spotPlan.buy2, data.spotPlan.buy3]) ? (
                    <div>
                      - İzleme alımı:{' '}
                      {compactLevels([data.spotPlan.buy1, data.spotPlan.buy2, data.spotPlan.buy3])}
                    </div>
                  ) : null}

                  <div>- Yapı bozulursa dikkat: {fmtPrice(data.spotPlan.invalid)}</div>
                </>
              )}
            </div>
          )}

          <div className="ttook-card" style={{ marginTop: 16 }}>
            <div className="ttook-card-title">😄 AI Yorumu</div>
            <div style={{ marginTop: 10 }}>{data.aiComment || 'Yorum üretilmedi.'}</div>
          </div>

          <div className="ttook-card" style={{ marginTop: 16 }}>
            <div className="ttook-card-title">⚠️ Not</div>
            <div style={{ marginTop: 10 }}>
              {data.disclaimer || 'Bu finansal tavsiye değildir. Eğitim amaçlı AI yorumudur.'}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

export default function AiPage() {
  return (
    <Suspense
      fallback={
        <main className="ttook-page">
          <div className="ttook-card">AI odası yükleniyor...</div>
        </main>
      }
    >
      <AiPageInner />
    </Suspense>
  );
}
