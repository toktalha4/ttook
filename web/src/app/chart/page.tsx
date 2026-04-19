
'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createChart, CandlestickSeries, ColorType, LineSeries } from 'lightweight-charts';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8010').replace(/\/+$/, '');

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type NumArr = Array<number | null>;

type BiasResult = {
  label: string;
  score: number;
  reason: string;
};

function fmtPrice(v?: number | null) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '-';
  const n = Number(v);
  if (Math.abs(n) >= 1000) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(4);
  if (Math.abs(n) >= 0.01) return n.toFixed(5);
  return n.toFixed(8);
}

function lastNum(values: NumArr) {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) return Number(values[i]);
  }
  return null;
}

function calcSMA(values: number[], period: number): NumArr {
  const out: NumArr = new Array(values.length).fill(null);
  if (values.length < period) return out;
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    out[i] = slice.reduce((a, b) => a + b, 0) / period;
  }
  return out;
}

function calcEMA(values: number[], period: number): NumArr {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const out: NumArr = [];
  let prev = values[0];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (i === period - 1) {
      const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prev = seed;
      out.push(seed);
      continue;
    }
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }

  return out;
}

function calcRSI(values: number[], period = 14): NumArr {
  if (values.length < period + 1) return values.map(() => null);

  const out: NumArr = new Array(values.length).fill(null);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) out[i] = 100;
    else {
      const rs = avgGain / avgLoss;
      out[i] = 100 - 100 / (1 + rs);
    }
  }

  return out;
}

function calcMACD(values: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(values, fast);
  const emaSlow = calcEMA(values, slow);

  const macdLine: NumArr = values.map((_, i) => {
    if (emaFast[i] == null || emaSlow[i] == null) return null;
    return Number(emaFast[i]) - Number(emaSlow[i]);
  });

  const macdSeed = macdLine.map((v) => (v == null ? 0 : v));
  const signalLineRaw = calcEMA(macdSeed, signal);

  const signalLine: NumArr = signalLineRaw.map((v, i) => {
    if (macdLine[i] == null || v == null) return null;
    return v;
  });

  const histogram: NumArr = macdLine.map((v, i) => {
    if (v == null || signalLine[i] == null) return null;
    return Number(v) - Number(signalLine[i]);
  });

  return { macdLine, signalLine, histogram };
}

function calcBollinger(values: number[], period = 20, mult = 2) {
  const mid = calcSMA(values, period);
  const upper: NumArr = new Array(values.length).fill(null);
  const lower: NumArr = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const stdev = Math.sqrt(variance);
    upper[i] = mean + stdev * mult;
    lower[i] = mean - stdev * mult;
  }

  return { mid, upper, lower };
}

function calcVWAP(candles: Candle[]) {
  let cumulativePV = 0;
  let cumulativeV = 0;
  const out: NumArr = [];

  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3;
    cumulativePV += typical * c.volume;
    cumulativeV += c.volume;
    out.push(cumulativeV > 0 ? cumulativePV / cumulativeV : null);
  }

  return out;
}

function calcATR(candles: Candle[], period = 14): NumArr {
  if (candles.length < period + 1) return candles.map(() => null);

  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trs.push(candles[i].high - candles[i].low);
      continue;
    }
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prevClose),
      Math.abs(candles[i].low - prevClose)
    );
    trs.push(tr);
  }

  const out: NumArr = new Array(candles.length).fill(null);
  const seed = trs.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  out[period] = seed;

  let prev = seed;
  for (let i = period + 1; i < candles.length; i++) {
    prev = (prev * (period - 1) + trs[i]) / period;
    out[i] = prev;
  }

  return out;
}

