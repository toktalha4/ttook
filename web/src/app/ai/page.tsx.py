'use client';

import { useEffect, useState } from 'react';

type AiItem = {
  title: string;
  text: string;
};

export default function AiPage() {
  const [items, setItems] = useState<AiItem[]>([]);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/ai')
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <main>
      <h2 className="ttook-section-title">AI Odası</h2>

      <div className="ttook-grid">
        {items.map((item) => (
          <div className="ttook-card" key={item.title}>
            <div className="ttook-card-title">{item.title}</div>
            <div className="ttook-pill ai">AI</div>
            <div className="ttook-muted">{item.text}</div>
          </div>
        ))}
      </div>
    </main>
  );
}