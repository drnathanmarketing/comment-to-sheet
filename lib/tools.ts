// Single source of truth for the Dr Nathan Tools suite.
// Consumed by the Navbar and the landing hub so labels, routes and colors
// never drift apart again.

export interface Tool {
  /** Stable id — also the key used to look up the tool's logo in ToolIcon. */
  id: string;
  /** Route the tool lives at. */
  href: string;
  /** Full name shown on the hub card and page heading. */
  label: string;
  /** Short label used in the top navigation. */
  short: string;
  /** One-line description for the hub card. */
  description: string;
  /** Accent color for the tool's card + active nav state (matches its logo). */
  accent: string;
}

export const tools: Tool[] = [
  {
    id: 'facebook',
    href: '/facebook',
    label: 'Facebook to Sheet',
    short: 'Facebook',
    description:
      'Paste copied Facebook comments and extract names, comments and timestamps into a clean Excel sheet.',
    accent: '#1877F2',
  },
  {
    id: 'tiktok',
    href: '/tiktok',
    label: 'TikTok to Sheet',
    short: 'TikTok',
    description:
      'Turn copied TikTok comments into structured, exportable rows in seconds.',
    accent: '#010101',
  },
  {
    id: 'viber',
    href: '/viber',
    label: 'Viber Insights',
    short: 'Viber',
    description:
      'Convert a Viber community JSON export into a polished analytics report.',
    accent: '#7360F2',
  },
  {
    id: 'bold-text-maker',
    href: '/bold-text-maker',
    label: 'Bold Text Maker',
    short: 'Bold Text',
    description:
      'Convert text to Unicode bold for Facebook posts, with smart English–Burmese spacing.',
    accent: '#0891b2',
  },
  {
    id: 'emojilizer',
    href: '/emojilizer',
    label: 'Emojilizer',
    short: 'Emojilizer',
    description:
      'Let AI sprinkle the perfect emojis into your posts, tuned for health content.',
    accent: '#d97706',
  },
  {
    id: 'meta-report',
    href: '/meta-report',
    label: 'Meta Ads Report',
    short: 'Meta Ads',
    description:
      'Drop in a messy Meta Ads export and get an auto-mapped performance dashboard.',
    accent: '#0081FB',
  },
];
