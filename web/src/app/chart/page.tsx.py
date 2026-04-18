export default function ChartPage() {
  return (
    <main>
      <h2 className="ttook-section-title">Grafik</h2>

      <div className="ttook-two-col">
        <div className="ttook-card">
          <div className="ttook-chart-box">
            Grafik alanı buraya gelecek
          </div>
        </div>

        <div className="ttook-card">
          <div className="ttook-card-title">BTCUSDT</div>
          <div className="ttook-pill long">Long</div>
          <div className="ttook-muted">Giriş: <strong>84250</strong></div>
          <div className="ttook-muted">TP1: <strong>84800</strong></div>
          <div className="ttook-muted">TP2: <strong>85350</strong></div>
          <div className="ttook-muted">TP3: <strong>86100</strong></div>
          <div className="ttook-muted">Stop: <strong>83690</strong></div>
        </div>
      </div>
    </main>
  );
}