function buildBias(closes: number[]): BiasResult {
  if (closes.length < 60) {
    return { label: 'Veri az', score: 0, reason: 'Yeterli mum yok' };
  }

  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);
  const rsi = calcRSI(closes, 14);
  const macd = calcMACD(closes);

  const lastClose = closes[closes.length - 1];
  const e20 = lastNum(ema20);
  const e50 = lastNum(ema50);
  const r = lastNum(rsi);
  const h = lastNum(macd.histogram);

  let score = 0;
  const reasons: string[] = [];

  if (e20 != null && lastClose > e20) {
    score += 1;
    reasons.push('fiyat EMA20 üstü');
  } else {
    score -= 1;
    reasons.push('fiyat EMA20 altı');
  }

  if (e20 != null && e50 != null && e20 > e50) {
    score += 1;
    reasons.push('EMA20 > EMA50');
  } else if (e20 != null && e50 != null) {
    score -= 1;
    reasons.push('EMA20 < EMA50');
  }

  if (r != null && r >= 56) {
    score += 1;
    reasons.push('RSI pozitif');
  } else if (r != null && r <= 44) {
    score -= 1;
    reasons.push('RSI zayıf');
  }

  if (h != null && h > 0) {
    score += 1;
    reasons.push('MACD histogram pozitif');
  } else if (h != null && h < 0) {
    score -= 1;
    reasons.push('MACD histogram negatif');
  }

  let label = 'Nötr';
  if (score >= 3) label = 'Güçlü Long';
  else if (score >= 1) label = 'Hafif Long';
  else if (score <= -3) label = 'Güçlü Short';
  else if (score <= -1) label = 'Hafif Short';

  return {
    label,
    score,
    reason: reasons.join(' • '),
  };
}

function normalizeSymbolList(raw: any): string[] {
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.symbols) ? raw.symbols : [];
  return arr
    .map((x: any) => {
      if (typeof x === 'string') return x;
      return x?.symbol || x?.code || x?.name || '';
    })
    .filter(Boolean);
}

function normalizeCandles(raw: any): Candle[] {
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
  return arr
    .map((x: any) => {
      if (Array.isArray(x)) {
        return {
          time: Number(x[0]),
          open: Number(x[1]),
          high: Number(x[2]),
          low: Number(x[3]),
          close: Number(x[4]),
          volume: Number(x[5] || 0),
        };
      }

      return {
        time: Number(x.time ?? x.ts ?? x.openTime ?? 0),
        open: Number(x.open),
        high: Number(x.high),
        low: Number(x.low),
        close: Number(x.close),
        volume: Number(x.volume ?? 0),
      };
    })
    .filter((x: Candle) => Number.isFinite(x.time) && Number.isFinite(x.close));
}

