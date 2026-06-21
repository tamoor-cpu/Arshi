import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import SignaturePad from './documents/SignaturePad';
import {
  Droplets, CheckCircle2, ChevronRight, ChevronLeft, FileText, ShieldCheck,
  GraduationCap, UserCircle, PenLine, Loader2, FileSignature, ExternalLink,
} from 'lucide-react';

const CATEGORY_ICON = { profile: UserCircle, paperwork: FileText, policy: ShieldCheck, training: GraduationCap, document: FileSignature };

const POLICY_TEXT = {
  handbook: 'I acknowledge that I have received, read, and understand the Employee Handbook, including attendance, conduct, and break policies. I agree to follow all company guidelines as a condition of my employment.',
  safety_policy: 'I acknowledge that I have been trained on safe chemical handling and equipment operation. I understand I must wear required PPE, never mix chemicals, and report any spill, injury, or unsafe condition to my manager immediately.',
};

const PAPERWORK_BLURB = {
  w4: 'Your W-4 determines federal income tax withholding from each paycheck. Review your filing status and sign below to submit.',
  i9: 'Form I-9 verifies your identity and authorization to work. By signing, you confirm the information you provided is accurate and complete.',
  direct_deposit: 'Set up direct deposit so your pay is deposited automatically each pay period. Sign below to authorize.',
};

