from pathlib import Path

path = Path(r"C:\ttook\web\src\app\ai\page.tsx")
text = path.read_text(encoding="utf-8")

if "const [copyStatus, setCopyStatus] = useState('');" not in text:
    text = text.replace(
        "  const [lastRefresh, setLastRefresh] = useState('-');\n",
        "  const [lastRefresh, setLastRefresh] = useState('-');\n  const [copyStatus, setCopyStatus] = useState('');\n",
        1,
    )

if "function buildTelegramPost(item: AiCoin)" not in text:
    marker = "function alarmClass(alarm: string) {\n"
    add = """function buildTelegramPost(item: AiCoin) {
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
- ${item.reasonLines.join("\\n- ")}

📚 Orderbook Baskisi
- Baski: ${item.orderBook.pressure}
- Denge: %${item.orderBook.imbalancePct}
- Canli spread: ${item.orderBook.liveSpreadBps ?? '-'} bps

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

"""
    text = text.replace(marker, add + marker, 1)

if "Telegram’a Hazır Premium Post" not in text:
    marker = """          <div style={{ marginTop: 18 }} className="ttook-muted">
            ⚠️ <strong>{item.disclaimer}</strong>
          </div>
        </div>
      )}
    </main>
  );
}
"""
    add = """          <div style={{ marginTop: 18 }} className="ttook-muted">
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
      )}
    </main>
  );
}
"""
    text = text.replace(marker, add, 1)

path.write_text(text, encoding="utf-8")
print("AI premium post box patch tamam")
