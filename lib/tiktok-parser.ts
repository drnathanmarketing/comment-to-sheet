import { CommentEntry } from './parser';

export function parseTiktokComments(rawText: string): CommentEntry[] {
  const entries: CommentEntry[] = [];
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const noisePatterns = [
    /^comments\s*\(\d+\)$/i,
    /^\d+\s*comments$/i,
    /^creator\s*videos$/i,
    /^back\s*to\s*top$/i,
    /^add\s*comment\.*$/i,
    /^avatar$/i
  ];

  let currentBlock: string[] = [];
  const blocks: string[][] = [];

  // Group lines into blocks by finding the "Reply" terminator
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    currentBlock.push(line);

    // Split at "Reply" or "[Date]Reply"
    const isReply = line.toLowerCase() === 'reply';
    const isDateReply = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+Reply$/i.test(line) || /^\d+-\d+Reply$/i.test(line);

    if (isReply || isDateReply) {
      // Look ahead for likes count or "avatar" and include them in the current block to be cleaned later
      // This prevents them from being seen as the Name of the next block
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        if (nextLine.toLowerCase() === 'avatar' || /^\d+([\.kmb])?$/i.test(nextLine)) {
          currentBlock.push(nextLine);
          i = j;
          j++;
        } else {
          break;
        }
      }
      blocks.push([...currentBlock]);
      currentBlock = [];
    }
  }

  // Final block fallback
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  blocks.forEach((block, index) => {
    // 1. Clean block from global noise
    let cleanBlock = block.filter(l => !noisePatterns.some(p => p.test(l)));

    // 2. Remove leading metadata (likes counts) that might have survived
    while (cleanBlock.length > 0 && /^\d+([\.kmb])?$/i.test(cleanBlock[0])) {
      cleanBlock.shift();
    }

    if (cleanBlock.length < 2) return;

    // Pattern: [Name] [Comment] [Date] [Reply]
    const dateRegex = /^((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+|\d+-\d+)$/i;
    const dateReplyRegex = /^((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+|\d+-\d+)Reply$/i;
    const replyRegex = /^Reply$/i;

    let dateIndex = -1;
    // Find the date line from the bottom up
    for (let j = cleanBlock.length - 1; j >= 0; j--) {
      if (dateReplyRegex.test(cleanBlock[j]) || dateRegex.test(cleanBlock[j])) {
        dateIndex = j;
        break;
      }
    }

    let name = cleanBlock[0];
    let comment = '';
    let time = 'N/A';

    if (dateIndex !== -1) {
      time = cleanBlock[dateIndex].replace(/Reply$/i, '');
      // Comment is everything between Name and Date
      comment = cleanBlock.slice(1, dateIndex).join('\n');
    } else {
      // Fallback: Use "Reply" as the terminator if no date found
      const replyIndex = cleanBlock.findIndex(l => replyRegex.test(l));
      if (replyIndex > 1) {
        comment = cleanBlock.slice(1, replyIndex).join('\n');
      } else {
        comment = cleanBlock.slice(1).join('\n');
      }
    }

    if (name && name.length >= 1) {
      entries.push({
        id: `tiktok-entry-${index}-${Date.now()}`,
        name: name,
        comment: comment || '[No text]',
        time: time,
        originalText: block.join('\n')
      });
    }
  });

  return entries;
}


