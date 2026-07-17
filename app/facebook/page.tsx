'use client';

import React, { useState } from 'react';
import TextInput from '@/components/TextInput';
import CommentTable from '@/components/CommentTable';
import SiteFooter from '@/components/SiteFooter';
import ToolIcon from '@/components/ToolIcon';
import { parseComments, CommentEntry } from '@/lib/parser';

export default function FacebookTool() {
  const [data, setData] = useState<CommentEntry[]>([]);

  const handleParse = (text: string) => {
    const parsed = parseComments(text);
    setData(parsed);
  };

  return (
    <main className="container">
      <header className="header">
        <span className="tool-logo" aria-hidden="true"><ToolIcon id="facebook" size={40} /></span>
        <h1>Facebook to Sheet</h1>
        <p>Extract structured names, comments and timestamps from copied Facebook comments — ready for Excel.</p>
      </header>

      <div className="glass-panel">
        <TextInput onParse={handleParse} />
      </div>

      <CommentTable data={data} setData={setData} />

      <SiteFooter />
    </main>
  );
}
