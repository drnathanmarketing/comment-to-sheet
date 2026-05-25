/**
 * Utility for parsing and cleaning Meta Ads Manager CSV / Excel reports.
 *
 * Meta Ads Manager exports come in two main formats:
 *   - "Export as CSV"       (UTF-8, sometimes with BOM)
 *   - "Export for Excel"    (xlsx binary)
 *
 * Both share the same column names; this parser handles them uniformly.
 */

export interface MetaAdRow {
  id: string;
  campaignName: string;
  adName: string;
  resultType: string;
  results: number;
  reach: number;
  impressions: number;
  cpr: number;
  frequency: number;
  objective: 'Awareness' | 'Engagement' | 'Page Follower' | 'Thruplay' | 'Message';
  linkClicks: number;
  messages: number;
  costPerMessage: number;
  newMessages: number;
  costPerNewMessage: number; // Added Cost per New Messaging Connection
  views: number;
}

export interface ColumnMapping {
  campaignNameIdx: number;
  adNameIdx: number;
  resultTypeIdx: number;
  resultsIdx: number;
  reachIdx: number;
  impressionsIdx: number;
  cprIdx: number;
  frequencyIdx: number;
  linkClicksIdx: number;
  messagesIdx: number;
  costPerMessageIdx: number;
  newMessagesIdx: number;
  costPerNewMessageIdx: number; // Added Cost per New Messaging Connection Index
  viewsIdx: number;
}

// ─── String / Numeric cleaners ────────────────────────────────────────────────

export function cleanString(str: string | number | null | undefined): string {
  if (str == null) return '';
  return String(str).replace(/^\uFEFF/, '').replace(/\r/g, '').trim();
}

/**
 * Strip every non-numeric character Meta might include in a number cell:
 *   - Currency prefixes/suffixes: $  £  €  ₨  ฿  MMK
 *   - Thousands separators: commas
 *   - Percent signs, spaces
 */
export function cleanNumeric(str: string | number | null | undefined): number {
  if (str == null || str === '') return 0;
  if (typeof str === 'number') return isNaN(str) ? 0 : str;
  const cleaned = cleanString(str)
    .replace(/MMK/gi, '')
    .replace(/[$£€₨฿]/g, '')
    .replace(/\s+/g, '')
    .replace(/%/g, '')
    .replace(/,/g, ''); // remove thousands commas before parseFloat
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// ─── Header row finder ────────────────────────────────────────────────────────

/**
 * Exact column headers that Meta Ads Manager uses (lowercased for comparison).
 * We search the first 20 rows for a row where ≥3 of these appear.
 */
const META_HEADER_KEYWORDS = [
  // Identity
  'campaign name',
  'ad set name',
  'ad name',
  // Metrics
  'impressions',
  'reach',
  'frequency',
  // Result columns — Meta's exact strings
  'results',
  'result indicator',
  'result type',
  // Cost
  'cost per result',
  // Delivery
  'delivery',
  // Date range columns
  'reporting starts',
  'reporting ends',
  // Other common columns
  'clicks (all)',
  'unique clicks (all)',
  'page likes',
  'messaging conversations started',
  'cost per messaging conversation started',
  'new messaging connections',
  'cost per new messaging connection',
  'thruplay',
  'video plays',
  'link clicks',
];

export function findHeaderRow(rows: string[][]): { index: number; headers: string[] } {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i].map(c => cleanString(c).toLowerCase());
    // IMPORTANT: only test cells with actual content (length > 2).
    // `kw.includes("")` is always true so empty cells must be excluded
    // to prevent metadata title rows from being falsely detected as headers.
    const matchCount = row.filter(cell =>
      cell.length > 2 &&
      META_HEADER_KEYWORDS.some(kw => cell === kw || cell.includes(kw))
    ).length;
    if (matchCount >= 3) {
      return { index: i, headers: rows[i].map(c => cleanString(c)) };
    }
  }
  // Fallback – use first non-empty row
  const firstNonEmpty = rows.findIndex(r => r.some(c => cleanString(c).length > 0));
  const idx = firstNonEmpty >= 0 ? firstNonEmpty : 0;
  return { index: idx, headers: rows[idx]?.map(c => cleanString(c)) ?? [] };
}

