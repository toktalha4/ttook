'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

type AiSymbol = {
  symbol: string;
  displaySymbol: string;
  score: number;
  lastPrice: number;
  changePct: number;
  quoteVolume: number;
};

type AiCoin = {
  symbol: string;
  displaySymbol: string;
  price: number;
  trend: string;
  momentum: string;
  volatility: string;
  supports: number[];
  resistances: number[];
  liquidity: {
    up: number;
    down: number;
  };
  whaleLevels: number[];
  futuresPlan: {
    bias: string;
    entryLow: number;
    entryHigh: number;
    tp1: number;
    tp2: number;
    tp3: number;
    stop: number;
  };
  spotPlan: {
    buy1: number;
    buy2: number;
    buy3: number;
    sell1: number;
    sell2: number;
    invalid: number;
  };
  marketStats: {
    changePct: number;
    quoteVolume: number;
    fundingRatePct: number;
    basisBps: number;
    openInterest: number;
    tradeCount: number;
  };
  orderBook: {
    pressure: string;
    imbalancePct: number;
    bidNotional: number;
    askNotional: number;
    liveSpreadBps: number | null;
  };
  liquidation: {
    side: string;
    qty: number;
    price: number;
    ageSec: number;
  } | null;
  reasonLines: string[];
  miniAlarm: string;
  invalidation: string;
  comment: string;
  disclaimer: string;
};

function formatPrice(value: number | undefined | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  const n = Number(value);

  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 100) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (n >= 0.1) return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 5 });
  if (n >= 0.01) return n.toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 6 });
  if (n >= 0.001) return n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 7 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 7, maximumFractionDigits: 10 });
}

function formatCompact(value: number | undefined | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  const n = Number(value);

  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(0)}`;
}

function alarmClass(alarm: string) {
  if (alarm === 'LIKIDITE ALARMI') return 'short';
  if (alarm === 'LONG BASKI') return 'long';
  if (alarm === 'SHORT BASKI') return 'short';
  if (alarm === 'TUREV GERILIMI') return 'ai';
  return 'whale';
}

function buildTelegramPost(item: AiCoin) {
  const reasonText = item.reasonLines.map((line) => `- ${line}`).join('\n');

  return `⚙️🧠 ${item.displaySymbol} AI kontrolunden gecti. Ekranda temiz ama dikkat isteyen bir gorunum var.

💰 Anlik Fiyat: ${formatPrice(item.price)}$
📊 24s Degisim: %${item.marketStats.changePct}
🟢 Trend: ${item.trend}
⚡ Momentum: ${item.momentum}
🌪️ Volatilite: ${item.volatility}
💸 Funding: %${item.marketStats.fundingRatePct}
📏 Basis: ${item.marketStats.basisBps} bps
📦 Open Interest: ${item.marketStats.openInterest}
🔁 Trade Sayisi: ${item.marketStats.tradeCount}
💵 24s Hacim: ${formatCompact(item.marketStats.quoteVolume)}

🧭 Neden Gundemde
${reasonText}

📚 Orderbook Baskisi
- Baski: ${item.orderBook.pressure}
- Denge: %${item.orderBook.imbalancePct}
- Canli spread: ${item.orderBook.liveSpreadBps ?? '-'} bps

🩸 Likidite Snapshot
${item.liquidation
    ? `- Son yon: ${item.liquidation.side}
- Miktar: ${item.liquidation.qty}
- Ortalama fiyat: ${formatPrice(item.liquidation.price)}
- Tazelik: ${item.liquidation.ageSec} sn once`
    : '- Son saniyelerde net liquidation snapshot yakalanmadi'}

🧱 Destekler
- ${formatPrice(item.supports[0])}
- ${formatPrice(item.supports[1])}
- ${formatPrice(item.supports[2])}

🚧 Direncler
- ${formatPrice(item.resistances[0])}
- ${formatPrice(item.resistances[1])}
- ${formatPrice(item.resistances[2])}

