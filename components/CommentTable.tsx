'use client';

import React from 'react';
import * as XLSX from 'xlsx';
import { CommentEntry } from '@/lib/parser';

interface CommentTableProps {
  data: CommentEntry[];
  setData: (data: CommentEntry[]) => void;
}

export default function CommentTable({ data, setData }: CommentTableProps) {
  
  const handleEdit = (id: string, field: keyof CommentEntry, value: string) => {
    setData(data.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSwap = (id: string) => {
    setData(data.map(item => {
      if (item.id === id) {
        return { ...item, name: item.comment, comment: item.name };
      }
      return item;
    }));
  };

  const handleDelete = (id: string) => {
    setData(data.filter(item => item.id !== id));
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data.map(d => ({
      Name: d.name,
      Comment: d.comment,
      Time: d.time
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comments");
    XLSX.writeFile(wb, `comments_export_${Date.now()}.xlsx`);
  };

  return (
    <div className="glass-panel" style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Live Preview <span style={{ color: 'var(--accent)', fontSize: '1rem', marginLeft: '0.5rem' }}>({data.length} comments found)</span></h2>
        <button onClick={exportToExcel} className="btn-primary" style={{ background: '#10b981' }}>
          <svg className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export to Excel (.xlsx)
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: '20%' }}>Name</th>
              <th style={{ width: '50%' }}>Comment</th>
              <th style={{ width: '15%' }}>Time</th>
              <th style={{ width: '15%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-state">
                  No data parsed yet. Paste some comments above and click "Analyze".
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input 
                      className="editable-input" 
                      value={item.name} 
                      onChange={(e) => handleEdit(item.id, 'name', e.target.value)}
                    />
                  </td>
                  <td>
                    <textarea 
                      className="editable-input" 
                      style={{ minHeight: '60px' }}
                      value={item.comment} 
                      onChange={(e) => handleEdit(item.id, 'comment', e.target.value)}
                    />
                  </td>
                  <td>
                    <input 
                      className="editable-input" 
                      value={item.time} 
                      onChange={(e) => handleEdit(item.id, 'time', e.target.value)}
                    />
                  </td>
                  <td style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button 
                      onClick={() => handleSwap(item.id)} 
                      title="Swap Name/Comment"
                      style={{ background: '#f1f5f9', border: '1px solid var(--border)', padding: '0.3rem', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      🔄
                    </button>
                    <button 
                      onClick={() => {
                        const newComment = prompt('Split comment at (enter text or index):', item.comment);
                        if (newComment && newComment !== item.comment) {
                           // Basic split logic for user manually correcting it
                           setData([...data, { ...item, id: Date.now().toString(), comment: newComment }]);
                        }
                      }} 
                      title="Split/Duplicate Entry"
                      style={{ background: '#f1f5f9', border: '1px solid var(--border)', padding: '0.3rem', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      ✂️
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)} 
                      title="Delete"
                      style={{ background: '#fef2f2', border: '1px solid var(--border)', padding: '0.3rem', borderRadius: '4px', cursor: 'pointer', color: '#ef4444' }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
