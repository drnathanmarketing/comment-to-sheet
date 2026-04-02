export interface CommentEntry {
  id: string;
  name: string;
  comment: string;
  time: string;
  originalText: string;
}

export function parseComments(rawText: string): CommentEntry[] {
  const entries: CommentEntry[] = [];
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let currentBlock: string[] = [];
  const blocks: string[][] = [];

  const delimiters = ['Reply', 'Hide', 'See translation', 'Send message', 'Facebook'];

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
      /^Edited$/i,
      /^May be an (image|illustration|doodle) of/i
    ];

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

