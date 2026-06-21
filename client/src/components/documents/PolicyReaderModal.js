import React, { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import SignaturePad from './SignaturePad';
import PolicyContent from './PolicyContent';
import { ArshiMark } from '../branding/ArshiLogo';
import { X, CheckCircle2, Loader2, PenLine, ExternalLink, ShieldCheck, AlertCircle, FileText } from 'lucide-react';

const CAT_LABEL = { onboarding: 'Onboarding', policy: 'Company Policy', tax: 'Tax', hr: 'Human Resources', other: 'General' };

// Branded reader for a single handbook policy + inline acknowledgement/signing.
export default function PolicyReaderModal({ policy, status, signedRecord, userId, onClose, onSigned }) {
  const toast = useToast();
  const [signature, setSignature] = useState(null);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

  const sign = async () => {
    if (policy.requireSignature && !signature) { toast.error('Please draw your signature'); return; }
    if (!agree) { toast.error('Please confirm you have read this policy'); return; }
    setSubmitting(true);
    try {
      await api.post(`/document-templates/${policy.id}/sign`, { signatureDataUrl: signature, userId });
      toast.success('Policy acknowledged & saved to your file');
      onSigned && onSigned();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to sign');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Branded cover */}
        <div className="relative bg-gradient-to-br from-brand-600 to-brand-800 px-7 py-6 text-white shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/15 rounded-lg"><X className="w-5 h-5" /></button>
          <div className="flex items-center gap-2 mb-3">
            <ArshiMark size={24} />
            <span className="text-[11px] font-bold tracking-[0.18em] text-white/70 uppercase">{CAT_LABEL[policy.category] || 'Policy'}</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight pr-8">{policy.name}</h2>
          <p className="text-xs text-white/60 mt-1.5">Version {policy.version} · Updated {fmt(policy.updatedAt)}</p>
        </div>

        {status === 'updated' && (
          <div className="bg-amber-50 border-b border-amber-200 px-7 py-2.5 flex items-center gap-2 text-sm text-amber-800 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" /> This policy was updated since you last signed. Please re-read and sign the new version.
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          {policy.type === 'fillable_form' ? (
            <a href={policy.sourceFileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 hover:border-brand-300">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700"><FileText className="w-4 h-4 text-brand-500" /> Open the PDF to review</span>
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>
          ) : (
            <PolicyContent content={policy.content} />
          )}
        </div>

        {/* Footer / sign */}
        <div className="border-t border-gray-100 shrink-0">
          {status === 'signed' ? (
            <div className="px-7 py-4 flex items-center justify-between gap-3 bg-green-50/60">
              <p className="flex items-center gap-2 text-sm font-semibold text-green-700"><ShieldCheck className="w-5 h-5" /> You acknowledged v{signedRecord?.templateVersion ?? policy.version} on {fmt(signedRecord?.signedAt)}</p>
              {signedRecord?.signedPdfUrl && <a href={signedRecord.signedPdfUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100"><ExternalLink className="w-3.5 h-3.5" /> View signed PDF</a>}
            </div>
          ) : (
            <div className="px-7 py-4 space-y-3">
              {policy.requireSignature && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">Sign below</p>
                  <SignaturePad onChange={setSignature} />
                </div>
              )}
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 w-4 h-4 rounded text-brand-500" />
                I have read and understood this policy. My electronic signature is legally binding.
              </label>
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Close</button>
                <button onClick={sign} disabled={submitting} className="flex items-center gap-1.5 px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />} Acknowledge &amp; Sign
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
