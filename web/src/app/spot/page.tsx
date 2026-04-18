'use client';

import { useEffect, useState } from 'react';

type SpotItem = {
  symbol: string;
  bias: string;
  dailyTrend: string;
  weeklyTrend: string;
  lastClose: number;
  support: number;
  resistance: number;
};

export default function SpotPage() {
  const [items, setItems] = useState<SpotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState('-');

  useEffect(() => {
    let cancelled = false;

    const load = (first = false) => {
      if (first) setLoading(true);

      fetch('http://127.0.0.1:8000/spot-longterm', { cache: 'no-store' })
        .then((res) => {
          if (!res.ok) throw new Error('Spot uzun vade verisi alınamadı');
          return res.json();
        })
        .then((data) => {
          if (!cancelled) {
            setItems(data.items ?? []);
            setLastRefresh(new Date().toLocaleTimeString('tr-TR'));
          }
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        })
        .finally(() => {
          if (!cancelled && first) setLoading(false);
        });
    };

    load(true);
    const timer = setInterval(() => load(false), 60000);

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
        <h2 className="ttook-section-title" style={{ margin: 0 }}>
          Spot Uzun Vade
        </h2>

        <div className="ttook-muted">
          Oto yenileme: <strong>60 sn</strong> · Son yenileme: <strong>{lastRefresh}</strong>
        </div>
      </div>

      {loading ? (
        <div className="ttook-card">
          <div className="ttook-muted">Spot uzun vade yükleniyor...</div>
        </div>
      ) : items.length === 0 ? (
        <div className="ttook-card">
          <div className="ttook-card-title">Spot görünüm yok</div>
          <div className="ttook-muted">Şu an spot uzun vade verisi görünmüyor.</div>
        </div>
      ) : (
        <div className="ttook-grid">
          {items.map((item) => (
            <div className="ttook-card" key={item.symbol}>
              <div className="ttook-card-title">{item.symbol}</div>

              <div className={`ttook-pill ${item.bias === 'Zayıf' ? 'short' : item.bias === 'Pozitif' ? 'long' : 'whale'}`}>
                {item.bias}
              </div>

              <div className="ttook-muted">Günlük trend: <strong>{item.dailyTrend}</strong></div>
              <div className="ttook-muted">Haftalık trend: <strong>{item.weeklyTrend}</strong></div>
              <div className="ttook-muted">Son fiyat: <strong>{item.lastClose}</strong></div>
              <div className="ttook-muted">Destek: <strong>{item.support}</strong></div>
              <div className="ttook-muted">Direnç: <strong>{item.resistance}</strong></div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
