import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
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

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  requiredRoles?: string[];
}

const navigationItems: NavItem[] = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Procurement', path: '/procurement', icon: ShoppingBag, badge: 'Pipeline' },
  { name: 'Inventory Master', path: '/inventory', icon: Boxes },
  { name: 'Finance & Ledger', path: '/finance', icon: DollarSign, requiredRoles: ['SUPER_ADMIN', 'FINANCE_OFFICER'] },
  { name: 'Human Resources', path: '/hr', icon: Users, requiredRoles: ['SUPER_ADMIN', 'HR_MANAGER'] },
  { name: 'Project Milestones', path: '/projects', icon: FolderKanban, requiredRoles: ['SUPER_ADMIN', 'HR_MANAGER', 'FINANCE_OFFICER', 'PROCUREMENT_OFFICER'] },
  { name: 'AI Decision Suite', path: '/ai-insights', icon: Sparkles, badge: 'ML', requiredRoles: ['SUPER_ADMIN', 'PROCUREMENT_OFFICER', 'FINANCE_OFFICER'] },
  { name: 'Audit Logs', path: '/audit', icon: Activity, requiredRoles: ['SUPER_ADMIN', 'FINANCE_OFFICER', 'HR_MANAGER'] },
  { name: 'Organization', path: '/settings/company', icon: Building2 },
  { name: 'Plans & Billing', path: '/settings/billing', icon: CreditCard, badge: 'SaaS' }
];

export const Sidebar: React.FC = () => {
  const { role, hasRole, user } = useAuth();
  const { mobileOpen, setMobileOpen } = useNav();

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
        <div className="h-16 flex items-center justify-between px-6 border-b border-charcoal-800/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-indigo-500/30">
              E
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-wide text-white uppercase">ENTRIX</h1>
              <p className="text-[11px] text-slate-400 font-mono">ERP PLATFORM</p>
            </div>
          </div>
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation sidebar"
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-charcoal-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Section Label */}
        <div className="px-6 pt-5 pb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase font-mono">
            Workspaces
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-charcoal-800 text-indigo-400 border border-charcoal-700">
            RBAC
          </span>
        </div>

        {/* Nav Items */}
        <nav aria-label="Main Navigation" className="px-3 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isAuthorized = !item.requiredRoles || hasRole(item.requiredRoles);

            return (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `
                  group flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                  ${isActive
                    ? 'bg-charcoal-800 text-white font-semibold shadow-inner border border-charcoal-700/50'
                    : isAuthorized
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-charcoal-850'
                      : 'text-slate-500 hover:text-slate-400 hover:bg-charcoal-850/50 opacity-70'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${
                    isAuthorized ? 'text-slate-400 group-hover:text-indigo-400' : 'text-slate-600'
                  }`} aria-hidden="true" />
                  <span>{item.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {!isAuthorized && (
                    <span title={`Requires ${item.requiredRoles?.join(' or ')}`}>
                      <Lock className="w-3 h-3 text-slate-500" aria-label="Role restricted" />
                    </span>
                  )}
                  {item.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-charcoal-700 text-slate-300 font-mono">
                      {item.badge}
                    </span>
                  )}
                </div>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer / Active Role Indicator */}
      <div className="p-4 border-t border-charcoal-800/80 space-y-2">
        <div className="p-3 bg-charcoal-850 rounded-lg border border-charcoal-800 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-mono text-slate-400">Current Role</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="text-[11px] font-bold text-white font-mono truncate">
            {role}
          </div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5">
            {user?.email || 'admin@entrix.local'}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 bg-charcoal-900 border-r border-charcoal-800 flex-col justify-between text-slate-300 select-none shrink-0">
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
            className="relative flex flex-col w-64 max-w-[80vw] bg-charcoal-900 text-slate-300 shadow-xl z-50 select-none"
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
