'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { tools } from '@/lib/tools';

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="site-nav">
      <Link href="/" className="nav-brand" aria-label="Dr Nathan Tools home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/Dr%20Nathan%20Logo.png"
          alt="Dr Nathan"
          className="brand-logo"
        />
        <span className="brand-suffix">Tools</span>
      </Link>

      <div className="nav-links">
        {tools.map((tool) => {
          const active =
            pathname === tool.href || pathname.startsWith(`${tool.href}/`);
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className={`nav-link${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {tool.short}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
