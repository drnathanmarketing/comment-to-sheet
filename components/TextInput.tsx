'use client';

import React, { useState } from 'react';

interface TextInputProps {
  onParse: (text: string) => void;
}

export default function TextInput({ onParse }: TextInputProps) {
  const [text, setText] = useState('');

  const handleClear = () => {
    setText('');
  };

  return (
    <div className="input-area">
      <textarea
        placeholder="Paste your copied Facebook comments here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
        <button 
          onClick={handleClear}
          className="btn-primary" 
          style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)' }}
        >
          Clear
        </button>
        <button 
          onClick={() => onParse(text)} 
          className="btn-primary"
          disabled={!text.trim()}
        >
          <svg className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Analyze & Align
        </button>
      </div>
    </div>
  );
}
