import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import NotificationCenter from '../NotificationCenter';
import CommandPalette from '../CommandPalette';
import PWAInstallPrompt from '../common/PWAInstallPrompt';
import { ArshiLogo, ArshiMark } from '../branding/ArshiLogo';
import {
  Clock, ClipboardCheck, ClipboardList, MessageSquare, Users, Settings, LogOut, Menu, X,
  MapPin, ChevronDown, Wrench, Package, ShieldAlert, GraduationCap, Search, Moon, Sun,
  FileBarChart, Sparkles, FlaskConical, Star, Gauge, ShoppingCart, CalendarDays,
  Droplets, Settings2, LayoutDashboard, CreditCard, BookOpen,
} from 'lucide-react';

const SECTIONS = [
  {
    title: 'Operations',
    items: [
      { path: '/tasks', icon: ClipboardList, label: 'To-Do' },
      { path: '/work-orders', icon: Wrench, label: 'Work Orders' },
      { path: '/equipment', icon: Settings2, label: 'Equipment' },
      { path: '/chemicals', icon: Droplets, label: 'Chemicals' },
      { path: '/inventory', icon: Package, label: 'Inventory' },
      { path: '/orders', icon: ShoppingCart, label: 'Orders' },
      { path: '/checklists', icon: ClipboardCheck, label: 'Inspections' },
      { path: '/gauges', icon: Gauge, label: 'Gauges' },
      { path: '/reviews', icon: Star, label: 'Reviews' },
      { path: '/claims', icon: ShieldAlert, label: 'Complaints' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { path: '/learning', icon: GraduationCap, label: 'Training & SOPs' },
      { path: '/documents', icon: BookOpen, label: 'Handbook & Policies' },
      { path: '/sds', icon: FlaskConical, label: 'SDS Library' },
    ],
  },
  {
    title: 'Team',
    items: [
      { path: '/shifts', icon: Clock, label: 'Time Clock' },
      { path: '/schedule', icon: CalendarDays, label: 'Schedule' },
      { path: '/team', icon: Users, label: 'Directory' },
      { path: '/reports', icon: FileBarChart, label: 'Reports', managerOnly: true },
    ],
  },
];

export default function Layout({ children }) {
  const { user, currentLocation, locations, switchLocation, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [locationDropdown, setLocationDropdown] = useState(false);

  const canSee = (item) => {
    if (item.adminOnly && !['SUPER_ADMIN', 'REGIONAL_ADMIN'].includes(user?.role)) return false;
    if (item.managerOnly && !['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user?.role)) return false;
    return true;
  };
  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  const homeActive = location.pathname === '/';
  const handleLogout = () => { logout(); navigate('/login'); };
  const close = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <CommandPalette />
      {sidebarOpen && <div className="fixed inset-0 bg-slate-900/40 z-20 lg:hidden" onClick={close} />}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-[270px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 py-4">
          <Link to="/" onClick={close}><ArshiLogo markSize={36} /></Link>
          <button onClick={close} className="lg:hidden ml-auto p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-2">
          {/* Location */}
          {currentLocation && (
            <div className="px-1 mb-3">
              <div className="relative">
                <button onClick={() => setLocationDropdown(!locationDropdown)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-brand-300 transition-colors text-left">
                  <MapPin className="w-4 h-4 text-brand-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">{currentLocation.name}</p>
                    {currentLocation.address && <p className="text-[11px] text-gray-400 truncate">{currentLocation.address}</p>}
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                </button>
                {locationDropdown && locations.length > 1 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-10 py-1">
                    {locations.map((loc) => (
                      <button key={loc.id} onClick={() => { switchLocation(loc); setLocationDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${loc.id === currentLocation.id ? 'text-brand-600 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}>
                        {loc.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Search */}
          <button onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="w-full flex items-center gap-2 px-3 py-2 mb-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl transition-colors text-sm text-gray-400">
            <Search className="w-4 h-4" /> <span>Ask ARSHI</span>
            <kbd className="ml-auto text-[10px] bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl+'}K</kbd>
          </button>

          {/* Home */}
          <Link to="/" onClick={close}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors ${homeActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'}`}>
            <LayoutDashboard className={`w-4 h-4 ${homeActive ? 'text-brand-500' : ''}`} /> Home
          </Link>

          {/* Sections */}
          <nav className="mt-4 space-y-1">
            {SECTIONS.map((section) => {
              const items = section.items.filter(canSee);
              if (!items.length) return null;
              return (
                <div key={section.title} className="pt-4 mt-1 border-t border-gray-200 dark:border-gray-800/80 first:border-t-0 first:pt-0 first:mt-0">
                  <p className="px-3 mb-2 text-[11px] font-bold tracking-[0.14em] text-brand-600 dark:text-brand-400 uppercase">{section.title}</p>
                  <div className="space-y-0.5">
                    {items.map(({ path, icon: Icon, label }) => (
                      <Link key={path + label} to={path} onClick={close}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive(path)
                            ? 'bg-brand-50 text-brand-700 font-semibold dark:bg-brand-500/10 dark:text-brand-300'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                        }`}>
                        <Icon className={`w-4 h-4 shrink-0 ${isActive(path) ? 'text-brand-500' : ''}`} />
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* quick links */}
            <div className="pt-4 mt-1 border-t border-gray-200 dark:border-gray-800/80">
              <p className="px-3 mb-2 text-[11px] font-bold tracking-[0.14em] text-brand-600 dark:text-brand-400 uppercase">Quick</p>
              <div className="space-y-0.5">
                <Link to="/ai-insights" onClick={close} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive('/ai-insights') ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'}`}><Sparkles className="w-4 h-4" /> AI Coach</Link>
                <Link to="/chat" onClick={close} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive('/chat') ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'}`}><MessageSquare className="w-4 h-4" /> Chat</Link>
              </div>
            </div>
          </nav>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-800 px-3 py-3 space-y-0.5">
          <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-xs font-bold text-white">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.role?.replace('_', ' ')}</p>
            </div>
            <button onClick={toggleDarkMode} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" title={darkMode ? 'Light mode' : 'Dark mode'}>{darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-gray-400" />}</button>
            <NotificationCenter />
          </div>
          <Link to="/settings" onClick={close} className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"><CreditCard className="w-4 h-4" /> Manage Subscription</Link>
          <Link to="/settings" onClick={close} className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"><BookOpen className="w-4 h-4" /> Knowledge Center</Link>
          <button onClick={handleLogout} className="flex items-center gap-2.5 w-full px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"><LogOut className="w-4 h-4" /> Sign Out</button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><Menu className="w-5 h-5 dark:text-gray-300" /></button>
          <ArshiMark size={28} />
          <span className="font-bold tracking-[0.14em] text-gray-900 dark:text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>ARSHI</span>
          {currentLocation && <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{currentLocation.name}</span>}
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      <PWAInstallPrompt />
    </div>
  );
}
