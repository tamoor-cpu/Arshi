import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pages, total, onPageChange, label = 'items' }) {
  if (pages <= 1) return null;

  const getPageNumbers = () => {
    const nums = [];
    const maxVisible = 5;

    if (pages <= maxVisible) {
      for (let i = 1; i <= pages; i++) nums.push(i);
    } else {
      nums.push(1);
      if (page > 3) nums.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) {
        nums.push(i);
      }
      if (page < pages - 2) nums.push('...');
      nums.push(pages);
    }

    return nums;
  };

  return (
    <div className="flex items-center justify-between px-1 py-3">
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {total} {label} &middot; Page {page} of {pages}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>
        {getPageNumbers().map((num, idx) =>
          num === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 text-xs">...</span>
          ) : (
            <button
              key={num}
              onClick={() => onPageChange(num)}
              className={`w-8 h-8 text-xs rounded font-medium transition-colors ${
                num === page
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {num}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    </div>
  );
}
