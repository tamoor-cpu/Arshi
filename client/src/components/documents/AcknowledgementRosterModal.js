import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ArshiMark } from '../branding/ArshiLogo';
import { X, CheckCircle2, AlertCircle, Clock, ExternalLink, Loader2, Bell } from 'lucide-react';

const STATUS = {
  current: { label: 'Signed', cls: 'text-green-700 bg-green-100', icon: CheckCircle2 },
  outdated: { label: 'Out of date', cls: 'text-orange-700 bg-orange-100', icon: AlertCircle },
  never: { label: 'Not signed', cls: 'text-gray-500 bg-gray-100', icon: Clock },
};

export default function AcknowledgementRosterModal({ policy, onClose }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [sending, setSending] = useState(false);
  const [remindedIds, setRemindedIds] = useState(() => new Set());

  useEffect(() => {
    api.get(`/document-templates/${policy.id}/acknowledgements`)
      .then((r) => setData(r.data))
      .catch(() => toast.error('Failed to load acknowledgements'));
  }, [policy.id, toast]);

  const remindAll = async () => {
    setSending(true);
    try {
      const { data: r } = await api.post(`/document-templates/${policy.id}/remind`);
      const outstandingIds = (data?.roster || []).filter((x) => x.status !== 'current').map((x) => x.userId);
      setRemindedIds(new Set(outstandingIds));
      toast.success(`Reminder sent to ${r.remindedCount} employee${r.remindedCount === 1 ? '' : 's'}`);
    } catch { toast.error('Failed to send reminders'); }
    setSending(false);
  };

  const remindOne = async (userId, name) => {
    try {
      await api.post(`/document-templates/${policy.id}/remind`, { userIds: [userId] });
      setRemindedIds((s) => new Set(s).add(userId));
      toast.success(`Reminder sent to ${name}`);
    } catch { toast.error('Failed to send reminder'); }
  };

  const initials = (n) => (n || '').split(' ').map((p) => p[0]).slice(0, 2).join('');
  const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative bg-gradient-to-br from-brand-600 to-brand-800 px-7 py-6 text-white shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/15 rounded-lg"><X className="w-5 h-5" /></button>
          <div className="flex items-center gap-2 mb-3"><ArshiMark size={24} /><span className="text-[11px] font-bold tracking-[0.18em] text-white/70 uppercase">Acknowledgements</span></div>
          <h2 className="text-2xl font-black tracking-tight pr-8">{policy.name}</h2>
          <p className="text-xs text-white/60 mt-1.5">Current version v{policy.version}</p>
        </div>

        {!data ? (
          <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 shrink-0">
              <div className="px-4 py-3 text-center"><p className="text-2xl font-black text-green-600">{data.summary.current}</p><p className="text-[11px] text-gray-400">Signed</p></div>
              <div className="px-4 py-3 text-center"><p className="text-2xl font-black text-orange-500">{data.summary.outdated}</p><p className="text-[11px] text-gray-400">Out of date</p></div>
              <div className="px-4 py-3 text-center"><p className="text-2xl font-black text-gray-400">{data.summary.never}</p><p className="text-[11px] text-gray-400">Not signed</p></div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {data.roster.map((r) => {
                const st = STATUS[r.status];
                const Icon = st.icon;
                return (
                  <div key={r.userId} className="flex items-center gap-3 px-6 py-3">
                    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{initials(r.name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                      <p className="text-[11px] text-gray-400 truncate capitalize">{r.position}{r.signedAt ? ` · signed v${r.signedVersion} ${fmt(r.signedAt)}` : ''}</p>
                    </div>
                    {r.signedPdfUrl && <a href={r.signedPdfUrl} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-brand-500 shrink-0"><ExternalLink className="w-4 h-4" /></a>}
                    {r.status !== 'current' && (
                      remindedIds.has(r.userId)
                        ? <span className="flex items-center gap-1 text-[11px] font-semibold text-green-600 shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /> Sent</span>
                        : <button onClick={() => remindOne(r.userId, r.name)} title="Send reminder" className="text-gray-300 hover:text-brand-500 shrink-0"><Bell className="w-4 h-4" /></button>
                    )}
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full shrink-0 ${st.cls}`}><Icon className="w-3 h-3" /> {st.label}{r.status === 'outdated' ? ` (v${r.signedVersion})` : ''}</span>
                  </div>
                );
              })}
            </div>
            {(data.summary.outdated + data.summary.never) > 0 && (
              <div className="border-t border-gray-100 px-6 py-3 flex items-center justify-between gap-3 shrink-0 bg-gray-50">
                <p className="text-xs text-gray-500">{data.summary.outdated + data.summary.never} haven't signed the current version.</p>
                <button onClick={remindAll} disabled={sending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />} Remind all
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
