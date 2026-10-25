import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  Users,
  DollarSign,
  Activity,
  Sparkles,
  FolderKanban
} from 'lucide-react';

const navigationItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Procurement', path: '/procurement', icon: ShoppingBag, badge: 'Pipeline' },
  { name: 'Inventory Master', path: '/inventory', icon: Boxes },
  { name: 'Finance & Ledger', path: '/finance', icon: DollarSign },
  { name: 'Human Resources', path: '/hr', icon: Users },
  { name: 'Project Milestones', path: '/projects', icon: FolderKanban },
  { name: 'AI Decision Suite', path: '/ai-insights', icon: Sparkles, badge: 'ML' },
  { name: 'Audit Logs', path: '/audit', icon: Activity }
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-charcoal-900 border-r border-charcoal-800 flex flex-col justify-between text-slate-300 select-none">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-charcoal-800/80 gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-indigo-500/30">
            E
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white uppercase">ENTRIX</h1>
            <p className="text-[11px] text-slate-400 font-mono">ERP PLATFORM</p>
          </div>
        </div>

        {/* Section Label */}
        <div className="px-6 pt-5 pb-2">
          <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase font-mono">
            Workspaces
          </span>
        </div>

        {/* Nav Items */}
        <nav className="px-3 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) => `
                  group flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all duration-150
                  ${isActive
                    ? 'bg-charcoal-800 text-white font-semibold shadow-inner border border-charcoal-700/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-charcoal-850'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-charcoal-700 text-slate-300 font-mono">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer / System Status */}
      <div className="p-4 border-t border-charcoal-800/80">
        <div className="p-3 bg-charcoal-850 rounded-lg border border-charcoal-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] text-slate-300">Core Services</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
};
