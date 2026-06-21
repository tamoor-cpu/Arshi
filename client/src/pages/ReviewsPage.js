import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { Star, Plus, X, MessageSquare, Trash2, Reply } from 'lucide-react';

const sourceBadge = {
  google: 'bg-blue-100 text-blue-700', yelp: 'bg-red-100 text-red-700', internal: 'bg-gray-100 text-gray-600',
};

function Stars({ value, size = 'w-4 h-4', onChange }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type={onChange ? 'button' : undefined} disabled={!onChange} onClick={onChange ? () => onChange(n) : undefined}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}>
          <Star className={`${size} ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const { currentLocation, user } = useAuth();
  const toast = useToast();
  const [reviews, setReviews] = useState([]);
  const [filter, setFilter] = useState('all'); // all | needsReply
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ customerName: '', rating: 5, comment: '', source: 'google' });
  const [replyFor, setReplyFor] = useState(null);
  const [replyText, setReplyText] = useState('');

  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user.role);

  const fetchReviews = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const { data } = await api.get(`/locations/${currentLocation.id}/reviews`);
      setReviews(data);
    } catch { toast.error('Failed to load reviews'); }
  }, [currentLocation, toast]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const addReview = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/locations/${currentLocation.id}/reviews`, form);
      setShowAdd(false); setForm({ customerName: '', rating: 5, comment: '', source: 'google' });
      fetchReviews(); toast.success('Review added');
    } catch { toast.error('Failed to add review'); }
  };

  const sendReply = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/locations/${currentLocation.id}/reviews/${replyFor.id}/reply`, { replyText });
      setReplyFor(null); setReplyText(''); fetchReviews(); toast.success('Reply saved');
    } catch { toast.error('Failed to save reply'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this review?')) return;
    try { await api.delete(`/locations/${currentLocation.id}/reviews/${id}`); fetchReviews(); toast.success('Deleted'); }
    catch { toast.error('Failed to delete'); }
  };

  if (!currentLocation) return null;

  const weekAgo = Date.now() - 7 * 86400000;
  const monthAgo = Date.now() - 30 * 86400000;
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—';
  const thisWeek = reviews.filter((r) => new Date(r.reviewedAt).getTime() >= weekAgo).length;
  const needsReply = reviews.filter((r) => !r.replied).length;
  const last30 = reviews.filter((r) => new Date(r.reviewedAt).getTime() >= monthAgo).length;

  const visible = filter === 'needsReply' ? reviews.filter((r) => !r.replied) : reviews;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-brand-500">OPERATIONS</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <Star className="w-6 h-6 text-brand-500" /> Reviews
          </h1>
          <p className="text-sm text-gray-500 mt-1">Monitor guest ratings and respond at {currentLocation.name}</p>
        </div>
        {isManager && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg shadow-sm">
            <Plus className="w-4 h-4" /> Add Review
          </button>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Avg Rating', value: avg, dot: 'bg-amber-400' },
          { label: 'This Week', value: thisWeek, dot: 'bg-blue-400' },
          { label: 'Needs Reply', value: needsReply, dot: 'bg-red-400' },
          { label: '30-Day Total', value: last30, dot: 'bg-green-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">{s.label}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1.5 mb-4">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${filter === 'all' ? 'bg-brand-50 text-brand-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>All Reviews</button>
        <button onClick={() => setFilter('needsReply')} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${filter === 'needsReply' ? 'bg-brand-50 text-brand-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Needs Reply</button>
      </div>

      {/* Reviews list */}
      <div className="space-y-3">
        {visible.map((r) => (
          <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Stars value={r.rating} />
                  <span className="text-sm font-semibold text-gray-900">{r.customerName || 'Anonymous guest'}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${sourceBadge[r.source] || sourceBadge.internal}`}>{r.source}</span>
                  {!r.replied && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-600">Needs reply</span>}
                </div>
                {r.comment && <p className="text-sm text-gray-600 mt-2">{r.comment}</p>}
                <p className="text-[11px] text-gray-400 mt-1.5">{new Date(r.reviewedAt).toLocaleDateString()}</p>
                {r.replied && r.replyText && (
                  <div className="mt-3 pl-3 border-l-2 border-brand-200 bg-brand-50/40 rounded-r-lg py-2 pr-3">
                    <p className="text-[11px] font-semibold text-brand-600 flex items-center gap-1"><Reply className="w-3 h-3" /> Owner response{r.repliedBy ? ` · ${r.repliedBy.firstName}` : ''}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{r.replyText}</p>
                  </div>
                )}
              </div>
              {isManager && (
                <div className="flex items-center gap-1 shrink-0">
                  {!r.replied && (
                    <button onClick={() => { setReplyFor(r); setReplyText(''); }} className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-50 text-brand-700 text-xs font-semibold rounded-lg hover:bg-brand-100"><Reply className="w-3.5 h-3.5" /> Reply</button>
                  )}
                  <button onClick={() => remove(r.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl py-14 text-center">
            <Star className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600">No reviews yet</p>
            <p className="text-xs text-gray-400 mt-1">Connect your Google Business profile or log guest reviews to track them here.</p>
          </div>
        )}
      </div>

      {/* Add review modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Add Review</h3>
              <button onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={addReview} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Rating</label>
                <Stars value={form.rating} size="w-7 h-7" onChange={(n) => setForm({ ...form, rating: n })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Customer Name</label>
                  <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Source</label>
                  <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                    <option value="google">Google</option><option value="yelp">Yelp</option><option value="internal">Internal</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Comment</label>
                <textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg">Add Review</button>
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reply modal */}
      {replyFor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setReplyFor(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Reply to {replyFor.customerName || 'guest'}</h3>
              <button onClick={() => setReplyFor(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={sendReply} className="p-5 space-y-4">
              <div className="flex items-center gap-2"><Stars value={replyFor.rating} /></div>
              {replyFor.comment && <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">{replyFor.comment}</p>}
              <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={4} required autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="Thanks for your feedback…" />
              <div className="flex gap-2">
                <button type="submit" className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg"><MessageSquare className="w-4 h-4" /> Post Reply</button>
                <button type="button" onClick={() => setReplyFor(null)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
