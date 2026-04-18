'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CandlestickSeries,
  ColorType,
  LineStyle,
  createChart,
} from 'lightweight-charts';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

type SymbolItem = {
  symbol: string;
  displaySymbol: string;
  baseAsset: string;
  quoteAsset: string;
  market: 'spot' | 'futures';
};

type SignalItem = {
  id?: number;
  symbol: string;
  market: 'spot' | 'futures';
  direction: 'long' | 'short';
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

type AiCoinLite = {
  miniAlarm?: string;
  orderBook?: {
    pressure?: string;
  };
};

const INTERVALS = ['1m', '5m', '15m', '1h'];

function alarmClass(alarm: string | undefined) {
  if (!alarm) return 'whale';
  if (alarm === 'LIKIDITE ALARMI') return 'short';
  if (alarm === 'LONG BASKI') return 'long';
  if (alarm === 'SHORT BASKI') return 'short';
  if (alarm === 'TUREV GERILIMI') return 'ai';
  return 'whale';
}

function pressureClass(pressure: string | undefined) {
  if (!pressure) return 'whale';
  if (pressure === 'alim baskisi') return 'long';
  if (pressure === 'satis baskisi') return 'short';
  return 'whale';
}

export default function ChartPage() {
  const searchParams = useSearchParams();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const priceLinesRef = useRef<any[]>([]);

  const [market, setMarket] = useState<'spot' | 'futures'>('spot');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('15m');
  const [search, setSearch] = useState('');
  const [symbols, setSymbols] = useState<SymbolItem[]>([]);
  const [symbolsLoading, setSymbolsLoading] = useState(false);
  const [lastClose, setLastClose] = useState<number | null>(null);
  const [status, setStatus] = useState('Hazırlanıyor...');
  const [error, setError] = useState('');
  const [signal, setSignal] = useState<SignalItem | null>(null);
  const [signalStatus, setSignalStatus] = useState('Sinyal kontrol ediliyor...');
  const [lastSignalCheck, setLastSignalCheck] = useState('-');
  const [aiMeta, setAiMeta] = useState<AiCoinLite | null>(null);

  const filteredSymbols = useMemo(() => {
    const q = search.trim().toUpperCase();
    const list = !q
      ? symbols
      : symbols.filter(
          (x) =>
            x.symbol.includes(q) ||
            x.displaySymbol.includes(q) ||
            x.baseAsset.includes(q)
        );

    return list.slice(0, 18);
  }, [symbols, search]);

  const clearPriceLines = () => {
    if (!seriesRef.current) return;
    for (const line of priceLinesRef.current) {
      try {
        seriesRef.current.removePriceLine(line);
      } catch {}
    }
    priceLinesRef.current = [];
  };

  useEffect(() => {
    const qsSymbol = (searchParams.get('symbol') || '').toUpperCase().replace('.P', '');
    const qsMarket = (searchParams.get('market') || '').toLowerCase();

    if (qsSymbol) setSymbol(qsSymbol);
    if (qsMarket === 'spot' || qsMarket === 'futures') {
      setMarket(qsMarket);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#cbd5e1',
      },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.10)' },
        horzLines: { color: 'rgba(148,163,184,0.10)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(148,163,184,0.20)',
      },
      timeScale: {
        borderColor: 'rgba(148,163,184,0.20)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      borderVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearPriceLines();

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    setSymbolsLoading(true);

    fetch(`${API_BASE}/symbols?market=${market}&limit=5000`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('Sembol listesi alınamadı');
        return res.json();
      })
      .then((data) => {
        const items = data.items ?? [];
        setSymbols(items);

        if (!items.some((x: SymbolItem) => x.symbol === symbol)) {
          const btc = items.find((x: SymbolItem) => x.symbol === 'BTCUSDT');
          setSymbol(btc?.symbol ?? items[0]?.symbol ?? 'BTCUSDT');
        }
      })
      .catch(() => {
        setSymbols([]);
      })
      .finally(() => {
        setSymbolsLoading(false);
      });
  }, [market, symbol]);

  useEffect(() => {
    setStatus('Geçmiş mumlar yükleniyor...');
    setError('');

    fetch(
      `${API_BASE}/klines?market=${market}&symbol=${symbol}&interval=${interval}&limit=300`,
      { cache: 'no-store' }
    )
      .then((res) => {
        if (!res.ok) throw new Error('Kline verisi alınamadı');
        return res.json();
      })
      .then((data) => {
        const candles: Candle[] = data.candles ?? [];

        const mapped = candles.map((c) => ({
          time: Math.floor(c.openTime / 1000) as any,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

        if (seriesRef.current && chartRef.current) {
          seriesRef.current.setData(mapped);
          chartRef.current.timeScale().fitContent();
          setLastClose(candles.length ? candles[candles.length - 1].close : null);
        }

        setStatus('Canlı akış bağlanıyor...');
      })
      .catch((err) => {
        setError(err?.message || 'Bilinmeyen hata');
        setStatus('Yükleme hatası');
      });
  }, [market, symbol, interval]);

  useEffect(() => {
    if (!seriesRef.current) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    const wsUrl =
      market === 'spot'
        ? `wss://data-stream.binance.vision:443/ws/${streamName}`
        : `wss://fstream.binance.com/ws/${streamName}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('Canlı akış açık');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const k = message?.k;
        if (!k || !seriesRef.current) return;

        const bar = {
          time: Math.floor(Number(k.t) / 1000) as any,
          open: Number(k.o),
          high: Number(k.h),
          low: Number(k.l),
          close: Number(k.c),
        };

        seriesRef.current.update(bar);
        setLastClose(Number(k.c));
      } catch {
        setStatus('Canlı veri parse hatası');
      }
    };

    ws.onerror = () => {
      setStatus('Canlı akış hatası');
    };

    ws.onclose = () => {
      setStatus('Canlı akış kapandı');
    };

    return () => {
      ws.close();
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
  }, [market, symbol, interval]);

  useEffect(() => {
    const loadSignal = () => {
      fetch(
        `${API_BASE}/signals/active?market=${market}&symbol=${symbol}`,
        { cache: 'no-store' }
      )
        .then((res) => {
          if (!res.ok) throw new Error('Sinyal alınamadı');
          return res.json();
        })
        .then((data) => {
          setSignal(data.item ?? null);
          setSignalStatus(data.item ? 'Aktif sinyal var' : 'Aktif sinyal yok');
          setLastSignalCheck(new Date().toLocaleTimeString('tr-TR'));
        })
        .catch(() => {
          setSignal(null);
          setSignalStatus('Sinyal alınamadı');
          setLastSignalCheck(new Date().toLocaleTimeString('tr-TR'));
        });
    };

    loadSignal();
const timer = window.setInterval(() => { loadSignal(); }, 5000);

    return () => clearInterval(timer);
  }, [market, symbol]);

  useEffect(() => {
    if (market !== 'futures') {
      setAiMeta(null);
      return;
    }

    const loadAiMeta = () => {
      fetch(`${API_BASE}/ai-coin?symbol=${symbol}`, { cache: 'no-store' })
        .then((res) => {
          if (!res.ok) throw new Error('AI meta alınamadı');
          return res.json();
        })
        .then((data) => {
          setAiMeta(data.item ?? null);
        })
        .catch(() => {
          setAiMeta(null);
        });
    };

    loadAiMeta();
    const timer = setInterval(loadAiMeta, 15000);

    return () => clearInterval(timer);
  }, [market, symbol]);

  useEffect(() => {
    clearPriceLines();

    if (!signal || !seriesRef.current) return;

    const addLine = (price: number, title: string, color: string, lineStyle: number) => {
      const line = seriesRef.current.createPriceLine({
        price,
        color,
        lineWidth: 2,
        lineStyle,
        axisLabelVisible: true,
        title,
      });
      priceLinesRef.current.push(line);
    };

    addLine(signal.entry, 'ENTRY', '#60a5fa', LineStyle.Dashed);
    addLine(signal.tp1, 'TP1', '#4ade80', LineStyle.Dotted);
    addLine(signal.tp2, 'TP2', '#22c55e', LineStyle.Dotted);
    addLine(signal.tp3, 'TP3', '#16a34a', LineStyle.Dotted);
    addLine(signal.stop, 'STOP', '#f87171', LineStyle.Solid);
  }, [signal]);

  const pillClass = signal
    ? signal.direction === 'short'
      ? 'short'
      : 'long'
    : market === 'futures'
      ? 'ai'
      : 'whale';

  const pillText = signal
    ? `${signal.direction.toUpperCase()} SIGNAL`
    : market === 'futures'
      ? 'FUTURES USDT.P'
      : 'SPOT';

  return (
    <main>
      <h2 className="ttook-section-title">Grafik</h2>

      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <button
          onClick={() => setMarket('spot')}
          style={{
            padding: '10px 14px',
            borderRadius: 999,
            border: '1px solid #26304f',
            background: market === 'spot' ? '#1d4ed8' : 'rgba(21,27,49,0.9)',
            color: 'white',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Spot
        </button>

        <button
          onClick={() => setMarket('futures')}
          style={{
            padding: '10px 14px',
            borderRadius: 999,
            border: '1px solid #26304f',
            background: market === 'futures' ? '#7c3aed' : 'rgba(21,27,49,0.9)',
            color: 'white',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Futures (USDT.P)
        </button>

        {INTERVALS.map((item) => (
          <button
            key={item}
            onClick={() => setInterval(item)}
            style={{
              padding: '10px 14px',
              borderRadius: 999,
              border: '1px solid #26304f',
              background: item === interval ? '#0f766e' : 'rgba(21,27,49,0.9)',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="ttook-card" style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={market === 'futures' ? 'Futures coin ara: BTC, ETH, SOL...' : 'Spot coin ara...'}
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

        <div className="ttook-muted" style={{ marginBottom: 12 }}>
          {symbolsLoading ? 'Sembol listesi yükleniyor...' : `${symbols.length} coin bulundu`}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {filteredSymbols.map((item) => (
            <button
              key={`${item.market}-${item.symbol}`}
              onClick={() => setSymbol(item.symbol)}
              style={{
                padding: '9px 12px',
                borderRadius: 999,
                border: '1px solid #26304f',
                background: item.symbol === symbol ? '#2563eb' : 'rgba(21,27,49,0.9)',
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {item.displaySymbol}
            </button>
          ))}
        </div>
      </div>

      <div className="ttook-two-col">
        <div className="ttook-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 14,
              flexWrap: 'wrap',
            }}
          >
            <div className="ttook-card-title" style={{ margin: 0 }}>
              {market === 'futures' ? `${symbol}.P` : symbol} · {interval}
            </div>

            <div className="ttook-muted">
              {error ? `Hata: ${error}` : `Son fiyat: ${lastClose ?? '-'}`}
            </div>
          </div>

          <div
            style={{
              marginBottom: 12,
              fontSize: 13,
              opacity: 0.85,
            }}
          >
            {status}
          </div>

          <div ref={containerRef} />
        </div>

        <div className="ttook-card">
          <div className="ttook-card-title">
            {market === 'futures' ? `${symbol}.P` : symbol}
          </div>

          <div className={`ttook-pill ${pillClass}`}>{pillText}</div>

          {market === 'futures' && aiMeta?.miniAlarm ? (
            <div className={`ttook-pill ${alarmClass(aiMeta.miniAlarm)}`} style={{ marginLeft: 8 }}>
              {aiMeta.miniAlarm}
            </div>
          ) : null}

          {market === 'futures' && aiMeta?.orderBook?.pressure ? (
            <div className={`ttook-pill ${pressureClass(aiMeta.orderBook.pressure)}`} style={{ marginLeft: 8 }}>
              {aiMeta.orderBook.pressure}
            </div>
          ) : null}

          <div className="ttook-muted">Interval: <strong>{interval}</strong></div>
          <div className="ttook-muted">Son fiyat: <strong>{lastClose ?? '-'}</strong></div>
          <div className="ttook-muted">Grafik durumu: <strong>{status}</strong></div>
          <div className="ttook-muted">Sinyal durumu: <strong>{signalStatus}</strong></div>
          <div className="ttook-muted">Son kontrol: <strong>{lastSignalCheck}</strong></div>

          <div style={{ marginTop: 16 }} />

          {signal ? (
            <>
              <div className="ttook-muted">Setup: <strong>{signal.setup}</strong></div>
              <div className="ttook-muted">Borsa: <strong>{signal.exchange}</strong></div>
              <div className="ttook-muted">Kaynak: <strong>{signal.source ?? '-'}</strong></div>
              <div className="ttook-muted">Güven: <strong>%{signal.confidence}</strong></div>
              <div className="ttook-muted">Entry: <strong>{signal.entry}</strong></div>
              <div className="ttook-muted">TP1: <strong>{signal.tp1}</strong></div>
              <div className="ttook-muted">TP2: <strong>{signal.tp2}</strong></div>
              <div className="ttook-muted">TP3: <strong>{signal.tp3}</strong></div>
              <div className="ttook-muted">Stop: <strong>{signal.stop}</strong></div>
            </>
          ) : (
            <div className="ttook-muted">Bu coin için aktif sinyal yok.</div>
          )}
        </div>
      </div>
    </main>
  );
}
