import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { ArshiMark } from '../components/branding/ArshiLogo';
import { MailCheck, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      setSent(true); // never reveal whether the email exists
    } finally {
      setLoading(false);
    }
  };

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
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4"><MailCheck className="w-6 h-6 text-brand-600" /></div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Check your email</h2>
              <p className="text-sm text-gray-500">If an account exists for <span className="font-medium text-gray-700">{email}</span>, we've sent a link to reset your password. The link expires in 1 hour.</p>
              <Link to="/login" className="inline-flex items-center gap-1.5 mt-6 text-sm font-semibold text-brand-600 hover:text-brand-700"><ArrowLeft className="w-4 h-4" /> Back to sign in</Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Forgot your password?</h2>
              <p className="text-sm text-gray-500 mb-6">Enter your email and we'll send you a link to reset it.</p>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none" placeholder="you@carwash.com" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors">
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>
              <div className="mt-6 text-center">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"><ArrowLeft className="w-4 h-4" /> Back to sign in</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
