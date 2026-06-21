import React from 'react';
import { Printer } from 'lucide-react';

export default function PrintButton({ className = '' }) {
  return (
    <button
      onClick={() => window.print()}
      className={`no-print flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 ${className}`}
    >
      <Printer className="w-4 h-4" /> Print
    </button>
  );
}
