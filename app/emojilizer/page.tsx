'use client';

import React, { useState } from 'react';

const FB_LIMIT = 63206;

export default function Emojilizer() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const inputCharCount = inputText.length;
  const outputCharCount = outputText.length;
  const overLimit = inputCharCount > FB_LIMIT;
  const canSubmit = inputText.trim().length > 0 && !loading && !overLimit;

  const handleEmojilize = async () => {
    if (!canSubmit) return;

    setLoading(true);
    setError('');
    setOutputText('');

    try {
      const res = await fetch('/api/emojilizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: inputText }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setOutputText(data.result);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silently fail — user can manually select
    }
  };

  const handleClear = () => {
    setInputText('');
    setOutputText('');
    setError('');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', marginTop: '2.5rem' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1rem', color: '#111827' }}>
            ✨ Emojilizer
          </h1>
          <p style={{ fontSize: '1.125rem', color: '#4b5563', maxWidth: '44rem', margin: '0 auto' }}>
            Paste your Facebook post and let AI add the perfect emojis — professionally tuned for medical and health-focused content.
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.75rem',
            padding: '0.875rem 1.25rem',
            marginBottom: '1.5rem',
            color: '#dc2626',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
          }}>
            <span style={{ flexShrink: 0 }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Main Panel */}
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'stretch',
          background: 'white',
          borderRadius: '1rem',
          padding: '1.5rem',
          border: '1px solid #e5e7eb',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        }}>

          {/* ── Input Panel ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', color: '#374151', letterSpacing: '0.05em' }}>
                Your Post
              </label>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: overLimit ? '#dc2626' : '#9ca3af', fontWeight: overLimit ? 600 : 400 }}>
                  {inputCharCount.toLocaleString()} / {FB_LIMIT.toLocaleString()}
                </span>
                <button
                  onClick={handleClear}
                  style={{ fontSize: '0.75rem', color: '#2563eb', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 500 }}
                >
                  Clear
                </button>
              </div>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your Facebook post here..."
              style={{
                flex: 1,
                minHeight: '320px',
                width: '100%',
                padding: '1rem',
                borderRadius: '0.75rem',
                border: overLimit ? '1px solid #fca5a5' : '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
                fontSize: '1rem',
                color: '#1f2937',
                resize: 'vertical',
                outline: 'none',
                lineHeight: '1.7',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* ── Center Button Column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', minWidth: '100px' }}>
            <button
              onClick={handleEmojilize}
              disabled={!canSubmit}
              style={{
                padding: '0.875rem 1rem',
                borderRadius: '0.75rem',
                border: 'none',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                background: canSubmit
                  ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                  : '#e5e7eb',
                color: canSubmit ? 'white' : '#9ca3af',
                fontWeight: 700,
                fontSize: '0.9rem',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                boxShadow: canSubmit ? '0 4px 14px rgba(245,158,11,0.35)' : 'none',
                textAlign: 'center',
                width: '100%',
              }}
            >
              {loading ? '⏳ Working...' : '✨ Add Emojis'}
            </button>
            {loading && (
              <span style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'center' }}>
                Thinking...
              </span>
            )}
          </div>

          {/* ── Output Panel ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', color: '#374151', letterSpacing: '0.05em' }}>
                With Emojis
              </label>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {outputText && (
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {outputCharCount.toLocaleString()} chars
                  </span>
                )}
                <button
                  onClick={handleCopy}
                  disabled={!outputText}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontWeight: 500,
                    border: 'none',
                    cursor: outputText ? 'pointer' : 'not-allowed',
                    backgroundColor: copied ? '#d1fae5' : outputText ? '#dbeafe' : '#f3f4f6',
                    color: copied ? '#047857' : outputText ? '#1d4ed8' : '#9ca3af',
                    transition: 'background-color 0.2s',
                  }}
                >
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <textarea
              value={outputText}
              readOnly
              placeholder={loading ? 'Adding emojis to your post...' : 'Your emoji-enhanced post will appear here...'}
              style={{
                flex: 1,
                minHeight: '320px',
                width: '100%',
                padding: '1rem',
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb',
                backgroundColor: outputText ? 'white' : '#f9fafb',
                fontSize: '1rem',
                color: '#111827',
                resize: 'vertical',
                outline: 'none',
                lineHeight: '1.7',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '3rem', paddingBottom: '2rem' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>
            Built for Dr Nathan Marketing and Consultancy by Shain Wai Yan
          </p>
        </div>

      </div>
    </div>
  );
}