// ─── Column auto-mapper ───────────────────────────────────────────────────────

/**
 * Maps header strings to column indices using exact-match-first, then partial.
 */
export function autoMapColumns(headers: string[]): ColumnMapping {
  const lower = headers.map(h => cleanString(h).toLowerCase());

  const best = (candidates: string[]): number => {
    // Exact match first
    for (const kw of candidates) {
      const idx = lower.findIndex(h => h === kw);
      if (idx !== -1) return idx;
    }
    // Partial: header contains keyword
    for (const kw of candidates) {
      const idx = lower.findIndex(h => h.includes(kw));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  // "Results" must be an exact match to avoid grabbing "Cost per result"
  const resultsIdx = (() => {
    const exact = lower.findIndex(h => h === 'results');
    if (exact !== -1) return exact;
    // Fallback: first col that contains "results" but not "cost"
    return lower.findIndex(h => h.includes('results') && !h.includes('cost'));
  })();

  return {
    campaignNameIdx:  best(['campaign name', 'campaign']),
    // Prefer granular "Ad name" over "Ad set name"
    adNameIdx:        best(['ad name', 'ad set name', 'ad set', 'adset']),
    // Meta uses "Result indicator" for the type label
    resultTypeIdx:    best(['result indicator', 'result type', 'results type', 'objective']),
    resultsIdx,
    reachIdx:         best(['reach']),
    impressionsIdx:   best(['impressions']),
    // "Cost per result" is the exact Meta column name
    cprIdx:           best(['cost per result', 'cost/result', 'cpr']),
    frequencyIdx:     best(['frequency']),
    // Auto-detection
    linkClicksIdx:    best(['link clicks', 'link click', 'clicks (all)', 'clicks']),
    messagesIdx:      best(['messaging conversations started', 'messaging conversations', 'messages', 'conversations started', 'conversations']),
    costPerMessageIdx: best([
      'cost per messaging conversation started',
      'cost per messaging conversation',
      'cost per messaging',
      'cost per message',
      'cost per conversation',
      'cost/messaging',
      'cost/message',
      'cost/conv'
    ]),
    newMessagesIdx:   best(['new messaging connections', 'new messaging contacts', 'new messaging', 'new message', 'new contacts']),
    costPerNewMessageIdx: best([
      'cost per new messaging connection',
      'cost per new messaging contact',
      'cost per new messaging',
      'cost per new message',
      'cost/new messaging',
      'cost/new message'
    ]),
    viewsIdx:         best(['video plays', 'views', 'thruplays', 'video views', '3-second video plays', '2-second video plays']),
  };
}

// ─── Objective classifier ─────────────────────────────────────────────────────

/**
 * Maps Meta's "Result indicator" values (and campaign name hints) to our
 * five internal objective types.
 */
export function detectObjective(
  resultType: string,
  campaignName: string,
  adName: string
): 'Awareness' | 'Engagement' | 'Page Follower' | 'Thruplay' | 'Message' {
  const rt   = resultType.toLowerCase();
  const camp = campaignName.toLowerCase();
  const ad   = adName.toLowerCase();

  // 1. Result indicator — most reliable signal
  if (rt.includes('thruplay'))                                          return 'Thruplay';
  if (rt.includes('page like') || rt.includes('page follower'))        return 'Page Follower';
  if (rt.includes('messaging') || rt.includes('conversation'))         return 'Message';
  if (rt.includes('message'))                                           return 'Message';
  if (rt === 'reach' || rt.includes('awareness') || rt.includes('impression')) return 'Awareness';
  if (
    rt.includes('engagement') ||
    rt.includes('post engagement') ||
    rt.includes('link click') ||
    rt.includes('video') ||
    rt.includes('interaction')
  )                                                                     return 'Engagement';

  // 2. Campaign / ad name heuristics (fallback)
  if (camp.includes('thruplay') || ad.includes('thruplay'))            return 'Thruplay';
  if (camp.includes('page like') || ad.includes('page like') ||
      camp.includes('follower')  || ad.includes('follower'))           return 'Page Follower';
  if (camp.includes('msg')     || ad.includes('msg') ||
      camp.includes('message') || ad.includes('message') ||
      camp.includes('chat')    || ad.includes('chat') ||
      camp.includes('inbox')   || ad.includes('inbox'))                return 'Message';
  if (camp.includes('reach')   || ad.includes('reach') ||
      camp.includes('awareness') || ad.includes('awareness'))          return 'Awareness';
  if (camp.includes('eng')     || ad.includes('eng') ||
      camp.includes('engagement') || ad.includes('engagement') ||
      camp.includes('boost')   || ad.includes('boost'))                return 'Engagement';

  return 'Engagement'; // safe default
}

// ─── Rows parser ──────────────────────────────────────────────────────────────

/**
 * Row patterns to SKIP (Meta inserts summary / metadata rows).
 */
const SKIP_PATTERNS = [
  /^total$/i,
  /^totals$/i,
  /^grand total/i,
  /^subtotal/i,
  /^reporting/i,
  /^account/i,
  /^campaign total/i,
];

export function parseCleanRows(
  rows: string[][],
  headerIdx: number,
  mapping: ColumnMapping
): MetaAdRow[] {
  const parsedRows: MetaAdRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const rawRow = rows[i];
    if (!rawRow || rawRow.length === 0) continue;

    // Skip almost-empty rows
    const nonBlank = rawRow.filter(c => cleanString(c).length > 0);
    if (nonBlank.length < 2) continue;

    const campaignName = mapping.campaignNameIdx !== -1
      ? cleanString(rawRow[mapping.campaignNameIdx])
      : '';
    const adName = mapping.adNameIdx !== -1
      ? cleanString(rawRow[mapping.adNameIdx])
      : '';

    // Skip rows whose first identifier matches a summary pattern
    const skipKey = campaignName || adName;
    if (!skipKey) continue;
    if (SKIP_PATTERNS.some(re => re.test(skipKey.trim()))) continue;
    if (campaignName.toLowerCase().includes('total')) continue;
    if (adName.toLowerCase().includes('total')) continue;

    const resultType  = mapping.resultTypeIdx  !== -1 ? cleanString(rawRow[mapping.resultTypeIdx])  : '';
    const results     = mapping.resultsIdx     !== -1 ? cleanNumeric(rawRow[mapping.resultsIdx])     : 0;
    const reach       = mapping.reachIdx       !== -1 ? cleanNumeric(rawRow[mapping.reachIdx])       : 0;
    const impressions = mapping.impressionsIdx !== -1 ? cleanNumeric(rawRow[mapping.impressionsIdx]) : 0;
    const cpr         = mapping.cprIdx         !== -1 ? cleanNumeric(rawRow[mapping.cprIdx])         : 0;
    const frequency   = mapping.frequencyIdx   !== -1 ? cleanNumeric(rawRow[mapping.frequencyIdx])   : 0;

    // Parse metrics
    const linkClicks  = mapping.linkClicksIdx  !== -1 ? cleanNumeric(rawRow[mapping.linkClicksIdx])  : 0;
    const messages    = mapping.messagesIdx    !== -1 ? cleanNumeric(rawRow[mapping.messagesIdx])    : 0;
    const costPerMessage = mapping.costPerMessageIdx !== -1 ? cleanNumeric(rawRow[mapping.costPerMessageIdx]) : 0;
    const newMessages = mapping.newMessagesIdx !== -1 ? cleanNumeric(rawRow[mapping.newMessagesIdx]) : 0;
    const costPerNewMessage = mapping.costPerNewMessageIdx !== -1 ? cleanNumeric(rawRow[mapping.costPerNewMessageIdx]) : 0;
    const views       = mapping.viewsIdx       !== -1 ? cleanNumeric(rawRow[mapping.viewsIdx])       : 0;

    const objective = detectObjective(resultType, campaignName, adName);

    parsedRows.push({
      id: `meta-${i}-${Math.random().toString(36).substr(2, 6)}`,
      campaignName,
      adName: adName || `Row ${i}`,
      resultType: resultType || (objective === 'Awareness' ? 'Reach' : 'Results'),
      results,
      reach,
      impressions,
      cpr,
      frequency,
      objective,
      linkClicks,
      messages,
      costPerMessage,
      newMessages,
      costPerNewMessage,
      views,
    });
  }

  return parsedRows;
}
