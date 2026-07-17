import type { CSSProperties } from 'react';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import ToolIcon from '@/components/ToolIcon';
import { tools } from '@/lib/tools';

export default function Home() {
  return (
    <main className="container">
      <header className="header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/Dr%20Nathan%20Logo.png"
          alt="Dr Nathan"
          className="hero-logo"
        />
        <span className="badge">🧰 Marketing Toolkit</span>
        <h1>Dr Nathan Tools</h1>
        <p>
          A suite of focused marketing tools — extract comments into sheets, build ad reports,
          style text and add emojis. Pick a tool to get started.
        </p>
      </header>

      <div className="tool-grid">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="tool-card"
            style={{ '--card-accent': tool.accent } as CSSProperties}
          >
            <span className="tool-icon" aria-hidden="true">
              <ToolIcon id={tool.id} size={30} />
            </span>
            <h3>{tool.label}</h3>
            <p>{tool.description}</p>
            <span className="tool-cta">Open tool →</span>
          </Link>
        ))}
      </div>

      <SiteFooter />
    </main>
  );
}
