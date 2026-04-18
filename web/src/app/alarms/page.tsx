'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type AlarmItem = {
  id: number;
  symbol: string;
  displaySymbol: string;
  market: string;
  direction: string;
  miniAlarm: string;
  pressure: string;
  price: number | null;
  currentPrice: number | null;
  deltaPct: number | null;
  validation: string;
  changePct: number | null;
  fundingRatePct: number | null;
  basisBps: number | null;
  created_at: string;
  ageSec: number | null;
};

type TpEvent = {
  id: number;
  symbol: string;
  displaySymbol: string;
  market: string;
  eventType: string;
  tpLevel: number | null;
  price: number | null;
  note: string | null;
  created_at: string;
} | null;

type CloseSignal = {
  id: number;
  symbol: string;
  displaySymbol: string;
  market: string;
  direction: string;
  entry: number;
  tp1: number;
  tp2: number;
  tp3: number;
  stop: number;
  setup: string;
  updated_at: string;
} | null;

type AlarmOverview = {
  ok: boolean;
  items: AlarmItem[];
  lastLiquidation: AlarmItem | null;
  lastTpEvent: TpEvent;
  lastCloseSignal: CloseSignal;
};

function validationClass(status: string) {
  if (status === 'DOGRU') return 'long';
  if (status === 'YANLIS') return 'short';
  if (status === 'IZLEMEDE') return 'ai';
  return 'whale';
}

function alarmClass(alarm: string) {
  if (alarm === 'LIKIDITE ALARMI') return 'short';
  if (alarm === 'LONG BASKI') return 'long';
  if (alarm === 'SHORT BASKI') return 'short';
  if (alarm === 'TUREV GERILIMI') return 'ai';
  return 'whale';
}

export default function AlarmsPage() {
  const [data, setData] = useState<AlarmOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState('-');

  useEffect(() => {
    let cancelled = false;

    const load = (first = false) => {
      if (first) setLoading(true);

      fetch('http://127.0.0.1:8000/alarm-history?limit=50', { cache: 'no-store' })
        .then((res) => {
          if (!res.ok) throw new Error('Alarm geçmişi alınamadı');
          return res.json();
        })
        .then((json) => {
          if (!cancelled) {
            setData(json);
            setLastRefresh(new Date().toLocaleTimeString('tr-TR'));
          }
        })
        .catch(() => {
          if (!cancelled) setData(null);
        })
        .finally(() => {
          if (!cancelled && first) setLoading(false);
        });
    };

    load(true);
    const timer = setInterval(() => load(false), 10000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

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
            Alarm Geçmişi
          </h2>
          <div className="ttook-subtitle">
            Son 50 mini alarm + liquidation + TP + close takibi
          </div>
        </div>

        <div className="ttook-muted">
          Oto yenileme: <strong>10 sn</strong> · Son yenileme: <strong>{lastRefresh}</strong>
        </div>
      </div>

      {loading ? (
        <div className="ttook-card">
          <div className="ttook-muted">Alarm geçmişi yükleniyor...</div>
        </div>
      ) : !data ? (
        <div className="ttook-card">
          <div className="ttook-card-title">Alarm geçmişi boş</div>
          <div className="ttook-muted">Şu an alarm geçmişi verisi görünmüyor.</div>
        </div>
      ) : (
        <>
          <div className="ttook-top-grid">
            <div className="ttook-card">
              <div className="ttook-card-title">Son Liquidation Alarmı</div>
              {data.lastLiquidation ? (
                <>
                  <div className={`ttook-pill ${alarmClass(data.lastLiquidation.miniAlarm)}`}>
                    {data.lastLiquidation.miniAlarm}
                  </div>
                  <div className="ttook-muted">
                    Coin: <strong>{data.lastLiquidation.displaySymbol}</strong>
                  </div>
                  <div className="ttook-muted">
                    Durum: <strong>{data.lastLiquidation.validation}</strong>
                  </div>
                </>
              ) : (
                <div className="ttook-muted">Henüz liquidation alarmı yok.</div>
              )}
            </div>

            <div className="ttook-card">
              <div className="ttook-card-title">Son TP Event</div>
              {data.lastTpEvent ? (
                <>
                  <div className="ttook-pill long">TP{data.lastTpEvent.tpLevel ?? '?'}</div>
                  <div className="ttook-muted">
                    Coin: <strong>{data.lastTpEvent.displaySymbol}</strong>
                  </div>
                  <div className="ttook-muted">
                    Fiyat: <strong>{data.lastTpEvent.price ?? '-'}</strong>
                  </div>
                </>
              ) : (
                <div className="ttook-muted">Henüz TP event yok.</div>
              )}
            </div>

            <div className="ttook-card">
              <div className="ttook-card-title">Son Close Event</div>
              {data.lastCloseSignal ? (
                <>
                  <div className={`ttook-pill ${data.lastCloseSignal.direction === 'short' ? 'short' : 'long'}`}>
                    {data.lastCloseSignal.direction}
                  </div>
                  <div className="ttook-muted">
                    Coin: <strong>{data.lastCloseSignal.displaySymbol}</strong>
                  </div>
                  <div className="ttook-muted">
                    Setup: <strong>{data.lastCloseSignal.setup}</strong>
                  </div>
                </>
              ) : (
                <div className="ttook-muted">Henüz close event yok.</div>
              )}
            </div>

            <div className="ttook-card">
              <div className="ttook-card-title">Alarm Sayısı</div>
              <div className="ttook-pill ai">SON 50</div>
              <div className="ttook-muted">
                Kayıtlı mini alarm: <strong>{data.items.length}</strong>
              </div>
            </div>
          </div>

          <div className="ttook-grid">
            {data.items.map((item) => (
              <div className="ttook-card" key={item.id}>
                <div className="ttook-card-title">{item.displaySymbol}</div>

                <div className={`ttook-pill ${alarmClass(item.miniAlarm)}`}>{item.miniAlarm}</div>
                <div className={`ttook-pill ${validationClass(item.validation)}`} style={{ marginLeft: 8 }}>
                  {item.validation}
                </div>

                <div className="ttook-muted">Yön: <strong>{item.direction}</strong></div>
                <div className="ttook-muted">Orderbook: <strong>{item.pressure}</strong></div>
                <div className="ttook-muted">Alarm fiyatı: <strong>{item.price ?? '-'}</strong></div>
                <div className="ttook-muted">Şimdiki fiyat: <strong>{item.currentPrice ?? '-'}</strong></div>
                <div className="ttook-muted">Sonuç: <strong>{item.deltaPct ?? '-'}%</strong></div>
                <div className="ttook-muted">24s değişim: <strong>{item.changePct ?? '-'}%</strong></div>
                <div className="ttook-muted">Funding: <strong>%{item.fundingRatePct ?? '-'}</strong></div>
                <div className="ttook-muted">Basis: <strong>{item.basisBps ?? '-'} bps</strong></div>
                <div className="ttook-muted">Yaş: <strong>{item.ageSec ?? '-'} sn</strong></div>

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
        </>
      )}
    </main>
  );
}
