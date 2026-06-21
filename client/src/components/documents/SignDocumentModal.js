import React, { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import SignaturePad from './SignaturePad';
import { X, FileText, ExternalLink, CheckCircle2, Loader2 } from 'lucide-react';

// Employee fills any fields and signs; backend generates the final signed PDF.
export default function SignDocumentModal({ template, userId, onClose, onSigned }) {
  const toast = useToast();
  const [fieldData, setFieldData] = useState(() => {
    const init = {};
    (template.fields || []).forEach((f) => { init[f.key] = f.type === 'checkbox' ? false : ''; });
    return init;
  });
  const [signature, setSignature] = useState(null);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const sign = async () => {
    if (template.requireSignature && !signature) { toast.error('Please draw your signature'); return; }
    if (!agree) { toast.error('Please confirm the acknowledgement'); return; }
    setSubmitting(true);
    try {
      await api.post(`/document-templates/${template.id}/sign`, { fieldData, signatureDataUrl: signature, userId });
      toast.success('Document signed & saved to the file');
      onSigned && onSigned();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to sign document');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-brand-500" /></div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-gray-900 truncate">{template.name}</h3>
              <p className="text-xs text-gray-400 capitalize">{template.type === 'fillable_form' ? 'Fillable form' : 'Policy document'} · v{template.version}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Document body */}
          {template.type === 'fillable_form' ? (
            <a href={template.sourceFileUrl} target="_blank" rel="noreferrer"
              className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 hover:border-brand-300">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700"><FileText className="w-4 h-4 text-brand-500" /> Open the original PDF to review</span>
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>
          ) : (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 max-h-64 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {template.content || 'No content.'}
            </div>
          )}

          {/* Fields to fill */}
          {(template.fields || []).length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-2">Fill in your information</p>
              <div className="grid grid-cols-2 gap-3">
                {template.fields.map((f) => (
                  <div key={f.key} className={f.type === 'checkbox' ? 'col-span-2' : ''}>
                    {f.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={!!fieldData[f.key]} onChange={(e) => setFieldData({ ...fieldData, [f.key]: e.target.checked })} className="w-4 h-4 rounded text-brand-500" />
                        {f.label || f.key}
                      </label>
                    ) : (
                      <>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label || f.key}</label>
                        <input type={f.type === 'date' ? 'date' : 'text'} value={fieldData[f.key] || ''}
                          onChange={(e) => setFieldData({ ...fieldData, [f.key]: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signature */}
          {template.requireSignature && (
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-2">Your signature</p>
              <SignaturePad onChange={setSignature} />
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 w-4 h-4 rounded text-brand-500" />
            I have reviewed this document and the information I provided is true and accurate. My electronic signature is legally binding.
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={sign} disabled={submitting}
            className="flex items-center gap-1.5 px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Sign & Save
          </button>
        </div>
      </div>
    </div>
  );
}
