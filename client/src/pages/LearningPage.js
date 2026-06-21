import React, { useState } from 'react';
import { GraduationCap, FileText } from 'lucide-react';
import TrainingPage from './TrainingPage';
import SOPsPage from './SOPsPage';

const TABS = [
  { key: 'training', label: 'Training', icon: GraduationCap },
  { key: 'sops', label: 'SOPs', icon: FileText },
];

export default function LearningPage() {
  const [tab, setTab] = useState('training');
  return (
    <div>
      <div className="px-6 lg:px-8 pt-6">
        <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${active ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>
      {tab === 'training' ? <TrainingPage /> : <SOPsPage />}
    </div>
  );
}