🩸 Likidite Alanlari
- Ustte stop avi: ${formatPrice(item.liquidity.up)}
- Altta supurme: ${formatPrice(item.liquidity.down)}

🐋 Balina Seviyeleri
- ${formatPrice(item.whaleLevels[0])}
- ${formatPrice(item.whaleLevels[1])}
- ${formatPrice(item.whaleLevels[2])}

🎯 Futures Plani
- Bias: ${item.futuresPlan.bias}
- Giris alani: ${formatPrice(item.futuresPlan.entryLow)} - ${formatPrice(item.futuresPlan.entryHigh)}
- TP: ${formatPrice(item.futuresPlan.tp1)} / ${formatPrice(item.futuresPlan.tp2)} / ${formatPrice(item.futuresPlan.tp3)}
- Stop: ${formatPrice(item.futuresPlan.stop)}

💼 Spot Plani
- Kademeli alim: ${formatPrice(item.spotPlan.buy1)} / ${formatPrice(item.spotPlan.buy2)} / ${formatPrice(item.spotPlan.buy3)}
- Kar alma: ${formatPrice(item.spotPlan.sell1)} / ${formatPrice(item.spotPlan.sell2)}
- Yapi bozulursa dikkat: ${formatPrice(item.spotPlan.invalid)}

❌ Senaryo ne zaman bozulur
- ${item.invalidation}

😄 AI yorumu: ${item.comment}

