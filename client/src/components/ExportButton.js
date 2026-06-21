import React, { useState } from 'react';
import { Download } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export default function ExportButton({ endpoint, filename, label = 'Export CSV', className = '' }) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await api.get(endpoint, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename || 'export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${label} downloaded successfully`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors ${className}`}
    >
      <Download className={`w-4 h-4 ${loading ? 'animate-bounce' : ''}`} />
      {loading ? 'Exporting...' : label}
    </button>
  );
}