function ChartPageInner() {
  const searchParams = useSearchParams();
  const initialSymbol = (searchParams.get('symbol') || 'BTCUSDT').toUpperCase();

  const chartRef = useRef<HTMLDivElement | null>(null);

  const [market, setMarket] = useState<'spot' | 'futures'>('futures');
  const [interval, setIntervalState] = useState<'1m' | '5m' | '15m' | '1h'>('15m');
  const [symbol, setSymbol] = useState(initialSymbol);
  const [search, setSearch] = useState('');
  const [symbols, setSymbols] = useState<string[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSignals, setActiveSignals] = useState(0);

  const [showEMA20, setShowEMA20] = useState(true);
  const [showEMA50, setShowEMA50] = useState(true);
  const [showEMA200, setShowEMA200] = useState(true);
  const [showBoll, setShowBoll] = useState(true);
  const [showVWAP, setShowVWAP] = useState(true);
  const [showRSI, setShowRSI] = useState(true);
  const [showMACD, setShowMACD] = useState(true);
  const [showATR, setShowATR] = useState(true);
  const [showVolMA, setShowVolMA] = useState(true);

  const [tfBias, setTfBias] = useState<Record<string, BiasResult>>({});

  const closes = useMemo(() => candles.map((c) => c.close), [candles]);
  const volumes = useMemo(() => candles.map((c) => c.volume), [candles]);

  const ema20 = useMemo(() => calcEMA(closes, 20), [closes]);
  const ema50 = useMemo(() => calcEMA(closes, 50), [closes]);
  const ema200 = useMemo(() => calcEMA(closes, 200), [closes]);
  const rsi14 = useMemo(() => calcRSI(closes, 14), [closes]);
  const macdObj = useMemo(() => calcMACD(closes), [closes]);
  const boll = useMemo(() => calcBollinger(closes, 20, 2), [closes]);
  const vwap = useMemo(() => calcVWAP(candles), [candles]);
  const atr14 = useMemo(() => calcATR(candles, 14), [candles]);
  const volumeSma20 = useMemo(() => calcSMA(volumes, 20), [volumes]);

  const filteredSymbols = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return symbols.slice(0, 50);
    return symbols.filter((s) => s.includes(q)).slice(0, 50);
  }, [symbols, search]);

  const indicatorSummary = useMemo(() => {
    return {
      ema20: lastNum(ema20),
      ema50: lastNum(ema50),
      ema200: lastNum(ema200),
      rsi: lastNum(rsi14),
      macd: lastNum(macdObj.macdLine),
      signal: lastNum(macdObj.signalLine),
      hist: lastNum(macdObj.histogram),
      atr: lastNum(atr14),
      vwap: lastNum(vwap),
      volSma20: lastNum(volumeSma20),
      bbUpper: lastNum(boll.upper),
      bbMid: lastNum(boll.mid),
      bbLower: lastNum(boll.lower),
    };
  }, [ema20, ema50, ema200, rsi14, macdObj, atr14, vwap, volumeSma20, boll]);

  useEffect(() => {
    async function loadSymbols() {
      try {
        const res = await fetch(`${API_BASE}/symbols?market=${market}&limit=500`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`symbols failed: ${res.status}`);
        const json = await res.json();
        setSymbols(normalizeSymbolList(json));
      } catch {
        setSymbols([]);
      }
    }

    loadSymbols();
  }, [market]);

  useEffect(() => {
    let active = true;

    async function loadMain() {
      try {
        setLoading(true);
        setError('');

        const [klinesRes, signalsRes] = await Promise.all([
          fetch(
            `${API_BASE}/klines?market=${market}&symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=300`,
            { cache: 'no-store' }
          ),
          fetch(
            `${API_BASE}/signals/active?market=${market}&symbol=${encodeURIComponent(symbol)}`,
            { cache: 'no-store' }
          ).catch(() => null as any),
        ]);

        if (!klinesRes.ok) throw new Error(`klines failed: ${klinesRes.status}`);

        const klinesJson = await klinesRes.json();
        const nextCandles = normalizeCandles(klinesJson);

        let nextSignals = 0;
        if (signalsRes && signalsRes.ok) {
          const sigJson = await signalsRes.json();
          nextSignals = Array.isArray(sigJson) ? sigJson.length : Array.isArray(sigJson?.items) ? sigJson.items.length : 0;
        }

        if (active) {
          setCandles(nextCandles);
          setActiveSignals(nextSignals);
        }
      } catch (e: any) {
        if (active) {
          setError(e?.message || 'Grafik verisi alınamadı');
          setCandles([]);
          setActiveSignals(0);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    async function loadTfBias() {
      try {
        const tfs = ['1m', '5m', '15m', '1h'] as const;
        const results = await Promise.all(
          tfs.map(async (tf) => {
            const res = await fetch(
              `${API_BASE}/klines?market=${market}&symbol=${encodeURIComponent(symbol)}&interval=${tf}&limit=200`,
              { cache: 'no-store' }
            );
            if (!res.ok) throw new Error(`tf failed ${tf}`);
            const json = await res.json();
            const closes = normalizeCandles(json).map((x) => x.close);
            return [tf, buildBias(closes)] as const;
          })
        );
        if (active) setTfBias(Object.fromEntries(results));
      } catch {
        if (active) setTfBias({});
      }
    }

    loadMain();
    loadTfBias();

    const timer = window.setInterval(() => {
      loadMain();
      loadTfBias();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [market, symbol, interval]);

  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;

    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111827' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      width: chartRef.current.clientWidth,
      height: 460,
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {});
    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    const makeLine = (color: string, width = 2) =>
      chart.addSeries(LineSeries, {
        color,
        lineWidth: width,
        priceLineVisible: false,
        lastValueVisible: false,
      });

    const seriesBag: any[] = [];

    if (showEMA20) {
      const s = makeLine('#22c55e', 2);
      s.setData(candles.map((c, i) => ({ time: c.time as any, value: ema20[i] })).filter((x) => x.value != null) as any);
      seriesBag.push(s);
    }

    if (showEMA50) {
      const s = makeLine('#60a5fa', 2);
      s.setData(candles.map((c, i) => ({ time: c.time as any, value: ema50[i] })).filter((x) => x.value != null) as any);
      seriesBag.push(s);
    }

    if (showEMA200) {
      const s = makeLine('#f59e0b', 2);
      s.setData(candles.map((c, i) => ({ time: c.time as any, value: ema200[i] })).filter((x) => x.value != null) as any);
      seriesBag.push(s);
    }

    if (showBoll) {
      const upper = makeLine('#a78bfa', 1);
      const mid = makeLine('#94a3b8', 1);
      const lower = makeLine('#a78bfa', 1);

      upper.setData(candles.map((c, i) => ({ time: c.time as any, value: boll.upper[i] })).filter((x) => x.value != null) as any);
      mid.setData(candles.map((c, i) => ({ time: c.time as any, value: boll.mid[i] })).filter((x) => x.value != null) as any);
      lower.setData(candles.map((c, i) => ({ time: c.time as any, value: boll.lower[i] })).filter((x) => x.value != null) as any);

      seriesBag.push(upper, mid, lower);
    }

    if (showVWAP) {
      const s = makeLine('#06b6d4', 2);
      s.setData(candles.map((c, i) => ({ time: c.time as any, value: vwap[i] })).filter((x) => x.value != null) as any);
      seriesBag.push(s);
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (!chartRef.current) return;
      chart.applyOptions({ width: chartRef.current.clientWidth });
    });
    ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
      seriesBag.forEach((s) => {
        try {
          chart.removeSeries(s);
        } catch {}
      });
      chart.remove();
    };
  }, [candles, ema20, ema50, ema200, boll, vwap, showEMA20, showEMA50, showEMA200, showBoll, showVWAP]);

  function applySymbol(next: string) {
    const s = next.toUpperCase();
    setSymbol(s);
    const url = new URL(window.location.href);
    url.searchParams.set('symbol', s);
    window.history.replaceState({}, '', url.toString());
  }

  return (
    <main className="ttook-page">
      <div className="ttook-hero">
        <div>
          <div className="ttook-hero-title">Grafik</div>
          <div className="ttook-hero-subtitle">Canlı grafik • indikatörler • zaman dilimi yön tahmini</div>
        </div>
      </div>

      <div className="ttook-card" style={{ marginTop: 16 }}>
        <div className="ttook-card-title">Piyasa</div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="ttook-button" onClick={() => setMarket('spot')}>Spot</button>
          <button className="ttook-button" onClick={() => setMarket('futures')}>Futures (USDT.P)</button>

          <button className="ttook-button" onClick={() => setIntervalState('1m')}>1m</button>
          <button className="ttook-button" onClick={() => setIntervalState('5m')}>5m</button>
          <button className="ttook-button" onClick={() => setIntervalState('15m')}>15m</button>
          <button className="ttook-button" onClick={() => setIntervalState('1h')}>1h</button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="ttook-button" onClick={() => setShowEMA20((v) => !v)}>EMA20</button>
          <button className="ttook-button" onClick={() => setShowEMA50((v) => !v)}>EMA50</button>
          <button className="ttook-button" onClick={() => setShowEMA200((v) => !v)}>EMA200</button>
          <button className="ttook-button" onClick={() => setShowBoll((v) => !v)}>Bollinger</button>
          <button className="ttook-button" onClick={() => setShowVWAP((v) => !v)}>VWAP</button>
          <button className="ttook-button" onClick={() => setShowRSI((v) => !v)}>RSI</button>
          <button className="ttook-button" onClick={() => setShowMACD((v) => !v)}>MACD</button>
          <button className="ttook-button" onClick={() => setShowATR((v) => !v)}>ATR</button>
          <button className="ttook-button" onClick={() => setShowVolMA((v) => !v)}>VolSMA20</button>
        </div>

        <div style={{ marginTop: 12 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            placeholder={market === 'futures' ? 'Futures coin ara: BTC, ETH, SOL...' : 'Spot coin ara...'}
            className="ttook-input"
            style={{ width: '100%' }}
          />
        </div>

        <div className="ttook-muted" style={{ marginTop: 10 }}>
          {filteredSymbols.length} coin bulundu
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {filteredSymbols.slice(0, 30).map((s) => (
            <button
              key={s}
              className="ttook-chip"
              onClick={() => applySymbol(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="ttook-grid" style={{ marginTop: 16 }}>
        <div className="ttook-card" style={{ gridColumn: '1 / span 2' }}>
          <div className="ttook-card-title">
            {symbol} • {interval}
          </div>

          <div className="ttook-muted" style={{ marginTop: 8 }}>
            {loading ? 'Canlı akış yükleniyor...' : error ? `Hata: ${error}` : `Aktif sinyaller: ${activeSignals}`}
          </div>

          <div ref={chartRef} style={{ width: '100%', minHeight: 460, marginTop: 16 }} />
        </div>

        <div className="ttook-card">
          <div className="ttook-card-title">İndikatörler</div>

          <div style={{ marginTop: 10 }}>EMA20: {indicatorSummary.ema20 != null ? fmtPrice(indicatorSummary.ema20) : '-'}</div>
          <div>EMA50: {indicatorSummary.ema50 != null ? fmtPrice(indicatorSummary.ema50) : '-'}</div>
          <div>EMA200: {indicatorSummary.ema200 != null ? fmtPrice(indicatorSummary.ema200) : '-'}</div>

          {showBoll && (
            <>
              <div style={{ marginTop: 8 }}>BB Upper: {indicatorSummary.bbUpper != null ? fmtPrice(indicatorSummary.bbUpper) : '-'}</div>
              <div>BB Mid: {indicatorSummary.bbMid != null ? fmtPrice(indicatorSummary.bbMid) : '-'}</div>
              <div>BB Lower: {indicatorSummary.bbLower != null ? fmtPrice(indicatorSummary.bbLower) : '-'}</div>
            </>
          )}

          {showVWAP && <div style={{ marginTop: 8 }}>VWAP: {indicatorSummary.vwap != null ? fmtPrice(indicatorSummary.vwap) : '-'}</div>}
          {showRSI && <div style={{ marginTop: 8 }}>RSI14: {indicatorSummary.rsi != null ? indicatorSummary.rsi.toFixed(2) : '-'}</div>}

          {showMACD && (
            <>
              <div style={{ marginTop: 8 }}>MACD: {indicatorSummary.macd != null ? indicatorSummary.macd.toFixed(5) : '-'}</div>
              <div>Signal: {indicatorSummary.signal != null ? indicatorSummary.signal.toFixed(5) : '-'}</div>
              <div>Hist: {indicatorSummary.hist != null ? indicatorSummary.hist.toFixed(5) : '-'}</div>
            </>
          )}

          {showATR && <div style={{ marginTop: 8 }}>ATR14: {indicatorSummary.atr != null ? indicatorSummary.atr.toFixed(5) : '-'}</div>}
          {showVolMA && <div style={{ marginTop: 8 }}>Vol SMA20: {indicatorSummary.volSma20 != null ? indicatorSummary.volSma20.toFixed(2) : '-'}</div>}
        </div>
      </div>

      <div className="ttook-card" style={{ marginTop: 16 }}>
        <div className="ttook-card-title">Zaman Dilimi Yön Tahmini</div>

        <div className="ttook-grid" style={{ marginTop: 12 }}>
          {['1m', '5m', '15m', '1h'].map((tf) => (
            <div key={tf} className="ttook-card">
              <div className="ttook-card-title">{tf}</div>
              <div style={{ marginTop: 8 }}>{tfBias[tf]?.label || '-'}</div>
              <div className="ttook-muted" style={{ marginTop: 6 }}>
                {tfBias[tf]?.reason || ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function ChartPage() {
  return (
    <Suspense
      fallback={
        <main className="ttook-page">
          <div className="ttook-card">Grafik yükleniyor...</div>
        </main>
      }
    >
      <ChartPageInner />
    </Suspense>
  );
}