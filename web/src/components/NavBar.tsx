'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Radar' },
  { href: '/alarms', label: 'Alarm Geçmişi' },
  { href: '/chart', label: 'Grafik' },
  { href: '/signals', label: 'Sinyaller' },
  { href: '/whales', label: 'Balina Radar' },
  { href: '/ai', label: 'AI Odası' },
  { href: '/spot', label: 'Spot Uzun Vade' },
  { href: '/system', label: 'Sistem' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="ttook-nav">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? 'ttook-nav-link active' : 'ttook-nav-link'}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
