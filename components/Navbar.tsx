'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      gap: '2rem', 
      padding: '1.5rem', 
      marginBottom: '2rem',
      background: 'var(--panel)',
      backdropFilter: 'var(--glass)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: '0',
      zIndex: '100'
    }}>
      <Link href="/" style={{
        textDecoration: 'none',
        color: pathname === '/' ? 'var(--accent)' : 'var(--text-dim)',
        fontWeight: pathname === '/' ? '700' : '500',
        padding: '0.5rem 1rem',
        borderRadius: '0.5rem',
        transition: 'all 0.3s ease',
        background: pathname === '/' ? 'rgba(37, 99, 235, 0.1)' : 'transparent'
      }}>
        Facebook Tool
      </Link>
      <Link href="/tiktok" style={{
        textDecoration: 'none',
        color: pathname === '/tiktok' ? 'var(--accent)' : 'var(--text-dim)',
        fontWeight: pathname === '/tiktok' ? '700' : '500',
        padding: '0.5rem 1rem',
        borderRadius: '0.5rem',
        transition: 'all 0.3s ease',
        background: pathname === '/tiktok' ? 'rgba(37, 99, 235, 0.1)' : 'transparent'
      }}>
        TikTok Tool
      </Link>
    </nav>
  );
}
