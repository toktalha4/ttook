'use client';

import { useEffect, useState } from 'react';

type SignalItem = {
  symbol: string;
  direction: string;
  entry: number;
  tp1: number;
  tp2: number;
  tp3: number;
  stop: number;
  confidence: number;
  setup: string;
  exchange: string;
};

export default function SignalsPage() {
  const [items, setItems] = useState<SignalItem[]>([]);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/signals')
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <main>
      <h2 className="ttook-section-title">Sinyaller</h2>

      <div className="ttook-grid">
        {items.map((item) => (
          <div className="ttook-card" key={`${item.symbol}-${item.setup}`}>
            <div className="ttook-card-title">{item.symbol}</div>
            <div className={`ttook-pill ${item.direction}`}>
              {item.direction}
            </div>
            <div className="ttook-muted">Setup: <strong>{item.setup}</strong></div>
            <div className="ttook-muted">Borsa: <strong>{item.exchange}</strong></div>
            <div className="ttook-muted">Giriş: <strong>{item.entry}</strong></div>
            <div className="ttook-muted">TP1: <strong>{item.tp1}</strong></div>
            <div className="ttook-muted">TP2: <strong>{item.tp2}</strong></div>
            <div className="ttook-muted">TP3: <strong>{item.tp3}</strong></div>
            <div className="ttook-muted">Stop: <strong>{item.stop}</strong></div>
            <div className="ttook-muted">Güven: <strong>%{item.confidence}</strong></div>
          </div>
        ))}
      </div>
    </main>
  );
}
