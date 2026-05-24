"use client";

import React, { useState } from "react";

function toBold(text: string) {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 65 && code <= 90) { // A-Z
      result += String.fromCodePoint(code - 65 + 0x1D5D4);
    } else if (code >= 97 && code <= 122) { // a-z
      result += String.fromCodePoint(code - 97 + 0x1D5EE);
    } else if (code >= 48 && code <= 57) { // 0-9
      result += String.fromCodePoint(code - 48 + 0x1D7EC);
    } else {
      result += text[i];
    }
  }
  return result;
}

function processText(text: string) {
  // Add space between English alphanumeric and Burmese characters
  let spacedText = text
    .replace(/([a-zA-Z0-9])([\u1000-\u109F\uAA60-\uAA7F\uA9E0-\uA9FF])/g, "$1 $2")
    .replace(/([\u1000-\u109F\uAA60-\uAA7F\uA9E0-\uA9FF])([a-zA-Z0-9])/g, "$1 $2");
  
  // Bold the text
  return toBold(spacedText);
}

export default function BoldTextMaker() {
  const [inputText, setInputText] = useState("");
  const [copied, setCopied] = useState(false);

  const outputText = processText(inputText);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', marginTop: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, fontFamily: "serif", marginBottom: '1rem', color: '#111827' }}>
            Bold Text Maker
          </h1>
          <p style={{ fontSize: '1.125rem', color: '#4b5563', maxWidth: '42rem', margin: '0 auto' }}>
            Convert your English text to bold automatically. Perfect for Facebook posts! It also smartly adds spacing between English and Burmese text.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '2rem', background: 'white', borderRadius: '1rem', padding: '1.5rem', border: '1px solid #e5e7eb', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', color: '#374151' }}>Input</label>
              <button 
                onClick={() => setInputText("")}
                style={{ fontSize: '0.75rem', color: '#2563eb', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 500 }}
              >
                Clear
              </button>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Normal text goes here... e.g., အိန္ဒိယမှာ ဆေးကုသဖို့ WeCare က ဘယ်လိုကူညီပေးနိုင်သလဲ?"
              style={{ flex: 1, minHeight: '300px', width: '100%', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontSize: '1.125rem', color: '#1f2937', resize: 'none', outline: 'none' }}
            />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', color: '#374151' }}>Output</label>
              <button
                onClick={handleCopy}
                disabled={!outputText}
                style={{
                  fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontWeight: 500, border: 'none',
                  cursor: outputText ? 'pointer' : 'not-allowed',
                  backgroundColor: copied ? '#d1fae5' : outputText ? '#dbeafe' : '#f3f4f6',
                  color: copied ? '#047857' : outputText ? '#1d4ed8' : '#9ca3af',
                  transition: 'background-color 0.2s'
                }}
              >
                {copied ? "Copied!" : "Copy Text"}
              </button>
            </div>
            <textarea
              value={outputText}
              readOnly
              placeholder="And Bold text will appear here..."
              style={{ flex: 1, minHeight: '300px', width: '100%', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', backgroundColor: 'white', fontSize: '1.125rem', color: '#111827', resize: 'none', outline: 'none' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
