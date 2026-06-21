import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext();

let toastId = 0;

const TOAST_CONFIG = {
  success: { icon: CheckCircle2, bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-400', text: 'text-green-800 dark:text-green-200', iconColor: 'text-green-500' },
  error: { icon: XCircle, bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-400', text: 'text-red-800 dark:text-red-200', iconColor: 'text-red-500' },
  warning: { icon: AlertTriangle, bg: 'bg-yellow-50 dark:bg-yellow-900/30', border: 'border-yellow-400', text: 'text-yellow-800 dark:text-yellow-200', iconColor: 'text-yellow-500' },
  info: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-400', text: 'text-blue-800 dark:text-blue-200', iconColor: 'text-blue-500' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
    return id;
  }, [removeToast]);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur || 6000),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container - fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const config = TOAST_CONFIG[t.type] || TOAST_CONFIG.info;
          const Icon = config.icon;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border ${config.bg} ${config.border} shadow-lg animate-slide-in`}
            >
              <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${config.iconColor}`} />
              <p className={`text-sm font-medium flex-1 ${config.text}`}>{t.message}</p>
              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 p-0.5 hover:bg-black/5 dark:hover:bg-white/10 rounded"
              >
                <X className={`w-4 h-4 ${config.text} opacity-60`} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
