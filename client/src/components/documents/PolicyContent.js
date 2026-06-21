import React from 'react';

// Lightweight formatter so policy text reads as a real document instead of a
// plain blob. Supports:  # H1  ## H2  ### H3 ·  - / * bullets ·  1. numbered
// ·  **bold**  ·  blank line = paragraph break.
function inline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{p}</React.Fragment>);
}

export default function PolicyContent({ content }) {
  if (!content || !content.trim()) return <p className="text-gray-400 italic">No content yet.</p>;

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let list = null;
  let listType = null;
  const flush = () => { if (list) { blocks.push({ type: listType, items: list }); list = null; listType = null; } };

  lines.forEach((raw) => {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) { flush(); blocks.push({ type: 'h4', text: line.replace(/^###\s+/, '') }); }
    else if (/^##\s+/.test(line)) { flush(); blocks.push({ type: 'h3', text: line.replace(/^##\s+/, '') }); }
    else if (/^#\s+/.test(line)) { flush(); blocks.push({ type: 'h2', text: line.replace(/^#\s+/, '') }); }
    else if (/^\s*[-*]\s+/.test(line)) { if (listType === 'ol') flush(); listType = 'ul'; (list = list || []).push(line.replace(/^\s*[-*]\s+/, '')); }
    else if (/^\s*\d+[.)]\s+/.test(line)) { if (listType === 'ul') flush(); listType = 'ol'; (list = list || []).push(line.replace(/^\s*\d+[.)]\s+/, '')); }
    else if (line.trim() === '') { flush(); }
    else { flush(); blocks.push({ type: 'p', text: line }); }
  });
  flush();

  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        if (b.type === 'h2') return <h2 key={i} className="text-xl font-bold text-gray-900 mt-6 first:mt-0 pb-1.5 border-b border-gray-100">{inline(b.text)}</h2>;
        if (b.type === 'h3') return <h3 key={i} className="text-base font-bold text-gray-900 mt-5">{inline(b.text)}</h3>;
        if (b.type === 'h4') return <h4 key={i} className="text-xs font-bold text-brand-600 uppercase tracking-wider mt-4">{inline(b.text)}</h4>;
        if (b.type === 'ul') return <ul key={i} className="list-disc pl-5 space-y-1.5 text-[15px] text-gray-700 leading-relaxed marker:text-brand-400">{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>;
        if (b.type === 'ol') return <ol key={i} className="list-decimal pl-5 space-y-1.5 text-[15px] text-gray-700 leading-relaxed marker:text-brand-500 marker:font-semibold">{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>;
        return <p key={i} className="text-[15px] text-gray-700 leading-relaxed">{inline(b.text)}</p>;
      })}
    </div>
  );
}
