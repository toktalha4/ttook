'use client';

import { useEffect, useState } from 'react';

type WhaleItem = {
  symbol: string;
  displaySymbol: string;
  type: string;
  detail: string;
  oi_change: string;
  volume: string;
  lastPrice: number;
  changePct: number;
  fundingRate: number;
  basisBps: number;
  premiumScore: number;
  trades: number;
  market: string;
};

export default function WhalesPage() {
  const [items, setItems] = useState<WhaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState('-');

  useEffect(() => {
    let cancelled = false;

    const load = (first = false) => {
      if (first) setLoading(true);

      fetch('http://127.0.0.1:8000/whales', { cache: 'no-store' })
        .then((res) => {
          if (!res.ok) throw new Error('Balina verisi alınamadı');
          return res.json();
        })
        .then((data) => {
          if (!cancelled) {
            setItems(data.items ?? []);
            setLastRefresh(new Date().toLocaleTimeString('tr-TR'));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setItems([]);
          }
        })
        .finally(() => {
          if (!cancelled && first) {
            setLoading(false);
          }
        });
    };

    load(true);
    const timer = setInterval(() => load(false), 7000);

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
            Balina Radar
          </h2>
          <div className="ttook-muted">
            Futures USDT.P türev baskı, funding ve OI ekranı
          </div>
        </div>

        <div className="ttook-muted">
          Oto yenileme: <strong>7 sn</strong> · Son yenileme: <strong>{lastRefresh}</strong>
        </div>
      </div>

      {loading ? (
        <div className="ttook-card">
          <div className="ttook-muted">Balina verisi yükleniyor...</div>
        </div>
      ) : items.length === 0 ? (
        <div className="ttook-card">
          <div className="ttook-card-title">Balina hareketi yok</div>
          <div className="ttook-muted">
            Şu anda anlamlı türev baskısı görünmüyor.
          </div>
        </div>
      ) : (
        <div className="ttook-grid">
          {items.map((item) => (
            <div className="ttook-card" key={`${item.symbol}-${item.type}`}>
              <div className="ttook-card-title">{item.displaySymbol}</div>

              <div className="ttook-pill whale">{item.type}</div>
              <div className="ttook-pill ai" style={{ marginLeft: 8 }}>
                FUTURES
              </div>

              <div className="ttook-muted">{item.detail}</div>

              <div style={{ marginTop: 12 }} className="ttook-muted">
                Son fiyat: <strong>{item.lastPrice}</strong>
              </div>
              <div className="ttook-muted">
                24s değişim: <strong>{item.changePct}%</strong>
              </div>
              <div className="ttook-muted">
                Funding: <strong>{item.fundingRate}%</strong>
              </div>
              <div className="ttook-muted">
                Basis: <strong>{item.basisBps} bps</strong>
              </div>
              <div className="ttook-muted">
                OI: <strong>{item.oi_change}</strong>
              </div>
              <div className="ttook-muted">
                Hacim: <strong>{item.volume}</strong>
              </div>
              <div className="ttook-muted">
                İşlem sayısı: <strong>{item.trades}</strong>
              </div>
              <div className="ttook-muted">
                Premium skor: <strong>{item.premiumScore}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
