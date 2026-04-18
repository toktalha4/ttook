'use client';

import { useEffect, useState } from 'react';

type SystemStatus = {
  ok: boolean;
  serverTime: string;
  activeSignals: number;
  streams: {
    market: string;
    public: string;
    last_market_msg: number;
    last_public_msg: number;
  };
};

function fmtAge(ts: number) {
  if (!ts) return '-';
  const age = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  return `${age} sn`;
}

export default function SystemPage() {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [lastRefresh, setLastRefresh] = useState('-');

  useEffect(() => {
    const load = () => {
      fetch('http://127.0.0.1:8000/system-status', { cache: 'no-store' })
        .then((res) => {
          if (!res.ok) throw new Error('Durum alınamadı');
          return res.json();
        })
        .then((json) => {
          setData(json);
          setLastRefresh(new Date().toLocaleTimeString('tr-TR'));
        })
        .catch(() => {
          setData(null);
          setLastRefresh(new Date().toLocaleTimeString('tr-TR'));
        });
    };

    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
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
            Sistem Merkezi
          </h2>
          <div className="ttook-muted">
            API, aktif sinyal ve stream sağlık ekranı
          </div>
        </div>

        <div className="ttook-muted">
          Oto yenileme: <strong>5 sn</strong> · Son yenileme: <strong>{lastRefresh}</strong>
        </div>
      </div>

      {!data ? (
        <div className="ttook-card">
          <div className="ttook-card-title">Durum alınamadı</div>
          <div className="ttook-muted">API veya stream tarafı şu an cevap vermiyor olabilir.</div>
        </div>
      ) : (
        <div className="ttook-grid">
          <div className="ttook-card">
            <div className="ttook-card-title">API</div>
            <div className={`ttook-pill ${data.ok ? 'long' : 'short'}`}>
              {data.ok ? 'AYAKTA' : 'HATA'}
            </div>
            <div className="ttook-muted">Sunucu saati: <strong>{new Date(data.serverTime).toLocaleString('tr-TR')}</strong></div>
          </div>

          <div className="ttook-card">
            <div className="ttook-card-title">Aktif Sinyaller</div>
            <div className="ttook-pill ai">CANLI</div>
            <div className="ttook-muted">Toplam aktif sinyal: <strong>{data.activeSignals}</strong></div>
          </div>

          <div className="ttook-card">
            <div className="ttook-card-title">Market Stream</div>
            <div className={`ttook-pill ${data.streams.market === 'open' ? 'long' : 'short'}`}>
              {data.streams.market}
            </div>
            <div className="ttook-muted">Son mesaj: <strong>{fmtAge(data.streams.last_market_msg)}</strong></div>
          </div>

          <div className="ttook-card">
            <div className="ttook-card-title">Public Stream</div>
            <div className={`ttook-pill ${data.streams.public === 'open' ? 'long' : 'short'}`}>
              {data.streams.public}
            </div>
            <div className="ttook-muted">Son mesaj: <strong>{fmtAge(data.streams.last_public_msg)}</strong></div>
          </div>
        </div>
      )}
    </main>
  );
}
