import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import DocumentTemplatesModal from '../components/documents/DocumentTemplatesModal';
import SignDocumentModal from '../components/documents/SignDocumentModal';
import PolicyReaderModal from '../components/documents/PolicyReaderModal';
import AcknowledgementRosterModal from '../components/documents/AcknowledgementRosterModal';
import { ArshiMark } from '../components/branding/ArshiLogo';
import {
  Settings2, PenLine, CheckCircle2, BookOpen, ChevronRight, AlertCircle, ShieldCheck, FileText, Users,
} from 'lucide-react';

const CAT_ORDER = ['policy', 'hr', 'onboarding', 'tax', 'other'];
const CAT_LABEL = { policy: 'Company Policies', hr: 'Human Resources', onboarding: 'Onboarding', tax: 'Tax & Payroll', other: 'General' };

export default function DocumentsPage() {
  const { user, currentLocation } = useAuth();
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [pending, setPending] = useState([]);
  const [signed, setSigned] = useState([]);
  const [manage, setManage] = useState(false);
  const [reading, setReading] = useState(null); // policy template
  const [signingForm, setSigningForm] = useState(null); // fillable form template
  const [roster, setRoster] = useState(null); // policy whose roster is open
  const [ackSummary, setAckSummary] = useState({}); // templateId -> { total, current, outdated, never }

  const canManage = ['SUPER_ADMIN', 'REGIONAL_ADMIN'].includes(user.role);
  const canViewRoster = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user.role);

  const load = useCallback(async () => {
    try {
      const [{ data: t }, { data: p }, { data: s }] = await Promise.all([
        api.get('/document-templates', { params: { activeOnly: 'true' } }),
        api.get('/document-templates/mine/pending'),
        api.get('/document-templates/mine/signed'),
      ]);
      setTemplates(t); setPending(p); setSigned(s);
      if (canViewRoster) {
        api.get('/document-templates/acknowledgements/summary').then((r) => setAckSummary(r.data)).catch(() => {});
      }
    } catch { toast.error('Failed to load handbook'); }
  }, [toast, canViewRoster]);

  useEffect(() => { load(); }, [load]);

  // Deep-link: /documents?policy=<id> opens that policy's reader directly.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const id = searchParams.get('policy');
    if (!id || !templates.length) return;
    const t = templates.find((x) => x.id === id);
    if (t) { setReading(t); searchParams.delete('policy'); setSearchParams(searchParams, { replace: true }); }
  }, [templates, searchParams, setSearchParams]);

  const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

  const pendingIds = useMemo(() => new Set(pending.map((p) => p.id)), [pending]);
  const signedByTemplate = useMemo(() => {
    const m = {};
    signed.forEach((s) => { const cur = m[s.templateId]; if (!cur || new Date(s.signedAt) > new Date(cur.signedAt)) m[s.templateId] = s; });
    return m;
  }, [signed]);

  const statusFor = (t) => (pendingIds.has(t.id) ? (signedByTemplate[t.id] ? 'updated' : 'needs') : 'signed');

  const policies = templates.filter((t) => t.type !== 'fillable_form');
  const forms = templates.filter((t) => t.type === 'fillable_form');
  const pendingPolicies = policies.filter((t) => pendingIds.has(t.id));

  const grouped = CAT_ORDER
    .map((cat) => ({ cat, items: policies.filter((t) => (t.category || 'other') === cat) }))
    .filter((g) => g.items.length > 0);
  const ungrouped = policies.filter((t) => !CAT_ORDER.includes(t.category || 'other'));
  if (ungrouped.length) grouped.push({ cat: 'other', items: ungrouped });

  const statusBadge = (status) => {
    if (status === 'needs') return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full"><PenLine className="w-3 h-3" /> Signature required</span>;
    if (status === 'updated') return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 bg-orange-100 px-2 py-1 rounded-full"><AlertCircle className="w-3 h-3" /> Updated — re-sign</span>;
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3" /> Acknowledged</span>;
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Branded cover */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 text-white px-7 py-7 mb-6 shadow-sm">
        <div className="absolute -right-8 -top-8 opacity-10"><BookOpen className="w-44 h-44" /></div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-3"><ArshiMark size={26} /><span className="text-[11px] font-bold tracking-[0.2em] text-white/70 uppercase">Resources</span></div>
          <h1 className="text-3xl font-black tracking-tight">Company Handbook</h1>
          <p className="text-sm text-white/70 mt-1.5 max-w-lg">Every policy, standard, and procedure for {currentLocation?.name || 'the team'} — read, acknowledge, and sign in one place.</p>
          <div className="flex items-center gap-5 mt-4 text-sm">
            <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-white/60" /> {policies.length} polic{policies.length === 1 ? 'y' : 'ies'}</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-white/60" /> {policies.length - pendingPolicies.length} acknowledged</span>
          </div>
          {canManage && (
            <button onClick={() => setManage(true)} className="absolute top-0 right-0 flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/25 backdrop-blur text-white text-sm font-semibold rounded-xl">
              <Settings2 className="w-4 h-4" /> Manage
            </button>
          )}
        </div>
      </div>

      {/* Action-required banner */}
      {pendingPolicies.length > 0 && (
        <button onClick={() => setReading(pendingPolicies[0])}
          className="w-full text-left flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 hover:border-amber-300 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><PenLine className="w-5 h-5 text-amber-600" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">{pendingPolicies.length} polic{pendingPolicies.length === 1 ? 'y needs' : 'ies need'} your signature</p>
            <p className="text-xs text-amber-700 mt-0.5">Including any recently updated policies. Tap to review and sign.</p>
          </div>
          <span className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shrink-0">Review now <ChevronRight className="w-3.5 h-3.5" /></span>
        </button>
      )}

      {/* Policy sections */}
      {grouped.length === 0 ? (
        <p className="text-sm text-gray-400 bg-white border border-gray-100 rounded-2xl py-12 text-center">No policies published yet.{canManage ? ' Click "Manage" to add your first policy.' : ''}</p>
      ) : (
        grouped.map(({ cat, items }) => (
          <div key={cat} className="mb-7">
            <h2 className="text-[11px] font-bold tracking-wider text-brand-600 uppercase mb-3">{CAT_LABEL[cat] || 'General'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((t) => {
                const status = statusFor(t);
                return (
                  <button key={t.id} onClick={() => setReading(t)}
                    className="group text-left bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><BookOpen className="w-5 h-5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                        <p className="text-[11px] text-gray-400">v{t.version} · Updated {fmt(t.updatedAt)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 transition-colors shrink-0 mt-1" />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {statusBadge(status)}
                      {canViewRoster && ackSummary[t.id] && (
                        <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setRoster(t); }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-full cursor-pointer shrink-0">
                          <Users className="w-3 h-3" /> {ackSummary[t.id].current}/{ackSummary[t.id].total}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Fillable forms (tax/HR PDFs) */}
      {forms.length > 0 && (
        <div className="mb-7">
          <h2 className="text-[11px] font-bold tracking-wider text-brand-600 uppercase mb-3">Forms</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {forms.map((t) => {
              const status = statusFor(t);
              return (
                <button key={t.id} onClick={() => setSigningForm(t)}
                  className="group text-left bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0"><FileText className="w-5 h-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                      <p className="text-[11px] text-gray-400">Fillable form · v{t.version}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 transition-colors shrink-0 mt-1" />
                  </div>
                  <div className="mt-3">{statusBadge(status)}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {manage && <DocumentTemplatesModal onClose={() => { setManage(false); load(); }} />}
      {reading && (
        <PolicyReaderModal
          policy={reading}
          status={statusFor(reading)}
          signedRecord={signedByTemplate[reading.id]}
          onClose={() => setReading(null)}
          onSigned={() => { setReading(null); load(); }}
        />
      )}
      {signingForm && <SignDocumentModal template={signingForm} onClose={() => setSigningForm(null)} onSigned={() => { setSigningForm(null); load(); }} />}
      {roster && <AcknowledgementRosterModal policy={roster} onClose={() => setRoster(null)} />}
    </div>
  );
}
