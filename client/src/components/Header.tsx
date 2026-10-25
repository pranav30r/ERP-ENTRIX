import React from 'react';
import { Bell, Search, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  user?: {
    first_name: string;
    last_name: string;
    role: string;
    email: string;
  };
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {/* Search Input (Stripe style) */}
      <div className="flex items-center gap-2 max-w-md w-full">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search SKU, requisition ID, ledger entries..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Right User & Live Status Section */}
      <div className="flex items-center gap-4">
        {/* Real-time Socket Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Live Sync Active
        </div>

        {/* Notification Bell */}
        <button className="relative p-2 rounded-md hover:bg-slate-100 text-slate-600 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-600"></span>
        </button>

        <div className="h-4 w-px bg-slate-200"></div>

        {/* User Badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-semibold">
            {user ? `${user.first_name[0]}${user.last_name[0]}` : 'AD'}
          </div>
          <div className="text-left hidden md:block">
            <p className="text-xs font-semibold text-slate-800">
              {user ? `${user.first_name} ${user.last_name}` : 'Aditya Sakarkar'}
            </p>
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-indigo-600" />
              <span className="text-[10px] font-mono text-slate-500 uppercase">
                {user ? user.role : 'SUPER_ADMIN'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
