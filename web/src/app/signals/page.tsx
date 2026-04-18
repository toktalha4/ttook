'use client';

import { useEffect, useState } from 'react';

type SignalItem = {
  id?: number;
  symbol: string;
  market: 'spot' | 'futures';
  direction: string;
  entry: number;
  tp1: number;
  tp2: number;
  tp3: number;
  stop: number;
  confidence: number;
  setup: string;
  exchange: string;
  source?: string;
  note?: string | null;
  updated_at?: string;
};

export default function SignalsPage() {
  const [items, setItems] = useState<SignalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string>('-');

  useEffect(() => {
    let cancelled = false;

    const load = async (first = false) => {
      if (first) setLoading(true);

      try {
        const res = await fetch('http://127.0.0.1:8000/signals', {
          cache: 'no-store',
        });

        if (!res.ok) throw new Error('Sinyaller alınamadı');

        const data = await res.json();

        if (!cancelled) {
          setItems(data.items ?? []);
          setLastRefresh(new Date().toLocaleTimeString('tr-TR'));
        }
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      } finally {
        if (!cancelled && first) {
          setLoading(false);
        }
      }
    };

    load(true);
    const timer = setInterval(() => load(false), 5000);

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
          Sinyaller
        </h2>

        <div className="ttook-muted">
          Oto yenileme: <strong>5 sn</strong> · Son yenileme: <strong>{lastRefresh}</strong>
        </div>
      </div>

      {loading ? (
        <div className="ttook-card">
          <div className="ttook-muted">Sinyaller yükleniyor...</div>
        </div>
      ) : items.length === 0 ? (
        <div className="ttook-card">
          <div className="ttook-card-title">Aktif sinyal yok</div>
          <div className="ttook-muted">
            Şu anda aktif public sinyal görünmüyor.
            <br />
            Bot yeni sinyal açtığında bu ekran otomatik dolacak.
          </div>
        </div>
      ) : (
        <div className="ttook-grid">
          {items.map((item) => (
            <div
              className="ttook-card"
              key={`${item.market}-${item.symbol}-${item.setup}-${item.entry}-${item.id ?? ''}`}
            >
              <div className="ttook-card-title">
                {item.market === 'futures' ? `${item.symbol}.P` : item.symbol}
              </div>

              <div className={`ttook-pill ${item.direction === 'short' ? 'short' : 'long'}`}>
                {item.direction}
              </div>

              <div
                className={`ttook-pill ${item.market === 'futures' ? 'ai' : 'whale'}`}
                style={{ marginLeft: 8 }}
              >
                {item.market === 'futures' ? 'FUTURES' : 'SPOT'}
              </div>

              <div className="ttook-muted">
                Setup: <strong>{item.setup}</strong>
              </div>
              <div className="ttook-muted">
                Borsa: <strong>{item.exchange}</strong>
              </div>
              <div className="ttook-muted">
                Kaynak: <strong>{item.source ?? '-'}</strong>
              </div>
              <div className="ttook-muted">
                Güven: <strong>%{item.confidence}</strong>
              </div>
              <div className="ttook-muted">
                Giriş: <strong>{item.entry}</strong>
              </div>
              <div className="ttook-muted">
                TP1: <strong>{item.tp1}</strong>
              </div>
              <div className="ttook-muted">
                TP2: <strong>{item.tp2}</strong>
              </div>
              <div className="ttook-muted">
                TP3: <strong>{item.tp3}</strong>
              </div>
              <div className="ttook-muted">
                Stop: <strong>{item.stop}</strong>
              </div>

              {item.note ? (
                <div className="ttook-muted" style={{ marginTop: 10 }}>
                  Not: <strong>{item.note}</strong>
                </div>
              ) : null}

              {item.updated_at ? (
                <div className="ttook-muted" style={{ marginTop: 10 }}>
                  Güncellendi: <strong>{new Date(item.updated_at).toLocaleString('tr-TR')}</strong>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}