import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { ArshiMark } from '../components/branding/ArshiLogo';
import { Eye, EyeOff, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export default function SetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [state, setState] = useState('checking'); // checking | invalid | form | done
  const [info, setInfo] = useState(null); // { type, firstName, email }
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validate = useCallback(async () => {
    if (!token) { setState('invalid'); return; }
    try {
      const { data } = await api.get('/auth/validate-token', { params: { token } });
      if (data.valid) { setInfo(data); setState('form'); }
      else setState('invalid');
    } catch { setState('invalid'); }
  }, [token]);

  useEffect(() => { validate(); }, [validate]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      await api.post('/auth/set-password', { token, password });
      setState('done');
      setTimeout(() => navigate('/login'), 2200);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set password.');
      setSubmitting(false);
    }
  };

  const isReset = info?.type === 'reset';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <ArshiMark size={44} />
            <h1 className="text-3xl font-black text-white tracking-[0.18em]">ARSHI</h1>
          </div>
          <p className="text-white/40 text-[11px] font-semibold tracking-[0.18em]">THE INTELLIGENT OPERATIONS PLATFORM</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {state === 'checking' && (
            <div className="text-center py-8 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          )}

          {state === 'invalid' && (
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4"><AlertCircle className="w-6 h-6 text-red-500" /></div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Link expired or invalid</h2>
              <p className="text-sm text-gray-500">This link has already been used or has expired. Please request a new one.</p>
              <Link to="/forgot-password" className="inline-block mt-6 text-sm font-semibold text-brand-600 hover:text-brand-700">Request a new link</Link>
            </div>
          )}

          {state === 'done' && (
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-6 h-6 text-green-500" /></div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Password set!</h2>
              <p className="text-sm text-gray-500">Taking you to sign in…</p>
            </div>
          )}

          {state === 'form' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{isReset ? 'Reset your password' : `Welcome${info?.firstName ? ', ' + info.firstName : ''}!`}</h2>
              <p className="text-sm text-gray-500 mb-6">{isReset ? 'Choose a new password for your account.' : 'Set a password to activate your ARSHI account.'}</p>

              {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none pr-10" placeholder="At least 8 characters" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                  <input type={showPass ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none" placeholder="Re-enter password" />
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full py-2.5 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />} {isReset ? 'Reset password' : 'Set password & continue'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
