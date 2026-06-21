import React, { useRef, useEffect, useState } from 'react';
import { Eraser, PenLine } from 'lucide-react';

// Lightweight canvas signature pad — no external dependencies.
// Calls onChange(dataUrl|null) as the user draws or clears.
export default function SignaturePad({ onChange, height = 150 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  }, [height]);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };

  const start = (e) => { e.preventDefault(); drawing.current = true; last.current = pos(e); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (onChange) onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    if (onChange) onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height }}
          className="touch-none cursor-crosshair block"
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
        {!hasInk && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="flex items-center gap-1.5 text-sm text-gray-300"><PenLine className="w-4 h-4" /> Sign here</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-[11px] text-gray-400">Draw your signature above</p>
        <button type="button" onClick={clear} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          <Eraser className="w-3.5 h-3.5" /> Clear
        </button>
      </div>
    </div>
  );
}
