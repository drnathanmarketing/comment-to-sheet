export interface CommentEntry {
  id: string;
  name: string;
  comment: string;
  time: string;
  originalText: string;
}

const noisePatterns = [
  /^Reply$/i,
  /^Hide$/i,
  /^See translation$/i,
  /^Send message$/i,
  /^Facebook$/i,
  /^Like$/i,
  /^Comment$/i,
  /^Share$/i,
  /^Top fan$/i,
  /^Top Sticker$/i,
  /^Top contributor$/i,
  /^by author$/i,
  /^Author$/i,
  /^Edited$/i,
  // Alt text: "May be an image of…", "May be a close-up of…", "May be a doodle of…"
  /^May be an? [^.]{0,40}\bof\b/i,
  /^No photo description available\.?$/i
];

const SEPARATORS = ['·', '•'];

// Badges Facebook renders on the same metadata row as the name, so a separator
// following one of these is a badge divider rather than a record boundary.
const badgePattern = /^(Top fan|Top contributor|Top Sticker|by author|Author|Following|Follow|Pinned)$/i;

// Relative stamps as copied: 1d, 2w, 17h, 20m, "Just now", "17 Mar", and the
// Burmese equivalents (ရက် = days, နာရီ = hours, မိနစ် = minutes).
const timePattern = /^(Just now|ယခုပင်|\d+\s*[smhdwy]|\d+\s*(?:စက္ကန့်|မိနစ်|နာရီ|ရက်|ပတ်|လ|နှစ်)|\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?: \d{4})?)$/i;

// Shared-post pastes ("Name / · / Argentina / May be an image of…") carry no
// Reply/Hide markers, so the separator line right under each name is the only
// reliable record boundary.
function parseSharedPosts(lines: string[]): CommentEntry[] {
  const entries: CommentEntry[] = [];
  const isSeparator = (l: string) => SEPARATORS.includes(l);

  // A run of separators means the line above it was a name — unless that line
  // is a badge or a timestamp, in which case the separator is dividing the
  // metadata row of the record we are already inside.
  const records: { nameIndex: number; bodyStart: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!isSeparator(lines[i]) || isSeparator(lines[i - 1])) continue;

    const previous = lines[i - 1];
    if (badgePattern.test(previous) || timePattern.test(previous)) continue;

    let end = i;
    while (end + 1 < lines.length && isSeparator(lines[end + 1])) end++;
    records.push({ nameIndex: i - 1, bodyStart: end + 1 });
  }

  records.forEach((record, index) => {
    const next = records[index + 1];
    const block = lines.slice(record.nameIndex, next ? next.nameIndex : lines.length);

    const name = lines[record.nameIndex];
    if (!name || name.length <= 1) return;

    const body = lines
      .slice(record.bodyStart, next ? next.nameIndex : lines.length)
      .filter(l => !isSeparator(l) && !noisePatterns.some(p => p.test(l)));

    // Lift the stamp out of the body so it lands in its own column.
    const timeIndex = body.findIndex(l => timePattern.test(l));
    const time = timeIndex === -1 ? 'N/A' : body[timeIndex];
    if (timeIndex !== -1) body.splice(timeIndex, 1);

    entries.push({
      id: `entry-${index}-${Date.now()}`,
      name,
      comment: body.join('\n') || '[No text]',
      time,
      originalText: block.join('\n')
    });
  });

  return entries;
}

export function parseComments(rawText: string): CommentEntry[] {
  const entries: CommentEntry[] = [];
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const hasThreadDelimiters = lines.some(l => l === 'Reply' || l === 'Send message' || l === 'Hide');
  const separatorCount = lines.filter(l => SEPARATORS.includes(l)).length;
  if (!hasThreadDelimiters && separatorCount >= 2) {
    return parseSharedPosts(lines);
  }

  let currentBlock: string[] = [];
  const blocks: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    currentBlock.push(line);

    if (line === 'Reply' || line === 'Send message' || line === 'Hide') {
      let lookAhead = i + 1;
      while (lookAhead < lines.length && (lines[lookAhead] === 'See translation' || lines[lookAhead] === 'Hide' || lines[lookAhead] === 'Facebook')) {
        currentBlock.push(lines[lookAhead]);
        lookAhead++;
        i++;
      }
      blocks.push([...currentBlock]);
      currentBlock = [];
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  blocks.forEach((block, index) => {
    const cleanBlock = block.filter(l => !noisePatterns.some(p => p.test(l)));

    if (cleanBlock.length < 1) return;

    // Time regex: handles 2w, 1w, 4h, 9m, Just now, Edited, 1d, 17 Mar, etc.
    const timeRegex = /^(\d+[wdhm]|Just now|Edited|\d+ (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))$/i;
    
    let timeIndex = -1;
    for (let j = cleanBlock.length - 1; j >= 0; j--) {
      if (timeRegex.test(cleanBlock[j])) {
        timeIndex = j;
        break;
      }
    }

    let name = cleanBlock[0];
    let comment = '';
    let time = 'N/A';

    if (timeIndex !== -1) {
      time = cleanBlock[timeIndex];
      const commentLines = cleanBlock.slice(1, timeIndex);
      comment = commentLines.join('\n');
    } else {
      comment = cleanBlock.slice(1).join('\n');
    }

    // Special check: If Name is 'Edited' or metadata, try picking the next line
    if ((name === 'Edited' || name === 'Top fan') && cleanBlock.length > 1) {
      name = cleanBlock[1];
      if (comment.startsWith(name)) {
        comment = comment.replace(name, '').trim();
      }
    }

    if (name && name.length > 1) {
      entries.push({
        id: `entry-${index}-${Date.now()}`,
        name: name,
        comment: comment || '[No text]',
        time: time,
        originalText: block.join('\n')
      });
    }
  });

  return entries;
}

