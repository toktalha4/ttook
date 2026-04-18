import './globals.css';
import NavBar from '../components/NavBar';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TTOOK',
  description: 'Futures Radar + Balina Radar + AI Odası + Spot Uzun Vade',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>
        <div className="ttook-shell">
          <header className="ttook-hero">
            <div className="ttook-hero-top">
              <div>
                <div className="ttook-logo">TTOOK</div>
                <div className="ttook-hero-sub">
                  Futures Radar + Balina Radar + AI Odası + Spot Uzun Vade
                </div>
              </div>

              <div className="ttook-hero-badges">
                <span className="ttook-badge">Futures canlı akış</span>
                <span className="ttook-badge">AI destekli yorum</span>
                <span className="ttook-badge">Premium panel</span>
              </div>
            </div>
          </header>

          <div className="ttook-container">
            <NavBar />
            <section className="ttook-content">{children}</section>
          </div>

          <footer className="ttook-footer">
            <div>TTOOK • premium futures kontrol merkezi</div>
            <div className="ttook-muted">
              Eğitim amaçlı analiz ekranı
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
