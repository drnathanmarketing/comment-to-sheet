'use client';

import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import SiteFooter from '@/components/SiteFooter';
import ToolIcon from '@/components/ToolIcon';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface ViberMessages {
  total: number;
  text: number;
  pictures: number;
  video: number;
  files: number;
  url: number;
  total_comments: number;
}

interface ViberMembers {
  join: number;
  left: number;
}

interface ViberDailyMetric {
  date: string;
  likes: number;
  dau: number;
  wau: number;
  twau: number;
  mau: number;
  messages: ViberMessages;
  members: ViberMembers;
}

interface ViberDemographic {
  gender: Record<string, number>;
  age_groups: Record<string, number>;
  top_countries: Record<string, number>;
}

interface ViberInsightData {
  daily_metrics: ViberDailyMetric[];
  demographic: ViberDemographic;
  community_id: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function calcSummary(metrics: ViberDailyMetric[]) {
  const totalLikes = metrics.reduce((s, m) => s + m.likes, 0);
  const avgDAU = metrics.length ? Math.round(metrics.reduce((s, m) => s + m.dau, 0) / metrics.length) : 0;
  const peakDAU = Math.max(...metrics.map(m => m.dau));
  const peakDate = metrics.find(m => m.dau === peakDAU)?.date ?? '—';
  const totalMessages = metrics.reduce((s, m) => s + m.messages.total, 0);
  const totalJoins = metrics.reduce((s, m) => s + m.members.join, 0);
  const totalLeaves = metrics.reduce((s, m) => s + m.members.left, 0);
  const latestMAU = metrics[metrics.length - 1]?.mau ?? 0;
  const latestWAU = metrics[metrics.length - 1]?.wau ?? 0;
  return { totalLikes, avgDAU, peakDAU, peakDate, totalMessages, totalJoins, totalLeaves, latestMAU, latestWAU };
}

/* ─── Export ─────────────────────────────────────────────────────────────── */
function exportToExcel(data: ViberInsightData) {
  const wb = XLSX.utils.book_new();

  /* Sheet 1 – Daily Metrics */
  const dailyRows = data.daily_metrics.map(m => ({
    'Date': formatDate(m.date),
    'Likes': m.likes,
    'Daily Active Users': m.dau,
    'Weekly Active Users': m.wau,
    '14-Day Active Users': m.twau,
    'Monthly Active Users': m.mau,
    'Total Messages': m.messages.total,
    'Text Messages': m.messages.text,
    'Pictures': m.messages.pictures,
    'Videos': m.messages.video,
    'Files': m.messages.files,
    'URLs': m.messages.url,
    'Total Comments': m.messages.total_comments,
    'Members Joined': m.members.join,
    'Members Left': m.members.left,
  }));
  const ws1 = XLSX.utils.json_to_sheet(dailyRows);

  // Column widths
  ws1['!cols'] = [
    { wch: 16 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 8 },
    { wch: 16 }, { wch: 16 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Daily Metrics');

  /* Sheet 2 – Summary */
  const s = calcSummary(data.daily_metrics);
  const summaryRows = [
    { 'Metric': 'Community ID', 'Value': data.community_id },
    { 'Metric': 'Report Period Start', 'Value': formatDate(data.daily_metrics[0]?.date ?? '') },
    { 'Metric': 'Report Period End', 'Value': formatDate(data.daily_metrics[data.daily_metrics.length - 1]?.date ?? '') },
    { 'Metric': 'Total Days', 'Value': data.daily_metrics.length },
    { 'Metric': '', 'Value': '' },
    { 'Metric': '── Engagement ──', 'Value': '' },
    { 'Metric': 'Total Likes', 'Value': s.totalLikes },
    { 'Metric': 'Total Messages Sent', 'Value': s.totalMessages },
    { 'Metric': '', 'Value': '' },
    { 'Metric': '── Audience ──', 'Value': '' },
    { 'Metric': 'Monthly Active Users', 'Value': s.latestMAU },
    { 'Metric': 'Weekly Active Users', 'Value': s.latestWAU },
    { 'Metric': 'Average Daily Active', 'Value': s.avgDAU },
    { 'Metric': 'Peak Daily Active', 'Value': s.peakDAU },
    { 'Metric': 'Peak Daily Active Date', 'Value': formatDate(s.peakDate) },
    { 'Metric': '', 'Value': '' },
    { 'Metric': '── Members ──', 'Value': '' },
    { 'Metric': 'Total Joins', 'Value': s.totalJoins },
    { 'Metric': 'Total Leaves', 'Value': s.totalLeaves },
    { 'Metric': 'Net Change', 'Value': s.totalJoins - s.totalLeaves },
  ];
  const ws2 = XLSX.utils.json_to_sheet(summaryRows);
  ws2['!cols'] = [{ wch: 24 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  /* Sheet 3 – Demographics (if present) */
  const hasGender = Object.keys(data.demographic.gender).length > 0;
  const hasAge = Object.keys(data.demographic.age_groups).length > 0;
  const hasCountry = Object.keys(data.demographic.top_countries).length > 0;

  if (hasGender || hasAge || hasCountry) {
    const demoRows: { Category: string; Key: string; Value: number }[] = [];
    Object.entries(data.demographic.gender).forEach(([k, v]) => demoRows.push({ Category: 'Gender', Key: k, Value: v }));
    Object.entries(data.demographic.age_groups).forEach(([k, v]) => demoRows.push({ Category: 'Age Group', Key: k, Value: v }));
    Object.entries(data.demographic.top_countries).forEach(([k, v]) => demoRows.push({ Category: 'Country', Key: k, Value: v }));
    const ws3 = XLSX.utils.json_to_sheet(demoRows);
    ws3['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Demographics');
  }

  const dateTag = data.daily_metrics[data.daily_metrics.length - 1]?.date ?? 'export';
  XLSX.writeFile(wb, `viber_insights_${data.community_id}_${dateTag}.xlsx`);
}

/* ─── KPI Card ───────────────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.9)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(226,232,240,0.8)',
      borderRadius: '1.25rem',
      padding: '1.5rem',
      boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.4rem',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.07)'; }}
    >
      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ fontSize: '2rem', fontWeight: 800, color: color ?? '#1e293b', lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{sub}</span>}
    </div>
  );
}

/* ─── Inline Badge ───────────────────────────────────────────────────────── */
function Badge({ val, active }: { val: string | number; active?: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.15rem 0.55rem',
      borderRadius: '999px',
      fontSize: '0.82rem',
      fontWeight: 600,
      background: active ? 'rgba(37,99,235,0.12)' : '#f1f5f9',
      color: active ? '#2563eb' : '#475569',
    }}>{val}</span>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */
export default function ViberPage() {
  const [data, setData] = useState<ViberInsightData | null>(null);
  const [error, setError] = useState<string>('');
  const [dragging, setDragging] = useState(false);
  const [rawText, setRawText] = useState('');

  const parseJSON = useCallback((text: string) => {
    try {
      setError('');
      const parsed = JSON.parse(text) as ViberInsightData;
      if (!parsed.daily_metrics || !Array.isArray(parsed.daily_metrics)) {
        throw new Error('JSON must contain a "daily_metrics" array.');
      }
      setData(parsed);
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setRawText(text);
      parseJSON(text);
    };
    reader.readAsText(file);
  }, [parseJSON]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const summary = data ? calcSummary(data.daily_metrics) : null;

  return (
    <main className="container">
      {/* ── Header ── */}
      <header className="header">
        <span className="tool-logo" aria-hidden="true"><ToolIcon id="viber" size={40} /></span>
        <h1>Viber Insights</h1>
        <p>
          Upload your Viber community JSON export and instantly convert it to a professional Excel report.
        </p>
      </header>

      {/* ── Upload Zone ── */}
      <div
        className="glass-panel"
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          marginBottom: '2rem',
          border: dragging ? '2px dashed #7c3aed' : '2px dashed rgba(226,232,240,0.8)',
          background: dragging ? 'rgba(124,58,237,0.05)' : undefined,
          transition: 'all 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Drop zone */}
          <label htmlFor="viber-file-input" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            border: '2px dashed #cbd5e1',
            borderRadius: '1rem',
            minWidth: '220px',
            padding: '2rem 1.5rem',
            cursor: 'pointer',
            background: '#f8fafc',
            transition: 'all 0.2s ease',
            flex: '0 0 auto',
          }}>
            <span style={{ fontSize: '2.5rem' }}>📂</span>
            <span style={{ fontWeight: 600, color: '#475569', fontSize: '0.95rem', textAlign: 'center' }}>
              Click to upload<br /><span style={{ fontWeight: 400, color: '#94a3b8' }}>.json file</span>
            </span>
            <input
              id="viber-file-input"
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </label>

          {/* Text paste */}
          <div style={{ flex: 1, minWidth: '260px' }}>
            <label htmlFor="viber-json-input" style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              Or paste JSON directly
            </label>
            <textarea
              id="viber-json-input"
              placeholder={'{\n  "daily_metrics": [...],\n  "demographic": {...},\n  "community_id": "..."\n}'}
              value={rawText}
              onChange={e => { setRawText(e.target.value); }}
              style={{ minHeight: '160px', fontSize: '0.85rem', fontFamily: 'monospace', resize: 'vertical' }}
            />
            <button
              id="viber-parse-btn"
              className="btn-primary"
              style={{ marginTop: '0.75rem', background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
              onClick={() => parseJSON(rawText)}
            >
              <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Analyze
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            marginTop: '1rem',
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            color: '#dc2626',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* ── Results ── */}
      {data && summary && (
        <div style={{ animation: 'fadeInDown 0.5s ease-out' }}>
          {/* Community info bar */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            marginBottom: '1.5rem',
            padding: '1rem 1.5rem',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(37,99,235,0.08))',
            borderRadius: '1rem',
            border: '1px solid rgba(124,58,237,0.15)',
          }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: '#7c3aed', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Community ID</span>
              <p style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem', marginTop: '0.2rem' }}>{data.community_id}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Period</span>
              <p style={{ fontWeight: 600, color: '#334155' }}>{formatDate(data.daily_metrics[0]?.date ?? '')} → {formatDate(data.daily_metrics[data.daily_metrics.length - 1]?.date ?? '')}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Days Tracked</span>
              <p style={{ fontWeight: 700, color: '#1e293b', fontSize: '1.2rem' }}>{data.daily_metrics.length}</p>
            </div>
            <button
              id="viber-export-btn"
              onClick={() => exportToExcel(data)}
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #059669, #10b981)', flexShrink: 0 }}
            >
              <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export to Excel (.xlsx)
            </button>
          </div>

          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <KpiCard label="Monthly Active" value={summary.latestMAU.toLocaleString()} color="#7c3aed" />
            <KpiCard label="Weekly Active" value={summary.latestWAU.toLocaleString()} color="#2563eb" />
            <KpiCard label="Avg Daily Active" value={summary.avgDAU.toLocaleString()} color="#0891b2" />
            <KpiCard label="Peak Daily Active" value={summary.peakDAU.toLocaleString()} sub={formatDate(summary.peakDate)} color="#ea580c" />
            <KpiCard label="Total Likes" value={summary.totalLikes.toLocaleString()} color="#dc2626" />
            <KpiCard label="Total Messages" value={summary.totalMessages.toLocaleString()} color="#059669" />
            <KpiCard label="Members Left" value={summary.totalLeaves} sub={`+${summary.totalJoins} joined`} color="#b45309" />
          </div>

          {/* Daily Table */}
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>
                Daily Metrics
                <span style={{ marginLeft: '0.75rem', fontSize: '0.9rem', fontWeight: 500, color: '#64748b' }}>
                  ({data.daily_metrics.length} rows)
                </span>
              </h2>
            </div>

            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: '900px' }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: '120px' }}>Date</th>
                    <th>Likes</th>
                    <th>Daily Active</th>
                    <th>Weekly Active</th>
                    <th>14-Day Active</th>
                    <th>Monthly Active</th>
                    <th>Msgs Total</th>
                    <th>Text</th>
                    <th>Pics</th>
                    <th>Video</th>
                    <th>Files</th>
                    <th>Comments</th>
                    <th>Joined</th>
                    <th>Left</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily_metrics.map((m, i) => {
                    const isHighEngagement = m.likes > 10 || m.dau > 50;
                    return (
                      <tr key={m.date} style={{ background: isHighEngagement ? 'rgba(124,58,237,0.04)' : i % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                        <td style={{ fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                          {isHighEngagement && <span style={{ marginRight: '0.35rem' }}>⭐</span>}
                          {formatDate(m.date)}
                        </td>
                        <td><Badge val={m.likes} active={m.likes > 0} /></td>
                        <td style={{ fontWeight: m.dau > 50 ? 700 : 400, color: m.dau > 50 ? '#7c3aed' : '#334155' }}>{m.dau}</td>
                        <td>{m.wau}</td>
                        <td>{m.twau}</td>
                        <td style={{ fontWeight: 600 }}>{m.mau}</td>
                        <td><Badge val={m.messages.total} active={m.messages.total > 0} /></td>
                        <td>{m.messages.text}</td>
                        <td>{m.messages.pictures}</td>
                        <td>{m.messages.video}</td>
                        <td>{m.messages.files}</td>
                        <td><Badge val={m.messages.total_comments} active={m.messages.total_comments > 0} /></td>
                        <td style={{ color: m.members.join > 0 ? '#059669' : undefined, fontWeight: m.members.join > 0 ? 700 : 400 }}>
                          {m.members.join > 0 ? `+${m.members.join}` : m.members.join}
                        </td>
                        <td style={{ color: m.members.left > 0 ? '#dc2626' : undefined, fontWeight: m.members.left > 0 ? 700 : 400 }}>
                          {m.members.left > 0 ? `-${m.members.left}` : m.members.left}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Demographics (shown only if data exists) */}
          {(Object.keys(data.demographic.gender).length > 0 ||
            Object.keys(data.demographic.age_groups).length > 0 ||
            Object.keys(data.demographic.top_countries).length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
              {Object.keys(data.demographic.gender).length > 0 && (
                <div className="glass-panel">
                  <h3 style={{ fontWeight: 700, marginBottom: '1rem', color: '#7c3aed' }}>Gender</h3>
                  {Object.entries(data.demographic.gender).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: '#475569' }}>{k}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
              )}
              {Object.keys(data.demographic.age_groups).length > 0 && (
                <div className="glass-panel">
                  <h3 style={{ fontWeight: 700, marginBottom: '1rem', color: '#2563eb' }}>Age Groups</h3>
                  {Object.entries(data.demographic.age_groups).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: '#475569' }}>{k}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
              )}
              {Object.keys(data.demographic.top_countries).length > 0 && (
                <div className="glass-panel">
                  <h3 style={{ fontWeight: 700, marginBottom: '1rem', color: '#0891b2' }}>Top Countries</h3>
                  {Object.entries(data.demographic.top_countries).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: '#475569' }}>{k}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Export CTA bottom */}
          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <button
              id="viber-export-btn-bottom"
              onClick={() => exportToExcel(data)}
              className="btn-primary"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
                padding: '1rem 2.5rem',
                fontSize: '1rem',
                borderRadius: '1rem',
                boxShadow: '0 8px 24px rgba(124,58,237,0.25)',
              }}
            >
              <svg style={{ width: 20, height: 20 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Excel Report
            </button>
            <p style={{ marginTop: '0.6rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              Exports 3 sheets: Daily Metrics · Summary · Demographics
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!data && !error && (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.4 }}>📊</div>
          <p style={{ fontSize: '1.05rem', fontWeight: 500 }}>Upload or paste your Viber JSON to get started.</p>
          <p style={{ fontSize: '0.9rem', marginTop: '0.4rem' }}>Supports the standard Viber Community Insights export format.</p>
        </div>
      )}

      <SiteFooter />
    </main>
  );
}
