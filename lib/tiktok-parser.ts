import { CommentEntry } from './parser';

export function parseTiktokComments(rawText: string): CommentEntry[] {
  const entries: CommentEntry[] = [];
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let currentBlock: string[] = [];
  const blocks: string[][] = [];

  // TikTok blocks often start with or contain "avatar"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // If we hit "avatar", it's the start of a new comment block
    if (line.toLowerCase() === 'avatar' && currentBlock.length > 0) {
      blocks.push([...currentBlock]);
      currentBlock = [];
    }
    
    currentBlock.push(line);
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  blocks.forEach((block, index) => {
    // Clean block from noise
    const cleanBlock = block.filter(l => l.toLowerCase() !== 'avatar' && l.toLowerCase() !== 'creator videos');

    if (cleanBlock.length < 2) return;

    // Pattern: [Name] [Comment] [Date]Reply [Likes]
    // Finding the Date line (e.g. "Mar 19Reply")
    const dateReplyRegex = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d+Reply$/;
    
    let dateIndex = -1;
    for (let j = 0; j < cleanBlock.length; j++) {
      if (dateReplyRegex.test(cleanBlock[j])) {
        dateIndex = j;
        break;
      }
    }

    let name = cleanBlock[0];
    let comment = '';
    let time = 'N/A';

    if (dateIndex !== -1) {
      time = cleanBlock[dateIndex].replace('Reply', '');
      // Comment is everything between name and date
      const commentLines = cleanBlock.slice(1, dateIndex);
      comment = commentLines.join('\n');
    } else {
      // Fallback
      comment = cleanBlock.slice(1).join('\n');
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
