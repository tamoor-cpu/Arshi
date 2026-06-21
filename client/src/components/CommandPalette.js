import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Search, X, Wrench, Package, UserCircle, Brain, ShieldAlert,
  GraduationCap, Truck, Users, LayoutDashboard, Clock,
  ClipboardCheck, MessageSquare, Settings, TrendingUp, Command,
} from 'lucide-react';

const TYPE_ICONS = {
  equipment: Wrench,
  inventory: Package,
  customer: UserCircle,
  task: Brain,
  claim: ShieldAlert,
  training: GraduationCap,
  supplier: Truck,
  team: Users,
  page: LayoutDashboard,
};

const TYPE_COLORS = {
  equipment: 'bg-orange-100 text-orange-600',
  inventory: 'bg-blue-100 text-blue-600',
  customer: 'bg-purple-100 text-purple-600',
  task: 'bg-indigo-100 text-indigo-600',
  claim: 'bg-red-100 text-red-600',
  training: 'bg-green-100 text-green-600',
  supplier: 'bg-cyan-100 text-cyan-600',
  team: 'bg-pink-100 text-pink-600',
  page: 'bg-gray-100 text-gray-600',
};

// Static page navigation shortcuts
const PAGES = [
  { type: 'page', id: 'dash', title: 'Dashboard', subtitle: 'Overview & stats', path: '/', icon: LayoutDashboard },
  { type: 'page', id: 'shifts', title: 'Shifts', subtitle: 'Schedule management', path: '/shifts', icon: Clock },
  { type: 'page', id: 'checks', title: 'Checklists', subtitle: 'SOPs & inspections', path: '/checklists', icon: ClipboardCheck },
  { type: 'page', id: 'equip', title: 'Equipment', subtitle: 'Equipment & maintenance', path: '/equipment', icon: Wrench },
  { type: 'page', id: 'inv', title: 'Inventory', subtitle: 'Stock & chemicals', path: '/inventory', icon: Package },
  { type: 'page', id: 'tasks', title: 'Tasks', subtitle: 'AI task quarterback', path: '/tasks', icon: Brain },
  { type: 'page', id: 'claims', title: 'Claims', subtitle: 'Damage claims', path: '/claims', icon: ShieldAlert },
  { type: 'page', id: 'cust', title: 'Customers', subtitle: 'Customer management', path: '/customers', icon: UserCircle },
  { type: 'page', id: 'train', title: 'Training', subtitle: 'Training modules', path: '/training', icon: GraduationCap },
  { type: 'page', id: 'supp', title: 'Suppliers', subtitle: 'Supplier directory', path: '/suppliers', icon: Truck },
  { type: 'page', id: 'anal', title: 'Analytics', subtitle: 'Reports & charts', path: '/analytics', icon: TrendingUp },
  { type: 'page', id: 'chat', title: 'Chat', subtitle: 'Team communication', path: '/chat', icon: MessageSquare },
  { type: 'page', id: 'team', title: 'Team', subtitle: 'Team members', path: '/team', icon: Users },
  { type: 'page', id: 'settings', title: 'Settings', subtitle: 'Configuration', path: '/settings', icon: Settings },
];

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Open with Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Search with debounce
  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/search', { params: { q } });
      setResults(data.results || []);
      setSelectedIndex(0);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  // Filter pages by query
  const filteredPages = query
    ? PAGES.filter((p) =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.subtitle.toLowerCase().includes(query.toLowerCase())
      )
    : PAGES;

  // Combine: pages first, then search results
  const allItems = query.length >= 2 ? [...filteredPages, ...results] : filteredPages;

  const handleSelect = (item) => {
    setOpen(false);
    navigate(item.path);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && allItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(allItems[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Palette */}
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400 text-gray-900 dark:text-white"
            placeholder="Search anything... equipment, customers, tasks..."
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-400 text-[10px] font-mono rounded border border-gray-200 dark:border-gray-600">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {allItems.length === 0 && query.length >= 2 && !loading && (
            <div className="px-4 py-8 text-center">
              <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No results for "{query}"</p>
            </div>
          )}

          {/* Pages section */}
          {filteredPages.length > 0 && (
            <>
              <div className="px-4 py-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  {query ? 'Pages' : 'Quick Navigation'}
                </p>
              </div>
              {filteredPages.map((item, idx) => {
                const Icon = item.icon || TYPE_ICONS[item.type] || Search;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={`page-${item.id}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${TYPE_COLORS[item.type] || 'bg-gray-100 text-gray-500'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300 font-semibold' : 'text-gray-900 dark:text-gray-100 font-medium'}`}>
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.subtitle}</p>
                    </div>
                    {isSelected && (
                      <span className="text-xs text-blue-500 font-medium">Enter ↵</span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          {/* Search results */}
          {results.length > 0 && (
            <>
              <div className="px-4 py-1 mt-1 border-t border-gray-100 dark:border-gray-700">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pt-1">
                  Search Results
                </p>
              </div>
              {results.map((item, i) => {
                const idx = filteredPages.length + i;
                const Icon = TYPE_ICONS[item.type] || Search;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${TYPE_COLORS[item.type] || 'bg-gray-100 text-gray-500'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300 font-semibold' : 'text-gray-900 dark:text-gray-100 font-medium'}`}>
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.subtitle}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[item.type] || 'bg-gray-100 text-gray-500'}`}>
                      {item.type}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-[10px] text-gray-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[9px] font-mono">↑↓</kbd> Navigate</span>
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[9px] font-mono">↵</kbd> Select</span>
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[9px] font-mono">ESC</kbd> Close</span>
          </div>
          <span className="flex items-center gap-1"><Command className="w-3 h-3" />K</span>
        </div>
      </div>
    </div>
  );
}
