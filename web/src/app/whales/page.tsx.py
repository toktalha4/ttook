'use client';

import { useEffect, useState } from 'react';

type WhaleItem = {
  symbol: string;
  type: string;
  detail: string;
  oi_change: string;
  volume: string;
};

export default function WhalesPage() {
  const [items, setItems] = useState<WhaleItem[]>([]);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/whales')
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <main>
      <h2 className="ttook-section-title">Balina Radar</h2>

      <div className="ttook-grid">
        {items.map((item) => (
          <div className="ttook-card" key={`${item.symbol}-${item.type}`}>
            <div className="ttook-card-title">{item.symbol}</div>
            <div className="ttook-pill whale">{item.type}</div>
            <div className="ttook-muted">{item.detail}</div>
            <div className="ttook-muted" style={{ marginTop: 12 }}>
              OI: <strong>{item.oi_change}</strong>
            </div>
            <div className="ttook-muted">
              Hacim: <strong>{item.volume}</strong>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}