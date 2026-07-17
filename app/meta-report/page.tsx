'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import SiteFooter from '@/components/SiteFooter';
import ToolIcon from '@/components/ToolIcon';
import {
  MetaAdRow,
  ColumnMapping,
  cleanNumeric,
  cleanString,
  findHeaderRow,
  autoMapColumns,
  parseCleanRows,
  detectObjective
} from '@/lib/meta-parser';

export default function MetaReportPage() {
  // Page phases
  const [phase, setPhase] = useState<'upload' | 'mapping' | 'edit'>('upload');
  
  // File details
  const [fileName, setFileName] = useState<string>('');
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
  
  // Column mapping states
  const [mapping, setMapping] = useState<ColumnMapping>({
    campaignNameIdx: -1,
    adNameIdx: -1,
    resultTypeIdx: -1,
    resultsIdx: -1,
    reachIdx: -1,
    impressionsIdx: -1,
    cprIdx: -1,
    frequencyIdx: -1,
    linkClicksIdx: -1,
    messagesIdx: -1,
    costPerMessageIdx: -1,
    newMessagesIdx: -1,
    costPerNewMessageIdx: -1,
    viewsIdx: -1
  });

  // Clean parsed data state
  const [parsedData, setParsedData] = useState<MetaAdRow[]>([]);
  const [exportFontSize, setExportFontSize] = useState<number>(10); // Default 10 (size 10 on Google Sheets)
  const [error, setError] = useState<string>('');
  const [dragging, setDragging] = useState(false);

  // ── Audience metric labelling toggle ──────────────────────────────────────
  // OFF (default): show "Reach" / "Impressions".
  // ON:            relabel the same numbers as "Viewers" / "Views".
  const [useViewsLabel, setUseViewsLabel] = useState<boolean>(false);
  const reachLabel = useViewsLabel ? 'Viewers' : 'Reach';
  const impressionsLabel = useViewsLabel ? 'Views' : 'Impressions';

  // ─── Shared: push rows into the mapping pipeline ──────────────────────────
  const processRows = useCallback((rows: string[][], name: string) => {
    if (rows.length < 2) {
      setError('The uploaded file is empty or has no data rows.');
      return;
    }
    const { index: hIdx, headers } = findHeaderRow(rows);
    const autoMap = autoMapColumns(headers);

    setRawRows(rows);
    setDetectedHeaders(headers);
    setHeaderRowIdx(hIdx);
    setMapping(autoMap);

    // ── Auto-advance: skip mapping UI if critical columns are detected ──
    const hasIdentity   = autoMap.campaignNameIdx !== -1 || autoMap.adNameIdx !== -1;
    const hasReach      = autoMap.reachIdx !== -1;
    const hasImpressions = autoMap.impressionsIdx !== -1;
    const mappedCount   = Object.values(autoMap).filter(v => v !== -1).length;

    if (hasIdentity && hasReach && hasImpressions && mappedCount >= 4) {
      try {
        const cleanData = parseCleanRows(rows, hIdx, autoMap);
        if (cleanData.length > 0) {
          setParsedData(cleanData);
          setPhase('edit');
          setError('');
          return;
        }
      } catch { /* fall through to mapping UI */ }
    }

    setPhase('mapping');
  }, []);

  // ─── Phase 1a: CSV Upload Handling ────────────────────────────────────────
  const handleCSVParse = useCallback((file: File) => {
    setError('');
    setFileName(file.name);
    Papa.parse<string[]>(file, {
      skipEmptyLines: 'greedy',
      encoding: 'UTF-8',
      complete: (results) => processRows(results.data, file.name),
      error: (err) => setError(`CSV Parsing Error: ${err.message}`),
    });
  }, [processRows]);

  // ─── Phase 1b: Excel Upload Handling (.xlsx / .xls) ───────────────────────
  const handleExcelParse = useCallback((file: File) => {
    setError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: string[][] = XLSX.utils.sheet_to_json<string[]>(worksheet, {
          header: 1,
          defval: '',
          raw: false,
        });
        processRows(rows, file.name);
      } catch (e) {
        setError(`Excel Parsing Error: ${(e as Error).message}`);
      }
    };
    reader.onerror = () => setError('Failed to read the Excel file.');
    reader.readAsArrayBuffer(file);
  }, [processRows]);

  // ─── Unified file dispatcher ───────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv')) {
      handleCSVParse(file);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      handleExcelParse(file);
    } else {
      setError('Please upload a valid file (.csv, .xlsx, or .xls).');
    }
  }, [handleCSVParse, handleExcelParse]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // ─── Column Map Adjustment Handler ────────────────────────────────────────
  const handleMapChange = (field: keyof ColumnMapping, valStr: string) => {
    const val = parseInt(valStr, 10);
    setMapping(prev => ({
      ...prev,
      [field]: val
    }));
  };

  const confirmMappingAndAnalyze = () => {
    if (mapping.campaignNameIdx === -1 && mapping.adNameIdx === -1) {
      setError('You must map at least the Campaign Name or Ad Name column.');
      return;
    }

    try {
      const cleanData = parseCleanRows(rawRows, headerRowIdx, mapping);
      if (cleanData.length === 0) {
        setError('No valid ad rows were found. Check your filters (we automatically skip totals).');
        return;
      }
      setParsedData(cleanData);
      setPhase('edit');
      setError('');
    } catch (e) {
      setError(`Failed to map clean rows: ${(e as Error).message}`);
    }
  };

  // ─── Inline Table Edits ───────────────────────────────────────────────────
  const updateRowField = (id: string, field: keyof MetaAdRow, value: any) => {
    setParsedData(prev => prev.map(row => {
      if (row.id === id) {
        const updated = { ...row, [field]: value };
        // If objective changes, auto-adjust standard fields
        if (field === 'objective') {
          const newObjective = value as MetaAdRow['objective'];
          if (newObjective === 'Awareness') {
            updated.resultType = 'Reach';
          } else if (newObjective === 'Engagement') {
            updated.resultType = 'Engagement';
          } else if (newObjective === 'Page Follower') {
            updated.resultType = 'Page Like';
          } else if (newObjective === 'Thruplay') {
            updated.resultType = 'Thruplay';
          } else if (newObjective === 'Message') {
            updated.resultType = 'Message';
          }
        }
        return updated;
      }
      return row;
    }));
  };

  const deleteRow = (id: string) => {
    setParsedData(prev => prev.filter(row => row.id !== id));
  };

  const addEmptyRow = () => {
    const newRow: MetaAdRow = {
      id: `manual-ad-${Date.now()}`,
      campaignName: 'Manual Campaign',
      adName: `New Ad Post ${parsedData.length + 1}`,
      resultType: 'Engagement',
      results: 100,
      reach: 1000,
      impressions: 1200,
      cpr: 0.5,
      frequency: 1.1,
      objective: 'Engagement',
      linkClicks: 50,
      messages: 0,
      costPerMessage: 0,
      newMessages: 0,
      costPerNewMessage: 0,
      views: 0
    };
    setParsedData(prev => [...prev, newRow]);
  };

  // Helper formatting function for clipboard exports
  const formatCurr = (val: number) => val > 0 ? `$${val.toFixed(2)}` : "—";
  const formatNum = (val: number) => val > 0 ? val.toLocaleString() : "—";

  // Helper to obtain computed metrics dynamically on the fly
  const getComputedMetrics = (ad: MetaAdRow) => {
    // 1. Messaging costs with robust parsed fallbacks to cpr
    const cpMsg = ad.costPerMessage || (ad.objective === 'Message' ? ad.cpr : 0);
    const cpNewMsg = ad.costPerNewMessage || cpMsg;

    // 2. Video plays fallbacks
    const viewsVal = ad.views || (ad.objective === 'Thruplay' ? ad.results : 0);
    const resToViewsRatio = viewsVal > 0 ? (ad.results / viewsVal) * 100 : 0;

    return {
      cpMsg,
      cpNewMsg,
      viewsVal,
      resToViewsRatio
    };
  };

  // ─── Copy Data Payload for Native PowerPoint Excel Graphs ──────────────────
  const copyDataPayload = useCallback((ad: MetaAdRow) => {
    const computed = getComputedMetrics(ad);

    // 1. Prepare raw rows and formats for the slide deck table
    const headers = ["Metric", "Value"];
    const rows = [
      [reachLabel, formatNum(ad.reach)],
      [impressionsLabel, formatNum(ad.impressions)],
      ["Frequency", ad.frequency > 0 ? ad.frequency.toFixed(2) : "—"],
    ];

    // Deduplicated Result and Cost Rows based on objective
    if (ad.objective === 'Awareness') {
      rows.push(
        ["Cost Per Result (CPR)", formatCurr(ad.cpr)],
        ["Link Clicks", formatNum(ad.linkClicks)]
      );
    } else if (ad.objective === 'Message') {
      rows.push(
        ["Link Clicks", formatNum(ad.linkClicks)],
        ["Message Conversations Started", formatNum(ad.messages || ad.results)],
        ["Cost per Messaging Conversation", formatCurr(computed.cpMsg)],
        ["New Message Contacts", formatNum(ad.newMessages || ad.messages || ad.results)],
        ["Cost per New Messaging Connection", formatCurr(computed.cpNewMsg)]
      );
    } else if (ad.objective === 'Thruplay') {
      rows.push(
        ["Cost Per Result (CPR)", formatCurr(ad.cpr)],
        ["Link Clicks", formatNum(ad.linkClicks)],
        ["Views / Video Plays", formatNum(computed.viewsVal)],
        ["Result / Views Ratio", computed.resToViewsRatio > 0 ? `${computed.resToViewsRatio.toFixed(2)}%` : "—"]
      );
    } else {
      // Default: Engagement, Page Follower, etc.
      rows.push(
        [ad.resultType || 'Results', formatNum(ad.results)],
        ["Cost Per Result (CPR)", formatCurr(ad.cpr)],
        ["Link Clicks", formatNum(ad.linkClicks)]
      );
    }

    // Format plain text TSV for Excel/Google Sheets
    const tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');

    // Format high-fidelity HTML table for PowerPoint/Google Slides
    const cssPx = exportFontSize * (4 / 3);
    const htmlTable = `
      <table style="border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; width: 360px; border: 1px solid #e2e8f0; font-size: ${cssPx}px;">
        <thead>
          <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
            <th style="border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; font-weight: 700; color: #475569;">Metric</th>
            <th style="border: 1px solid #e2e8f0; padding: 6px 10px; text-align: right; font-weight: 700; color: #475569;">Value</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="border: 1px solid #e2e8f0; padding: 6px 10px; color: #64748b; font-weight: 500;">${r[0]}</td>
              <td style="border: 1px solid #e2e8f0; padding: 6px 10px; text-align: right; font-weight: 600; color: #1e293b;">${r[1]}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // 2. Write both formats to clipboard!
    try {
      if (typeof window !== 'undefined' && window.ClipboardItem) {
        const clipboardData = [
          new ClipboardItem({
            "text/plain": new Blob([tsv], { type: "text/plain" }),
            "text/html": new Blob([htmlTable], { type: "text/html" })
          })
        ];
        navigator.clipboard.write(clipboardData).catch(() => {
          navigator.clipboard.writeText(tsv);
        });
      } else {
        navigator.clipboard.writeText(tsv);
      }
    } catch {
      navigator.clipboard.writeText(tsv);
    }

    // Provide dynamic feedback on card/table buttons
    const cardBtn = document.getElementById(`copy-data-card-btn-${ad.id}`);
    const tableBtn = document.getElementById(`copy-data-table-btn-${ad.id}`);
    if (cardBtn) {
      const origText = cardBtn.innerHTML;
      cardBtn.innerHTML = '✓ Copied All Metrics!';
      cardBtn.style.color = '#16a34a';
      cardBtn.style.background = '#dcfce7';
      cardBtn.style.borderColor = '#bbf7d0';
      setTimeout(() => {
        cardBtn.innerHTML = origText;
        cardBtn.style.color = '#0284c7';
        cardBtn.style.background = '#f0f9ff';
        cardBtn.style.borderColor = '#bae6fd';
      }, 1500);
    }
    if (tableBtn) {
      const origText = tableBtn.textContent;
      tableBtn.textContent = '✓';
      tableBtn.style.color = '#16a34a';
      tableBtn.style.background = '#dcfce7';
      tableBtn.style.borderColor = '#bbf7d0';
      setTimeout(() => {
        tableBtn.textContent = origText;
        tableBtn.style.color = '#0284c7';
        tableBtn.style.background = '#f0f9ff';
        tableBtn.style.borderColor = '#bae6fd';
      }, 1500);
    }
  }, [exportFontSize, reachLabel, impressionsLabel]);

  // ─── Chart Card Max Visual Limits Calculation ─────────────────────────────
  const maxValues = useMemo(() => {
    return {
      reach: Math.max(...parsedData.map(ad => ad.reach), 1),
      impressions: Math.max(...parsedData.map(ad => ad.impressions), 1),
      results: Math.max(...parsedData.map(ad => ad.results), 1),
      cpr: Math.max(...parsedData.map(ad => ad.cpr), 1),
      frequency: Math.max(...parsedData.map(ad => ad.frequency), 1),
    };
  }, [parsedData]);

  return (
    <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '2.5rem 2rem 4rem' }}>

      {/* ── Page Title / Header ── */}
      <header className="header">
        <span className="tool-logo" aria-hidden="true"><ToolIcon id="meta-report" size={40} /></span>
        <h1>Meta Ads Report Automator</h1>
        <p>
          Ingest messy Meta Ads spreadsheets, automatically detect standard and advanced performance metrics, review custom dashboards, and copy rich formats.
        </p>
      </header>

      {error && (
        <div style={{
          marginBottom: '2rem',
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

      {/* ─── PHASE 1: FILE UPLOADER ─────────────────────────────────────────── */}
      {phase === 'upload' && (
        <div
          className="glass-panel"
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            border: dragging ? '2px dashed #2563eb' : '2px dashed rgba(226,232,240,0.8)',
            background: dragging ? 'rgba(37,99,235,0.05)' : undefined,
            transition: 'all 0.25s ease',
            padding: '4rem 2rem',
            textAlign: 'center'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '4.5rem' }}>📊</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e293b' }}>
              Drag and drop your Meta Ads report here
            </h2>
            <p style={{ color: '#64748b', maxWidth: '440px', fontSize: '0.95rem' }}>
              Supports <strong>CSV</strong> and <strong>Excel</strong> exports (.csv, .xlsx, .xls). We'll automatically skip totals, strip currencies, and recognise campaign metrics.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              {['.csv', '.xlsx', '.xls'].map(ext => (
                <span key={ext} style={{
                  padding: '0.2rem 0.65rem',
                  background: 'rgba(37,99,235,0.08)',
                  border: '1px solid rgba(37,99,235,0.25)',
                  borderRadius: '999px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#2563eb',
                  letterSpacing: '0.04em'
                }}>{ext}</span>
              ))}
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <label htmlFor="meta-csv-input" className="btn-primary" style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)', padding: '0.75rem 2rem' }}>
                Browse Files
              </label>
              <input
                id="meta-csv-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── PHASE 1.5: COLUMN MANUAL ALIGNMENT MAPPER ─────────────────────── */}
      {phase === 'mapping' && (
        <div className="glass-panel" style={{ animation: 'fadeInDown 0.5s ease-out' }}>
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e293b' }}>
              ⚙️ Align CSV Columns
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '0.2rem' }}>
              We attempted to map your Meta CSV headers. Verify the matches or align them manually to ensure exact extraction.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            {Object.keys(mapping).map((field) => {
              const fieldKey = field as keyof ColumnMapping;
              const fieldLabels: Record<keyof ColumnMapping, string> = {
                campaignNameIdx: "Campaign Name",
                adNameIdx: "Ad Name / Post ID",
                resultTypeIdx: "Result Type Label",
                resultsIdx: "Results (Count)",
                reachIdx: "Reach",
                impressionsIdx: "Impressions",
                cprIdx: "Cost Per Result (CPR)",
                frequencyIdx: "Frequency",
                linkClicksIdx: "Link Clicks",
                messagesIdx: "Messaging Conversations",
                costPerMessageIdx: "Cost Per Messaging Conversation",
                newMessagesIdx: "New Message Contacts",
                costPerNewMessageIdx: "Cost Per New Messaging Connection",
                viewsIdx: "Video Plays / Views"
              };

              return (
                <div key={fieldKey} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                    {fieldLabels[fieldKey]}
                  </label>
                  <select
                    value={mapping[fieldKey]}
                    onChange={e => handleMapChange(fieldKey, e.target.value)}
                    style={{
                      padding: '0.6rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.5rem',
                      fontSize: '0.88rem',
                      background: '#ffffff',
                      color: '#1e293b'
                    }}
                  >
                    <option value="-1">-- Unmapped / Skipped --</option>
                    {detectedHeaders.map((header, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {header}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              className="btn-primary"
              style={{ background: '#64748b' }}
              onClick={() => setPhase('upload')}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
              onClick={confirmMappingAndAnalyze}
            >
              Confirm Columns & Analyze
            </button>
          </div>
        </div>
      )}

      {/* ─── PHASE 2 & 3: REVIEW SPREADSHEET & PREVIEW CHARTS ───────────────── */}
      {phase === 'edit' && (
        <div style={{ animation: 'fadeInDown 0.5s ease-out' }}>
          
          {/* Top Panel Actions */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            marginBottom: '1.5rem',
            padding: '1rem 1.5rem',
            background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(79,70,229,0.08))',
            borderRadius: '1rem',
            border: '1px solid rgba(37,99,235,0.15)',
          }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Source File</span>
              <p style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem', marginTop: '0.2rem' }}>{fileName || 'Manually Ingested'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Active Ads List</span>
              <p style={{ fontWeight: 700, color: '#1e293b' }}>{parsedData.length} records</p>
            </div>

            <div>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Google Sheets Font Size</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                <input
                  type="range"
                  min="7.5"
                  max="24"
                  step="0.5"
                  value={exportFontSize}
                  onChange={e => setExportFontSize(parseFloat(e.target.value))}
                  style={{ width: '100px', cursor: 'pointer', accentColor: '#2563eb' }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb' }}>{exportFontSize}</span>
              </div>
            </div>
            
            <div>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Audience Metric Labels</span>
              <button
                onClick={() => setUseViewsLabel(prev => !prev)}
                title="Toggle how Reach/Impressions are labelled across the table, cards, and copied slides"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '0.3rem',
                  padding: '0.4rem 0.65rem',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#1e293b',
                }}
              >
                <span style={{
                  position: 'relative',
                  width: '34px',
                  height: '18px',
                  borderRadius: '999px',
                  background: useViewsLabel ? '#2563eb' : '#cbd5e1',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                }}>
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    left: useViewsLabel ? '18px' : '2px',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  }} />
                </span>
                <span>{reachLabel} / {impressionsLabel}</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                className="btn-primary"
                onClick={addEmptyRow}
                style={{ background: '#475569' }}
              >
                ➕ Add Row
              </button>
            </div>
          </div>

          {/* Inline Review Spreadsheet Grid */}
          <div className="glass-panel" style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>
                  ✏️ Verify and Edit Mapped Data Grid
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Horizontal scrolling available. Click any value to tweak.
                </p>
              </div>
            </div>
            
            <div className="table-wrapper" style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '0.75rem' }}>
              <table style={{ minWidth: '1350px', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ width: '180px', padding: '0.75rem 0.5rem' }}>Campaign Name</th>
                    <th style={{ width: '180px', padding: '0.75rem 0.5rem' }}>Ad Name / Post ID</th>
                    <th style={{ width: '130px', padding: '0.75rem 0.5rem' }}>Objective</th>
                    <th style={{ width: '90px', padding: '0.75rem 0.5rem', textAlign: 'right' }}>{reachLabel}</th>
                    <th style={{ width: '90px', padding: '0.75rem 0.5rem', textAlign: 'right' }}>{impressionsLabel}</th>
                    <th style={{ width: '70px', padding: '0.75rem 0.5rem', textAlign: 'right' }}>Freq</th>
                    <th style={{ width: '100px', padding: '0.75rem 0.5rem', textAlign: 'right' }}>Results</th>
                    <th style={{ width: '90px', padding: '0.75rem 0.5rem', textAlign: 'right' }}>CPR ($)</th>
                    <th style={{ width: '90px', padding: '0.75rem 0.5rem', textAlign: 'right' }}>Link Clicks</th>
                    <th style={{ width: '95px', padding: '0.75rem 0.5rem', textAlign: 'right' }}>Msg Conv</th>
                    <th style={{ width: '95px', padding: '0.75rem 0.5rem', textAlign: 'right' }}>Cost/Msg ($)</th>
                    <th style={{ width: '90px', padding: '0.75rem 0.5rem', textAlign: 'right' }}>New Message</th>
                    <th style={{ width: '110px', padding: '0.75rem 0.5rem', textAlign: 'right' }}>Cost/New Msg ($)</th>
                    <th style={{ width: '90px', padding: '0.75rem 0.5rem', textAlign: 'right' }}>Video Views</th>
                    <th style={{ width: '90px', padding: '0.75rem 0.5rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.map((ad) => (
                    <tr key={ad.id}>
                      {/* Campaign Name */}
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        <input
                          type="text"
                          value={ad.campaignName}
                          onChange={e => updateRowField(ad.id, 'campaignName', e.target.value)}
                          className="editable-input"
                          style={{ fontSize: '0.8rem' }}
                        />
                      </td>
                      
                      {/* Ad Name */}
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <input
                            type="text"
                            value={ad.adName}
                            onChange={e => updateRowField(ad.id, 'adName', e.target.value)}
                            className="editable-input"
                            style={{ fontSize: '0.8rem', fontWeight: 600, flex: 1, minWidth: 0 }}
                          />
                          <button
                            title="Copy Post ID"
                            onClick={() => {
                              const match = ad.adName.match(/\d{10,}/);
                              const targetText = match ? match[0] : ad.adName;
                              navigator.clipboard.writeText(targetText);
                              const btn = document.getElementById(`copy-btn-${ad.id}`);
                              if (btn) { btn.textContent = '✓'; setTimeout(() => { btn.textContent = '⎘'; }, 1500); }
                            }}
                            id={`copy-btn-${ad.id}`}
                            style={{
                              flexShrink: 0,
                              background: 'transparent',
                              border: '1px solid #cbd5e1',
                              borderRadius: '0.3rem',
                              padding: '0.1rem 0.25rem',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              color: '#64748b',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#2563eb'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
                          >⎘</button>
                        </div>
                      </td>

                      {/* Objective */}
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        <select
                          value={ad.objective}
                          onChange={e => updateRowField(ad.id, 'objective', e.target.value)}
                          className="editable-input"
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#4f46e5',
                            padding: '0.2rem',
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc'
                          }}
                        >
                          <option value="Awareness">Awareness (Reach Only)</option>
                          <option value="Engagement">Engagement (Interactions)</option>
                          <option value="Page Follower">Page Follower (Likes)</option>
                          <option value="Thruplay">Thruplay (Video Views)</option>
                          <option value="Message">Message (Conversations)</option>
                        </select>
                      </td>

                      {/* Reach */}
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        <input
                          type="text"
                          value={ad.reach}
                          onChange={e => updateRowField(ad.id, 'reach', cleanNumeric(e.target.value))}
                          className="editable-input"
                          style={{ fontSize: '0.8rem', textAlign: 'right' }}
                        />
                      </td>

                      {/* Impressions */}
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        <input
                          type="text"
                          value={ad.impressions}
                          onChange={e => updateRowField(ad.id, 'impressions', cleanNumeric(e.target.value))}
                          className="editable-input"
                          style={{ fontSize: '0.8rem', textAlign: 'right' }}
                        />
                      </td>

                      {/* Frequency */}
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        <input
                          type="text"
                          value={ad.frequency}
                          onChange={e => updateRowField(ad.id, 'frequency', cleanNumeric(e.target.value))}
                          className="editable-input"
                          style={{ fontSize: '0.8rem', textAlign: 'right' }}
                        />
                      </td>

                      {/* Results */}
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        {ad.objective === 'Awareness' ? (
                          <span style={{ color: '#94a3b8', fontSize: '0.78rem', paddingLeft: '0.4rem' }}>— (Reach)</span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
                            <input
                              type="text"
                              value={ad.results}
                              onChange={e => updateRowField(ad.id, 'results', cleanNumeric(e.target.value))}
                              className="editable-input"
                              style={{ fontSize: '0.8rem', textAlign: 'right', flex: 1, minWidth: 0 }}
                            />
                            <span style={{ fontSize: '0.65rem', color: '#64748b', whiteSpace: 'nowrap' }}>{ad.resultType}</span>
                          </div>
                        )}
                      </td>

                      {/* CPR */}
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        <input
                          type="text"
                          value={ad.cpr}
                          onChange={e => updateRowField(ad.id, 'cpr', cleanNumeric(e.target.value))}
                          className="editable-input"
                          style={{ fontSize: '0.8rem', textAlign: 'right' }}
                        />
                      </td>

                      {/* Link Clicks */}
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        <input
                          type="text"
                          value={ad.linkClicks}
                          onChange={e => updateRowField(ad.id, 'linkClicks', cleanNumeric(e.target.value))}
                          className="editable-input"
                          style={{ fontSize: '0.8rem', textAlign: 'right' }}
                        />
                      </td>

                      {/* Messaging Conversations */}
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        <input
                          type="text"
                          value={ad.messages}
                          onChange={e => updateRowField(ad.id, 'messages', cleanNumeric(e.target.value))}
                          className="editable-input"
                          style={{ fontSize: '0.8rem', textAlign: 'right' }}
                        />
                      </td>

                      {/* Cost Per Message */}
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        <input
                          type="text"
                          value={ad.costPerMessage}
                          onChange={e => updateRowField(ad.id, 'costPerMessage', cleanNumeric(e.target.value))}
                          className="editable-input"
                          style={{ fontSize: '0.8rem', textAlign: 'right' }}
                        />
                      </td>

                      {/* New Messaging Contacts */}
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        <input
                          type="text"
                          value={ad.newMessages}
                          onChange={e => updateRowField(ad.id, 'newMessages', cleanNumeric(e.target.value))}
                          className="editable-input"
                          style={{ fontSize: '0.8rem', textAlign: 'right' }}
                        />
                      </td>

                      {/* Cost Per New Messaging Connection */}
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        <input
                          type="text"
                          value={ad.costPerNewMessage}
                          onChange={e => updateRowField(ad.id, 'costPerNewMessage', cleanNumeric(e.target.value))}
                          className="editable-input"
                          style={{ fontSize: '0.8rem', textAlign: 'right' }}
                        />
                      </td>

                      {/* Views / Video Plays */}
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        <input
                          type="text"
                          value={ad.views}
                          onChange={e => updateRowField(ad.id, 'views', cleanNumeric(e.target.value))}
                          className="editable-input"
                          style={{ fontSize: '0.8rem', textAlign: 'right' }}
                        />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.3rem 0.4rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                          <button
                            onClick={() => copyDataPayload(ad)}
                            id={`copy-data-table-btn-${ad.id}`}
                            style={{
                              background: '#f0f9ff',
                              border: '1px solid #bae6fd',
                              color: '#0284c7',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              padding: '0.2rem 0.35rem',
                              borderRadius: '0.25rem',
                              transition: 'all 0.2s',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              lineHeight: 1
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#e0f2fe'}
                            onMouseLeave={e => e.currentTarget.style.background = '#f0f9ff'}
                            title="Copy all metrics for slides"
                          >
                            📋
                          </button>
                          <button
                            onClick={() => deleteRow(ad.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontSize: '1rem',
                              padding: '0.2rem 0.35rem',
                              borderRadius: '0.25rem',
                              transition: 'all 0.2s',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              lineHeight: 1
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            title="Delete row"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Visual Interactive Previews (SVG Progress Chart List) */}
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '1.25rem' }}>
              📊 Interactive Performance Visualizations
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.5rem' }}>
              {parsedData.map((ad, idx) => {
                const reachPct = (ad.reach / maxValues.reach) * 100;
                const impPct = (ad.impressions / maxValues.impressions) * 100;
                const resPct = (ad.results / maxValues.results) * 100;
                const cprPct = (ad.cpr / maxValues.cpr) * 100;
                const freqPct = (ad.frequency / maxValues.frequency) * 100;

                const badgeColors: Record<MetaAdRow['objective'], { bg: string, text: string }> = {
                  Awareness: { bg: 'rgba(37,99,235,0.1)', text: '#2563eb' },
                  Engagement: { bg: 'rgba(79,70,229,0.1)', text: '#4f46e5' },
                  'Page Follower': { bg: 'rgba(16,185,129,0.1)', text: '#10b981' },
                  Thruplay: { bg: 'rgba(236,72,153,0.1)', text: '#ec4899' },
                  Message: { bg: 'rgba(14,165,233,0.1)', text: '#0ea5e9' }
                };

                const badge = badgeColors[ad.objective];
                const computed = getComputedMetrics(ad);

                return (
                  <div
                    key={ad.id}
                    className="glass-panel"
                    style={{
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'var(--shadow)';
                    }}
                  >
                    {/* Header info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {ad.campaignName}
                        </span>
                        <h3 style={{
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          color: '#1e293b',
                          marginTop: '0.1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}>
                          <span style={{ wordBreak: 'break-all' }}>{ad.adName}</span>
                          <button
                            title="Copy Post ID"
                            onClick={() => {
                              const match = ad.adName.match(/\d{10,}/);
                              const targetText = match ? match[0] : ad.adName;
                              navigator.clipboard.writeText(targetText);
                              const btn = document.getElementById(`copy-card-btn-${ad.id}`);
                              if (btn) {
                                btn.textContent = '✓';
                                btn.style.color = '#10b981';
                                setTimeout(() => {
                                  btn.textContent = '⎘';
                                  btn.style.color = '#64748b';
                                }, 1500);
                              }
                            }}
                            id={`copy-card-btn-${ad.id}`}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              color: '#64748b',
                              padding: '0.1rem 0.2/rem',
                              lineHeight: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s',
                              borderRadius: '4px',
                              flexShrink: 0
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                              e.currentTarget.style.color = '#2563eb';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = '#64748b';
                            }}
                          >
                            ⎘
                          </button>
                        </h3>
                      </div>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: badge.bg,
                        color: badge.text,
                        whiteSpace: 'nowrap'
                      }}>
                        {ad.objective}
                      </span>
                    </div>

                    {/* Progress Bar Visualizer for Reach, Impressions, Results */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
                      
                      {/* Reach */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569', marginBottom: '0.25rem' }}>
                          <span>{reachLabel}</span>
                          <strong>{ad.reach.toLocaleString()}</strong>
                        </div>
                        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${reachPct}%`, height: '100%', background: '#2563eb', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                        </div>
                      </div>

                      {/* Impressions */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569', marginBottom: '0.25rem' }}>
                          <span>{impressionsLabel}</span>
                          <strong>{ad.impressions.toLocaleString()}</strong>
                        </div>
                        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${impPct}%`, height: '100%', background: '#4f46e5', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                        </div>
                      </div>

                      {/* Results */}
                      {ad.objective !== 'Awareness' && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569', marginBottom: '0.25rem' }}>
                            <span>{ad.resultType || 'Results'}</span>
                            <strong>{ad.results.toLocaleString()}</strong>
                          </div>
                          <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${resPct}%`, height: '100%', background: '#10b981', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Premium Grid inside single post card */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '0.65rem',
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      background: '#f8fafc',
                      borderRadius: '0.75rem',
                      border: '1px solid #f1f5f9'
                    }}>
                      {/* Metric 1: Frequency */}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Frequency</span>
                        <strong style={{ fontSize: '0.88rem', color: '#1e293b', marginTop: '0.1rem' }}>
                          {ad.frequency > 0 ? ad.frequency.toFixed(2) : "—"}
                        </strong>
                      </div>

                      {/* Metric 2: Cost Per Result (CPR) - ALWAYS VISIBLE */}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Cost per Result (CPR)</span>
                        <strong style={{ fontSize: '0.88rem', color: '#4f46e5', marginTop: '0.1rem' }}>
                          {ad.cpr > 0 ? `$${ad.cpr.toFixed(2)}` : "—"}
                        </strong>
                      </div>

                      {/* Metric 3: Link Clicks */}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Link Clicks</span>
                        <strong style={{ fontSize: '0.88rem', color: '#1e293b', marginTop: '0.1rem' }}>
                          {formatNum(ad.linkClicks)}
                        </strong>
                      </div>

                      <div style={{ display: 'none' }}></div>

                      {/* Messaging-specific Metrics */}
                      {ad.objective === 'Message' && (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Messaging Conv</span>
                            <strong style={{ fontSize: '0.88rem', color: '#1e293b', marginTop: '0.1rem' }}>
                              {formatNum(ad.messages || ad.results)}
                            </strong>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>New Msg Contacts</span>
                            <strong style={{ fontSize: '0.88rem', color: '#1e293b', marginTop: '0.1rem' }}>
                              {formatNum(ad.newMessages || ad.messages || ad.results)}
                            </strong>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Cost per Msg Conv</span>
                            <strong style={{ fontSize: '0.88rem', color: '#1e293b', marginTop: '0.1rem' }}>
                              {formatCurr(computed.cpMsg)}
                            </strong>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Cost per New Msg Connection</span>
                            <strong style={{ fontSize: '0.88rem', color: '#1e293b', marginTop: '0.1rem' }}>
                              {formatCurr(computed.cpNewMsg)}
                            </strong>
                          </div>
                        </>
                      )}

                      {/* Thruplay-specific Metrics */}
                      {ad.objective === 'Thruplay' && (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Views / Video Plays</span>
                            <strong style={{ fontSize: '0.88rem', color: '#1e293b', marginTop: '0.1rem' }}>
                              {formatNum(computed.viewsVal)}
                            </strong>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Result / Views Ratio</span>
                            <strong style={{ fontSize: '0.88rem', color: '#1e293b', marginTop: '0.1rem' }}>
                              {computed.resToViewsRatio > 0 ? `${computed.resToViewsRatio.toFixed(2)}%` : "—"}
                            </strong>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Premium Action Toolbar inside Card */}
                    <div style={{
                      display: 'flex',
                      marginTop: '0.5rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid #f1f5f9'
                    }}>
                      <button
                        onClick={() => copyDataPayload(ad)}
                        id={`copy-data-card-btn-${ad.id}`}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.3rem',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: '#0284c7',
                          background: '#f0f9ff',
                          border: '1px solid #bae6fd',
                          borderRadius: '0.375rem',
                          padding: '0.45rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          lineHeight: 1
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#e0f2fe'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f0f9ff'; }}
                        title="Copy all metrics to slide clipboard"
                      >
                        📊 Copy All Metrics
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Global CSS animations injected inline */}
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <SiteFooter />
    </main>
  );
}
