'use client';

import React, { useState } from 'react';
import TextInput from '@/components/TextInput';
import CommentTable from '@/components/CommentTable';
import { parseComments, CommentEntry } from '@/lib/parser';

export default function Home() {
  const [data, setData] = useState<CommentEntry[]>([]);

  const handleParse = (text: string) => {
    const parsed = parseComments(text);
    setData(parsed);
  };

  return (
    <main className="container">
      <header className="header">
        <h1>Comment to Sheet</h1>
        <p>A simple yet powerful tool to extract structured data from Facebook comments.</p>
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
