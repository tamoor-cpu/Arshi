import React from 'react';

const DISPLAY = "'Space Grotesk', system-ui, sans-serif";

// ARSHI emblem — "Pulse": a gauge sweep with a rising needle. Reads as
// operational monitoring / metrics. Freestanding mark, no box, works on
// light and dark backgrounds.
export function ArshiMark({ size = 36, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-label="ARSHI">
      <defs>
        <linearGradient id="arshiPulse" x1="12" y1="14" x2="52" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a78bfa" />
          <stop offset="1" stopColor="#5b29d4" />
        </linearGradient>
      </defs>
      {/* gauge track */}
      <path d="M13 39 A20 20 0 0 1 51 39" fill="none" stroke="#c4b5fd" strokeWidth="6" strokeLinecap="round" strokeOpacity="0.5" />
      {/* active sweep */}
      <path d="M13 39 A20 20 0 0 1 32 19" fill="none" stroke="url(#arshiPulse)" strokeWidth="6" strokeLinecap="round" />
      {/* needle */}
      <line x1="32" y1="39" x2="44.5" y2="22" stroke="url(#arshiPulse)" strokeWidth="5" strokeLinecap="round" />
      {/* pivot */}
      <circle cx="32" cy="39" r="4.5" fill="url(#arshiPulse)" />
    </svg>
  );
}

// The custom "I" — a brand-colored bar topped with a diamond spark node,
// so the wordmark reads as a designed lockup rather than plain type.
function SparkI({ light }) {
  return (
    <span className="relative inline-flex flex-col items-center ml-[3px] mr-[1px]" style={{ marginBottom: '1px' }}>
      <span className="block bg-brand-500 rotate-45 rounded-[1px]" style={{ width: 6, height: 6, marginBottom: 2 }} />
      <span className={`block rounded-[1.5px] ${light ? 'bg-white' : 'bg-gray-900 dark:bg-white'}`} style={{ width: 5, height: 16 }} />
    </span>
  );
}

export function ArshiWordmark({ light = false, size = 'text-[17px]', className = '' }) {
  return (
    <span className={`inline-flex items-end leading-none ${className}`} style={{ fontFamily: DISPLAY }}>
      <span className={`font-bold tracking-[0.16em] ${size} ${light ? 'text-white' : 'text-gray-900 dark:text-white'}`}>ARSH</span>
      <SparkI light={light} />
    </span>
  );
}

export function ArshiLogo({ markSize = 36, light = false, showTagline = true, className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <ArshiMark size={markSize} />
      <div className="leading-none">
        <ArshiWordmark light={light} />
        {showTagline && (
          <p className={`text-[8px] font-semibold tracking-[0.16em] mt-[5px] ${light ? 'text-white/40' : 'text-gray-400'}`}>THE INTELLIGENT OPERATIONS PLATFORM</p>
        )}
      </div>
    </div>
  );
}

export default ArshiLogo;
