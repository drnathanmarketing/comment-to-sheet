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
    const noise = ['Reply', 'Hide', 'See translation', 'Send message', 'Facebook', 'Like', 'Comment', 'Share', 'Top fan', 'Edited'];
    const cleanBlock = block.filter(l => !noise.includes(l));

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

    // SPECIAL: Extract name/time from "May be an illustration/doodle" blocks if it's there
    // These often contain "Name ... Name 2m" at the end of the line
    const doodleLine = cleanBlock.find(l => l.toLowerCase().includes('may be an illustration') || l.toLowerCase().includes('may be a doodle'));
    if (doodleLine) {
       // Look for patterns like "Lin Thandar 2m" or "Kyi Phyu Khaing 4h"
       const buriedTimeMatch = doodleLine.match(/([A-Z][a-z]+ [A-Z][a-z]+) ([0-9]+[wdhm])/);
       if (buriedTimeMatch && buriedTimeMatch[1] && buriedTimeMatch[2]) {
          // If our current name was generic or missing, use this
          if (!name || name === 'Edited' || name.length < 3) {
            name = buriedTimeMatch[1];
          }
          if (time === 'N/A') {
            time = buriedTimeMatch[2];
          }
       }
       // Clean the comment of these doodle descriptions
       comment = comment.split('\n')
         .filter(l => !l.toLowerCase().includes('may be an illustration') && !l.toLowerCase().includes('may be a doodle'))
         .join('\n');
    }

    // Emoji tagging
    const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}]/gu;
    if (emojiRegex.test(comment)) {
      comment = comment.replace(emojiRegex, (match) => `${match} (emoji)`);
    }
    if (emojiRegex.test(name)) {
      name = name.replace(emojiRegex, (match) => `${match} (emoji)`);
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
