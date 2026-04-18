'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

type RadarItem = {
  symbol: string;
  displaySymbol: string;
  direction: string;
  score: number;
  confidence: number;
  lastPrice: number;
  changePct: number;
  quoteVolume: string;
  trades: number;
  market: string;
};

type AlertItem = {
  symbol: string;
  displaySymbol: string;
  direction: string;
  miniAlarm: string;
  pressure: string;
  price: number;
  changePct: number;
  fundingRatePct: number;
  basisBps: number;
};

type AlarmCenterResponse = {
  market: string;
  hot: RadarItem[];
  alerts: AlertItem[];
  radar: RadarItem[];
};

type SystemStatus = {
  ok: boolean;
  activeSignals: number;
  streams: {
    market: string;
    public: string;
  };
};

type AlarmOverview = {
  lastLiquidation: {
    displaySymbol: string;
    miniAlarm: string;
    validation: string;
  } | null;
};

function alarmClass(alarm: string) {
  if (alarm === 'LIKIDITE ALARMI') return 'short';
  if (alarm === 'LONG BASKI') return 'long';
  if (alarm === 'SHORT BASKI') return 'short';
  if (alarm === 'TUREV GERILIMI') return 'ai';
  return 'whale';
}

function pressureClass(pressure: string) {
  if (pressure === 'alim baskisi') return 'long';
  if (pressure === 'satis baskisi') return 'short';
  return 'whale';
}