export default function EmployeeOnboarding() {
  const { user, loadUser, logout } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [step, setStep] = useState(0);
  const [signature, setSignature] = useState('');
  const [ack, setAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [docSig, setDocSig] = useState(null);
  const [docFields, setDocFields] = useState({});

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get('/users/me/onboarding');
      // Real documents the owner uploaded that this new hire must sign.
      let docs = [];
      try { docs = (await api.get('/document-templates/mine/pending')).data || []; } catch { /* ignore */ }
      const docSteps = docs.map((t) => ({ id: `doc-${t.id}`, key: `doc-${t.id}`, category: 'document', title: t.name, description: t.type === 'fillable_form' ? 'Review the form, fill it in, and sign.' : 'Read the document and sign.', required: true, status: 'pending', template: t }));
      const tasks = [...(d.tasks || []), ...docSteps];

      // Nothing to do at all → finalize and pass through.
      if (tasks.length === 0) {
        await api.post('/users/me/onboarding/complete').catch(() => {});
        await loadUser();
        return;
      }
      setData({ ...d, tasks });
      const firstPending = tasks.findIndex((t) => t.status !== 'completed');
      setStep(firstPending === -1 ? tasks.length : firstPending);
    } catch {
      toast.error('Failed to load onboarding');
    }
  }, [loadUser, toast]);

  useEffect(() => { load(); }, [load]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  const tasks = data.tasks;
  const total = tasks.length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const onSummary = step >= total;
  const task = onSummary ? null : tasks[step];
  const allRequiredDone = tasks.filter((t) => t.required).every((t) => t.status === 'completed');

  const resetInputs = () => { setSignature(''); setAck(false); setDocSig(null); setDocFields({}); };

  const completeCurrent = async () => {
    setSubmitting(true);
    try {
      if (task.category === 'document') {
        // Sign the real uploaded document — generates the signed PDF into the file.
        await api.post(`/document-templates/${task.template.id}/sign`, { fieldData: docFields, signatureDataUrl: docSig });
      } else {
        await api.post(`/users/me/onboarding/${task.id}/complete`, { data: { signature, acknowledgedAt: new Date().toISOString() } });
      }
      setData((d) => ({ ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, status: 'completed' } : t) }));
      resetInputs();
      setStep((s) => s + 1);
    } catch { toast.error('Could not save this step'); }
    finally { setSubmitting(false); }
  };

  const finish = async () => {
    setFinishing(true);
    try {
      await api.post('/users/me/onboarding/complete');
      toast.success('Onboarding complete — welcome aboard!');
      await loadUser();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Complete all required steps first');
      setFinishing(false);
    }
  };

  // Whether the current step's action is allowed
  const canContinue = (() => {
    if (!task) return false;
    if (task.category === 'profile') return ack;
    if (task.category === 'paperwork') return signature.trim().length > 1;
    if (task.category === 'policy') return ack && signature.trim().length > 1;
    if (task.category === 'training') return data.requiredTrainingDone || ack;
    if (task.category === 'document') return (!task.template.requireSignature || !!docSig) && ack;
    return true;
  })();

  const Icon = task ? (CATEGORY_ICON[task.category] || FileText) : CheckCircle2;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center"><Droplets className="w-5 h-5 text-white" /></div>
          <div>
            <p className="font-bold text-gray-900 leading-none">ARSHI</p>
            <p className="text-[11px] text-brand-500">New Employee Onboarding</p>
          </div>
        </div>
        <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-xl">
          {/* Progress */}
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span className="font-semibold">Welcome, {user.firstName}! Let's get you set up.</span>
              <span>{completedCount} of {total} done</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${(completedCount / total) * 100}%` }} />
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            {onSummary ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-9 h-9 text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">You're all set!</h2>
                <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                  You've completed every onboarding step. Finish to access your ARSHI home page.
                </p>
                {!allRequiredDone && (
                  <p className="text-xs text-amber-600 mt-3">Some required steps are still pending — go back and complete them.</p>
                )}
                <button onClick={finish} disabled={!allRequiredDone || finishing}
                  className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-sm">
                  {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Finish & Enter ARSHI
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center shrink-0"><Icon className="w-6 h-6 text-brand-500" /></div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-brand-500 uppercase">Step {step + 1} of {total} · {task.category}</p>
                    <h2 className="text-lg font-bold text-gray-900">{task.title}</h2>
                  </div>
                </div>
                {task.description && <p className="text-sm text-gray-500 mb-4">{task.description}</p>}

                {/* Step body */}
                {task.category === 'profile' && (
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-xl p-4 text-sm">
                      <div className="flex justify-between py-1"><span className="text-gray-400">Name</span><span className="font-medium text-gray-800">{user.firstName} {user.lastName}</span></div>
                      <div className="flex justify-between py-1"><span className="text-gray-400">Email</span><span className="font-medium text-gray-800">{user.email}</span></div>
                      {user.position && <div className="flex justify-between py-1"><span className="text-gray-400">Position</span><span className="font-medium text-gray-800">{user.position}</span></div>}
                    </div>
                    <label className="flex items-start gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 w-4 h-4 rounded text-brand-500" />
                      I confirm my profile information above is correct.
                    </label>
                  </div>
                )}

                {task.category === 'paperwork' && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4">{PAPERWORK_BLURB[task.key] || 'Review the document and sign below to submit.'}</p>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1"><PenLine className="w-3.5 h-3.5" /> Type your full name to sign</label>
                      <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={`${user.firstName} ${user.lastName}`}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                    </div>
                  </div>
                )}

                {task.category === 'policy' && (
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 max-h-40 overflow-y-auto leading-relaxed">{POLICY_TEXT[task.key] || task.description}</div>
                    <label className="flex items-start gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 w-4 h-4 rounded text-brand-500" />
                      I have read and acknowledge this policy.
                    </label>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1"><PenLine className="w-3.5 h-3.5" /> Sign</label>
                      <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={`${user.firstName} ${user.lastName}`}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                    </div>
                  </div>
                )}

                {task.category === 'training' && (
                  <div className="space-y-3">
                    <div className={`rounded-xl p-4 text-sm flex items-center gap-2 ${data.requiredTrainingDone ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {data.requiredTrainingDone ? <CheckCircle2 className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
                      {data.requiredTrainingCount === 0
                        ? 'No required training modules are assigned right now.'
                        : data.requiredTrainingDone
                          ? 'You have completed all required training modules.'
                          : `You have ${data.requiredTrainingCount} required training module(s). You can finish onboarding now and complete them from the Training page, or acknowledge below.`}
                    </div>
                    {!data.requiredTrainingDone && data.requiredTrainingCount > 0 && (
                      <label className="flex items-start gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 w-4 h-4 rounded text-brand-500" />
                        I understand I must complete my assigned training and will do so.
                      </label>
                    )}
                  </div>
                )}

                {task.category === 'document' && (
                  <div className="space-y-3">
                    {task.template.type === 'fillable_form' ? (
                      <a href={task.template.sourceFileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 hover:border-brand-300">
                        <span className="flex items-center gap-2 text-sm font-medium text-gray-700"><FileText className="w-4 h-4 text-brand-500" /> Open the form to review</span>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </a>
                    ) : (
                      <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 max-h-44 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{task.template.content || 'No content.'}</div>
                    )}
                    {(task.template.fields || []).length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {task.template.fields.map((f) => (
                          <div key={f.key} className={f.type === 'checkbox' ? 'col-span-2' : ''}>
                            {f.type === 'checkbox' ? (
                              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={!!docFields[f.key]} onChange={(e) => setDocFields({ ...docFields, [f.key]: e.target.checked })} className="w-4 h-4 rounded text-brand-500" /> {f.label || f.key}</label>
                            ) : (
                              <>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label || f.key}</label>
                                <input type={f.type === 'date' ? 'date' : 'text'} value={docFields[f.key] || ''} onChange={(e) => setDocFields({ ...docFields, [f.key]: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {task.template.requireSignature && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1.5">Your signature</p>
                        <SignaturePad onChange={setDocSig} height={120} />
                      </div>
                    )}
                    <label className="flex items-start gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 w-4 h-4 rounded text-brand-500" />
                      I have reviewed this document and my electronic signature is legally binding.
                    </label>
                  </div>
                )}

                {/* Nav */}
                <div className="flex items-center justify-between mt-6">
                  <button onClick={() => { resetInputs(); setStep((s) => Math.max(0, s - 1)); }} disabled={step === 0}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={completeCurrent} disabled={!canContinue || submitting}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{step === total - 1 ? 'Finish steps' : 'Continue'} <ChevronRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {tasks.map((t, i) => (
              <span key={t.id} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-brand-500' : t.status === 'completed' ? 'w-1.5 bg-brand-300' : 'w-1.5 bg-gray-300'}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
