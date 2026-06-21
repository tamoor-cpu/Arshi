import React from 'react';
import { HelpCircle, Plus } from 'lucide-react';

/**
 * WashConsole-style page scaffold used for modules that are being built out.
 * Renders the familiar header (title + console tag + primary action) and a
 * clean stat row + empty state so the section feels consistent app-wide.
 */
export default function ConsolePlaceholder({
  consoleTag = 'OPERATIONS',
  title,
  subtitle,
  icon: Icon = HelpCircle,
  primaryLabel,
  stats = [],
  emptyTitle = 'Nothing here yet',
  emptyHint = 'Items will appear here once they are added at this location.',
}) {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-brand-500">{consoleTag}</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white mt-0.5">
            <Icon className="w-6 h-6 text-brand-500" />
            {title}
          </h1>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600">
            <HelpCircle className="w-5 h-5" />
          </button>
          {primaryLabel && (
            <button className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors">
              <Plus className="w-4 h-4" /> {primaryLabel}
            </button>
          )}
        </div>
      </div>

      {/* Stat tiles */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${s.dot || 'bg-brand-400'}`} />
                <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">{s.label}</p>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{s.value}</p>
              {s.hint && <p className="text-xs text-gray-400 mt-1">{s.hint}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
          <Icon className="w-7 h-7 text-brand-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200">{emptyTitle}</h3>
        <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">{emptyHint}</p>
      </div>
    </div>
  );
}