export default function HomePage() {
  const [data, setData] = useState<AlarmCenterResponse | null>(null);
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [history, setHistory] = useState<AlarmOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState('-');

  useEffect(() => {
    let cancelled = false;

    const load = (first = false) => {
      if (first) setLoading(true);

      Promise.all([
        fetch(`${API_BASE}/alarm-center`, { cache: 'no-store' }).then((r) => r.json()),
        fetch(`${API_BASE}/system-status`, { cache: 'no-store' }).then((r) => r.json()),
        fetch(`${API_BASE}/alarm-history?limit=10`, { cache: 'no-store' }).then((r) => r.json()),
      ])
        .then(([alarmCenter, sys, hist]) => {
          if (!cancelled) {
            setData(alarmCenter);
            setSystem(sys);
            setHistory(hist);
            setLastRefresh(new Date().toLocaleTimeString('tr-TR'));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setData(null);
            setSystem(null);
            setHistory(null);
          }
        })
        .finally(() => {
          if (!cancelled && first) setLoading(false);
        });
    };

    load(true);
    const timer = setInterval(() => load(false), 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const hot = data?.hot ?? [];
  const alerts = data?.alerts ?? [];
  const radar = data?.radar ?? [];

  return (
    <main>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 18,
        }}
      >
        <div>
          <h2 className="ttook-section-title" style={{ margin: 0 }}>
            Alarm Merkezi
          </h2>
          <div className="ttook-subtitle">
            Futures USDT.P radar + mini alarm + en sıcak coin ekranı
          </div>
        </div>

        <div className="ttook-muted">
          Oto yenileme: <strong>5 sn</strong> · Son yenileme: <strong>{lastRefresh}</strong>
        </div>
      </div>

      {loading ? (
        <div className="ttook-card">
          <div className="ttook-muted">Alarm merkezi yükleniyor...</div>
        </div>
      ) : (
        <>
          <div className="ttook-stat-grid">
            <div className="ttook-card">
              <div className="ttook-card-title">API</div>
              <div className={`ttook-pill ${system?.ok ? 'long' : 'short'}`}>
                {system?.ok ? 'AYAKTA' : 'HATA'}
              </div>
            </div>

            <div className="ttook-card">
              <div className="ttook-card-title">Aktif Sinyaller</div>
              <div className="ttook-pill ai">{system?.activeSignals ?? 0}</div>
            </div>

            <div className="ttook-card">
              <div className="ttook-card-title">Stream Durumu</div>
              <div className={`ttook-pill ${system?.streams?.market === 'open' ? 'long' : 'short'}`}>
                Market: {system?.streams?.market ?? '-'}
              </div>
              <div className={`ttook-pill ${system?.streams?.public === 'open' ? 'long' : 'short'}`} style={{ marginLeft: 8 }}>
                Public: {system?.streams?.public ?? '-'}
              </div>
            </div>

            <div className="ttook-card">
              <div className="ttook-card-title">Son Liquidation</div>
              {history?.lastLiquidation ? (
                <>
                  <div className={`ttook-pill ${alarmClass(history.lastLiquidation.miniAlarm)}`}>
                    {history.lastLiquidation.miniAlarm}
                  </div>
                  <div className="ttook-muted">
                    {history.lastLiquidation.displaySymbol} · {history.lastLiquidation.validation}
                  </div>
                </>
              ) : (
                <div className="ttook-muted">Liquidation alarmı yok</div>
              )}
            </div>
          </div>

          <div className="ttook-top-grid">
            {hot.map((item, idx) => (
              <div className="ttook-card" key={`${item.symbol}-${idx}`}>
                <div className="ttook-card-title">#{idx + 1} {item.displaySymbol}</div>

                <div className={`ttook-pill ${item.direction === 'short' ? 'short' : 'long'}`}>
                  {item.direction === 'short' ? 'SICAK SHORT' : 'SICAK LONG'}
                </div>

                <div className="ttook-muted">Son fiyat: <strong>{item.lastPrice}</strong></div>
                <div className="ttook-muted">24s değişim: <strong>{item.changePct}%</strong></div>
                <div className="ttook-muted">Skor: <strong>{item.score}</strong></div>
                <div className="ttook-muted">Güven: <strong>%{item.confidence}</strong></div>

                <div className="ttook-action-row">
                  <Link href={`/chart?market=futures&symbol=${item.symbol}`} className="ttook-nav-link">
                    Grafiğe git
                  </Link>
                  <Link href={`/ai?symbol=${item.symbol}`} className="ttook-nav-link">
                    AI Odası
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 18 }}>
            <h3 className="ttook-card-title" style={{ marginBottom: 12 }}>
              Mini Alarm Kartları
            </h3>

            <div className="ttook-mini-grid">
              {alerts.map((item) => (
                <div className="ttook-card" key={`${item.symbol}-${item.miniAlarm}`}>
                  <div className="ttook-card-title">{item.displaySymbol}</div>

                  <div className={`ttook-pill ${alarmClass(item.miniAlarm)}`}>
                    {item.miniAlarm}
                  </div>

                  <div className={`ttook-pill ${pressureClass(item.pressure)}`} style={{ marginLeft: 8 }}>
                    {item.pressure}
                  </div>

                  <div className="ttook-muted">Son fiyat: <strong>{item.price}</strong></div>
                  <div className="ttook-muted">24s değişim: <strong>{item.changePct}%</strong></div>
                  <div className="ttook-muted">Funding: <strong>%{item.fundingRatePct}</strong></div>
                  <div className="ttook-muted">Basis: <strong>{item.basisBps} bps</strong></div>

                  <div className="ttook-action-row">
                    <Link href={`/chart?market=futures&symbol=${item.symbol}`} className="ttook-nav-link">
                      Grafiğe git
                    </Link>
                    <Link href={`/ai?symbol=${item.symbol}`} className="ttook-nav-link">
                      AI Odası
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="ttook-card-title" style={{ marginBottom: 12 }}>
              Radar
            </h3>

            <div className="ttook-grid">
              {radar.map((item) => (
                <div className="ttook-card" key={`${item.symbol}-${item.direction}`}>
                  <div className="ttook-card-title">{item.displaySymbol}</div>

                  <div className={`ttook-pill ${item.direction === 'short' ? 'short' : 'long'}`}>
                    {item.direction}
                  </div>

                  <div className="ttook-pill ai" style={{ marginLeft: 8 }}>
                    FUTURES
                  </div>

                  <div className="ttook-muted">Son fiyat: <strong>{item.lastPrice}</strong></div>
                  <div className="ttook-muted">24s değişim: <strong>{item.changePct}%</strong></div>
                  <div className="ttook-muted">Hacim: <strong>{item.quoteVolume}</strong></div>
                  <div className="ttook-muted">İşlem sayısı: <strong>{item.trades}</strong></div>
                  <div className="ttook-muted">Skor: <strong>{item.score}</strong></div>
                  <div className="ttook-muted">Güven: <strong>%{item.confidence}</strong></div>

                  <div className="ttook-action-row">
                    <Link href={`/chart?market=futures&symbol=${item.symbol}`} className="ttook-nav-link">
                      Grafiğe git
                    </Link>
                    <Link href={`/ai?symbol=${item.symbol}`} className="ttook-nav-link">
                      AI Odası
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
