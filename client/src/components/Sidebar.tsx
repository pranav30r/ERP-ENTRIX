import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  Users,
  DollarSign,
  Activity,
  Sparkles,
  FolderKanban,
  Lock,
  Building2,
  CreditCard,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNav } from '../context/NavContext';
import { prefetchRoute } from '../lib/routePrefetch';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  requiredRoles?: string[];
}

const navigationItems: NavItem[] = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Procurement', path: '/procurement', icon: ShoppingBag },
  { name: 'Inventory Master', path: '/inventory', icon: Boxes },
  { name: 'Finance & Ledger', path: '/finance', icon: DollarSign, requiredRoles: ['SUPER_ADMIN', 'FINANCE_OFFICER'] },
  { name: 'Human Resources', path: '/hr', icon: Users, requiredRoles: ['SUPER_ADMIN', 'HR_MANAGER'] },
  { name: 'Project Milestones', path: '/projects', icon: FolderKanban, requiredRoles: ['SUPER_ADMIN', 'HR_MANAGER', 'FINANCE_OFFICER', 'PROCUREMENT_OFFICER'] },
  { name: 'AI Decision Suite', path: '/ai-insights', icon: Sparkles, requiredRoles: ['SUPER_ADMIN', 'PROCUREMENT_OFFICER', 'FINANCE_OFFICER'] },
  { name: 'Audit Logs', path: '/audit', icon: Activity, requiredRoles: ['SUPER_ADMIN', 'FINANCE_OFFICER', 'HR_MANAGER'] },
  { name: 'Organization', path: '/settings/company', icon: Building2 },
  { name: 'Plans & Billing', path: '/settings/billing', icon: CreditCard }
];

export const Sidebar: React.FC = () => {
  const { hasRole } = useAuth();
  const { mobileOpen, setMobileOpen } = useNav();
  const location = useLocation();

  // Close mobile sidebar on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, setMobileOpen]);

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand Header */}
        <div className="h-14 lg:h-16 flex items-center justify-between px-6 border-b border-charcoal-800/80">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-sm shadow-indigo-500/30">
              E
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide text-white uppercase">ENTRIX</h1>
              <p className="text-xs text-slate-400 font-mono">ERP PLATFORM</p>
            </div>
          </div>
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation sidebar"
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-charcoal-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Section Label */}
        <div className="px-6 pt-6 pb-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase font-mono">
            Workspaces
          </span>
        </div>

        {/* Nav Items */}
        <nav aria-label="Main Navigation" className="px-3.5 space-y-1.5">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isAuthorized = !item.requiredRoles || hasRole(item.requiredRoles);
            const isActive = location.pathname === item.path;

            return (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                onMouseEnter={() => prefetchRoute(item.path)}
                onFocus={() => prefetchRoute(item.path)}
                aria-current={isActive ? 'page' : undefined}
                className={({ isActive: linkActive }) => `
                  group flex items-center justify-between px-3.5 h-11 rounded-lg text-sm xl:text-[15px] font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                  ${linkActive
                    ? 'bg-charcoal-800 text-white font-semibold shadow-inner border border-charcoal-700/60'
                    : isAuthorized
                      ? 'text-slate-300 hover:text-white hover:bg-charcoal-850'
                      : 'text-slate-500 hover:text-slate-400 hover:bg-charcoal-850/50 opacity-70'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 transition-colors shrink-0 ${
                    isAuthorized ? 'text-slate-400 group-hover:text-indigo-400' : 'text-slate-600'
                  }`} aria-hidden="true" />
                  <span className="truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {!isAuthorized && (
                    <span title={`Requires ${item.requiredRoles?.join(' or ')}`}>
                      <Lock className="w-4 h-4 text-slate-500" aria-label="Role restricted" />
                    </span>
                  )}
                </div>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Padding */}
      <div className="p-4" />
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (w-64 on 1280px, w-72 on desktop, w-80 on wide screen) */}
      <aside className="hidden lg:flex w-[260px] xl:w-[280px] bg-charcoal-900 border-r border-charcoal-800 flex-col justify-between text-slate-300 select-none shrink-0 transition-all">
        {sidebarContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation drawer"
            className="relative flex flex-col w-[280px] max-w-[85vw] bg-charcoal-900 text-slate-300 shadow-xl z-50 select-none"
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
