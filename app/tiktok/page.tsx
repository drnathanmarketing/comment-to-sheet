'use client';

import React, { useState } from 'react';
import TextInput from '@/components/TextInput';
import CommentTable from '@/components/CommentTable';
import { parseTiktokComments } from '@/lib/tiktok-parser';
import { CommentEntry } from '@/lib/parser';

export default function TiktokPage() {
  const [data, setData] = useState<CommentEntry[]>([]);

  const handleParse = (text: string) => {
    const parsed = parseTiktokComments(text);
    setData(parsed);
  };

  return (
    <main className="container">
      <header className="header">
        <h1>TikTok to Sheet</h1>
        <p>Extract structured data from TikTok "copy-pasted" comments effortlessly.</p>
      </header>

      <div className="glass-panel">
        <TextInput onParse={handleParse} />
      </div>

      <CommentTable data={data} setData={setData} />

      <footer>
        build for Dr Nathan Marketing and consultancy by Shain Wai Yan
      </footer>
    </main>
  );
}