⚠️ ${item.disclaimer}`;
}

function AiPageInner() {
  const searchParams = useSearchParams();

  const [symbols, setSymbols] = useState<AiSymbol[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('TRBUSDT');
  const [item, setItem] = useState<AiCoin | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState('-');
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    const qsSymbol = (searchParams.get('symbol') || '').toUpperCase().replace('.P', '');
    if (qsSymbol) {
      setSelected(qsSymbol);
    }
  }, [searchParams]);

  useEffect(() => {
    fetch(`${API_BASE}/ai-symbols`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('AI sembolleri alınamadı');
        return res.json();
      })
      .then((data) => {
        const items = data.items ?? [];
        setSymbols(items);

        if (!items.some((x: AiSymbol) => x.symbol === selected) && items.length > 0) {
          setSelected(items[0].symbol);
        }
      })
      .catch(() => {
        setSymbols([]);
      });
  }, [selected]);

  useEffect(() => {
    const load = (first = false) => {
      if (first) setLoading(true);

      fetch(`${API_BASE}/ai-coin?symbol=${selected}`, { cache: 'no-store' })
        .then((res) => {
          if (!res.ok) throw new Error('AI coin analizi alınamadı');
          return res.json();
        })
        .then((data) => {
          setItem(data.item ?? null);
          setLastRefresh(new Date().toLocaleTimeString('tr-TR'));
        })
        .catch(() => {
          setItem(null);
          setLastRefresh(new Date().toLocaleTimeString('tr-TR'));
        })
        .finally(() => {
          if (first) setLoading(false);
        });
    };

    load(true);
    const timer = setInterval(() => load(false), 15000);

    return () => clearInterval(timer);
  }, [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    const list = !q
      ? symbols
      : symbols.filter((x) => x.symbol.includes(q) || x.displaySymbol.includes(q));

    return list.slice(0, 24);
  }, [symbols, search]);

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
            AI Odası
          </h2>
          <div className="ttook-subtitle">
            Futures coinleri için samimi, detaylı, premium AI yorum ekranı
          </div>
        </div>

        <div className="ttook-muted">
          Oto yenileme: <strong>15 sn</strong> · Son yenileme: <strong>{lastRefresh}</strong>
        </div>
      </div>

      <div className="ttook-card" style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Coin ara: TRB, BTC, SOL, ETH..."
          style={{
            width: '100%',
            maxWidth: 420,
            padding: '12px 14px',
            borderRadius: 14,
            border: '1px solid #26304f',
            background: 'rgba(21,27,49,0.9)',
            color: 'white',
            outline: 'none',
            marginBottom: 14,
          }}
        />

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {filtered.map((s) => (
            <button
              key={s.symbol}
              onClick={() => setSelected(s.symbol)}
              style={{
                padding: '9px 12px',
                borderRadius: 999,
                border: '1px solid #26304f',
                background: s.symbol === selected ? '#2563eb' : 'rgba(21,27,49,0.9)',
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {s.displaySymbol}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="ttook-card">
          <div className="ttook-muted">AI analiz hazırlanıyor...</div>
        </div>
      ) : !item ? (
        <div className="ttook-card">
          <div className="ttook-card-title">AI cevap yok</div>
          <div className="ttook-muted">
            Bu coin için AI analizi alınamadı.
          </div>
        </div>
      ) : (
        <>
          <div className="ttook-card" style={{ lineHeight: 1.8 }}>
            <div className="ttook-card-title">{item.displaySymbol} AI kontrolunden gecti</div>

            <div style={{ marginBottom: 12 }}>
              <span className={`ttook-pill ${alarmClass(item.miniAlarm)}`}>{item.miniAlarm}</span>
            </div>

            <div className="ttook-muted" style={{ marginBottom: 14 }}>
              Ekranda temiz ama dikkat isteyen bir gorunum var.
            </div>

            <div className="ttook-muted">💰 <strong>Anlik Fiyat:</strong> {formatPrice(item.price)}$</div>
            <div className="ttook-muted">📊 <strong>24s Degisim:</strong> %{item.marketStats.changePct}</div>
            <div className="ttook-muted">🟢 <strong>Trend:</strong> {item.trend}</div>
            <div className="ttook-muted">⚡ <strong>Momentum:</strong> {item.momentum}</div>
            <div className="ttook-muted">🌪️ <strong>Volatilite:</strong> {item.volatility}</div>
            <div className="ttook-muted">💸 <strong>Funding:</strong> %{item.marketStats.fundingRatePct}</div>
            <div className="ttook-muted">📏 <strong>Basis:</strong> {item.marketStats.basisBps} bps</div>
            <div className="ttook-muted">📦 <strong>Open Interest:</strong> {item.marketStats.openInterest}</div>
            <div className="ttook-muted">🔁 <strong>Trade Sayisi:</strong> {item.marketStats.tradeCount}</div>
            <div className="ttook-muted">💵 <strong>24s Hacim:</strong> {formatCompact(item.marketStats.quoteVolume)}</div>

            <div style={{ marginTop: 18 }} className="ttook-muted">
              🧭 <strong>Neden Gundemde</strong>
              {item.reasonLines.map((line, idx) => (
                <div key={idx}>- {line}</div>
              ))}
            </div>

            <div style={{ marginTop: 18 }} className="ttook-muted">
              📚 <strong>Orderbook Baskisi</strong>
              <br />- Baski: {item.orderBook.pressure}
              <br />- Denge: %{item.orderBook.imbalancePct}
              <br />- Bid notional: {formatCompact(item.orderBook.bidNotional)}
              <br />- Ask notional: {formatCompact(item.orderBook.askNotional)}
              <br />- Canli spread: {item.orderBook.liveSpreadBps ?? '-'} bps
            </div>

            <div style={{ marginTop: 18 }} className="ttook-muted">
              🩸 <strong>Likidite Snapshot</strong>
              {item.liquidation ? (
                <>
                  <br />- Son yon: {item.liquidation.side}
                  <br />- Miktar: {item.liquidation.qty}
                  <br />- Ortalama fiyat: {formatPrice(item.liquidation.price)}
                  <br />- Tazelik: {item.liquidation.ageSec} sn once
                </>
              ) : (
                <>
                  <br />- Son saniyelerde net liquidation snapshot yakalanmadi
                </>
              )}
            </div>

            <div style={{ marginTop: 18 }} className="ttook-muted">
              🧱 <strong>Destekler</strong>
              <br />- {formatPrice(item.supports[0])}
              <br />- {formatPrice(item.supports[1])}
              <br />- {formatPrice(item.supports[2])}
            </div>

            <div style={{ marginTop: 18 }} className="ttook-muted">
              🚧 <strong>Direncler</strong>
              <br />- {formatPrice(item.resistances[0])}
              <br />- {formatPrice(item.resistances[1])}
              <br />- {formatPrice(item.resistances[2])}
            </div>

            <div style={{ marginTop: 18 }} className="ttook-muted">
              🩸 <strong>Likidite Alanlari</strong>
              <br />- Ustte stop avi: {formatPrice(item.liquidity.up)}
              <br />- Altta supurme: {formatPrice(item.liquidity.down)}
            </div>

            <div style={{ marginTop: 18 }} className="ttook-muted">
              🐋 <strong>Balina Seviyeleri</strong>
              <br />- {formatPrice(item.whaleLevels[0])}
              <br />- {formatPrice(item.whaleLevels[1])}
              <br />- {formatPrice(item.whaleLevels[2])}
            </div>

            <div style={{ marginTop: 18 }} className="ttook-muted">
              🎯 <strong>Futures Plani</strong>
              <br />- Bias: {item.futuresPlan.bias}
              <br />- Giris alani: {formatPrice(item.futuresPlan.entryLow)} - {formatPrice(item.futuresPlan.entryHigh)}
              <br />- TP: {formatPrice(item.futuresPlan.tp1)} / {formatPrice(item.futuresPlan.tp2)} / {formatPrice(item.futuresPlan.tp3)}
              <br />- Stop: {formatPrice(item.futuresPlan.stop)}
            </div>

            <div style={{ marginTop: 18 }} className="ttook-muted">
              💼 <strong>Spot Plani</strong>
              <br />- Kademeli alim: {formatPrice(item.spotPlan.buy1)} / {formatPrice(item.spotPlan.buy2)} / {formatPrice(item.spotPlan.buy3)}
              <br />- Kar alma: {formatPrice(item.spotPlan.sell1)} / {formatPrice(item.spotPlan.sell2)}
              <br />- Yapi bozulursa dikkat: {formatPrice(item.spotPlan.invalid)}
            </div>

            <div style={{ marginTop: 18 }} className="ttook-muted">
              ❌ <strong>Senaryo ne zaman bozulur</strong>
              <br />- {item.invalidation}
            </div>

            <div style={{ marginTop: 18 }} className="ttook-muted">
              😄 <strong>AI yorumu:</strong> {item.comment}
            </div>

            <div style={{ marginTop: 18 }} className="ttook-muted">
              ⚠️ <strong>{item.disclaimer}</strong>
            </div>
          </div>

          <div className="ttook-card" style={{ marginTop: 16 }}>
            <div className="ttook-card-title">Telegram’a Hazır Premium Post</div>
            <div className="ttook-subtitle">
              Tek dokunuşla kopyala, Telegram’da direkt paylaş.
            </div>

            <textarea
              className="ttook-copybox"
              readOnly
              value={buildTelegramPost(item)}
            />

            <div className="ttook-action-row">
              <button
                className="ttook-nav-link active"
                onClick={() => {
                  navigator.clipboard.writeText(buildTelegramPost(item));
                  setCopyStatus('Kopyalandi');
                  setTimeout(() => setCopyStatus(''), 1800);
                }}
              >
                Postu kopyala
              </button>

              {copyStatus ? (
                <div className="ttook-muted" style={{ alignSelf: 'center' }}>
                  {copyStatus}
                </div>
              ) : null}
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
        <main>
          <div className="ttook-card">
            <div className="ttook-muted">AI Odası yükleniyor...</div>
          </div>
        </main>
      }
    >
      <AiPageInner />
    </Suspense>
  );
}
