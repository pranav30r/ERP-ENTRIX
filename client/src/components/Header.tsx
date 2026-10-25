import React, { useState, useEffect } from 'react';
import { Bell, Search, ShieldCheck, ChevronDown, Check, Loader2 } from 'lucide-react';
import { getSocket } from '../services/socket';
import { useAuth, DEMO_PERSONAS } from '../context/AuthContext';

export const Header: React.FC = () => {
  const { user, role, switchRole, loading: authLoading } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    const handlePRCreated = (data: any) => {
      setNotifications(prev => [data.message || `Requisition ${data.pr?.pr_code} created`, ...prev.slice(0, 9)]);
    };

    const handlePRStatus = (data: any) => {
      setNotifications(prev => [data.message || `Requisition ${data.pr?.pr_code} updated`, ...prev.slice(0, 9)]);
    };

    const handleGRN = (data: any) => {
      setNotifications(prev => [data.message || `Goods received & inventory updated`, ...prev.slice(0, 9)]);
    };

    const handleInv = (data: any) => {
      setNotifications(prev => [`Stock updated for SKU ${data.sku_code}: ${data.stock_qty} units`, ...prev.slice(0, 9)]);
    };

    if (socket.connected) {
      setIsConnected(true);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('pr_created', handlePRCreated);
    socket.on('pr_status_changed', handlePRStatus);
    socket.on('grn_received', handleGRN);
    socket.on('inventory_updated', handleInv);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('pr_created', handlePRCreated);
      socket.off('pr_status_changed', handlePRStatus);
      socket.off('grn_received', handleGRN);
      socket.off('inventory_updated', handleInv);
    };
  }, []);

  const handleRoleSelect = async (roleEmail: string) => {
    if (user?.email === roleEmail) {
      setShowRoleSwitcher(false);
      return;
    }
    setSwitching(true);
    try {
      await switchRole(roleEmail);
      setShowRoleSwitcher(false);
      // Brief timeout to ensure views reload their queries cleanly
      window.location.reload();
    } catch (err) {
      alert('Failed to switch persona.');
    } finally {
      setSwitching(false);
    }
  };

  const getRoleBadgeColor = (r: string) => {
    switch (r) {
      case 'SUPER_ADMIN': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'FINANCE_OFFICER': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'HR_MANAGER': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PROCUREMENT_OFFICER': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
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
        <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
          isConnected 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="font-mono text-[11px]">{isConnected ? 'Live Telemetry' : 'Telemetry Polling'}</span>
        </div>

        {/* Real-time Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200"
            title="Real-time Event Stream"
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-600 rounded-full ring-2 ring-white"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-30 text-xs">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between font-semibold text-slate-700">
                <span>Socket.io Live Events</span>
                <span className="text-[10px] text-slate-400 font-mono">{notifications.length} recent</span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-slate-400 text-xs">
                    No new event transmissions received.
                  </div>
                ) : (
                  notifications.map((msg, idx) => (
                    <div key={idx} className="px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                      <span className="text-slate-700 leading-relaxed">{msg}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Interactive RBAC Persona Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
            disabled={switching || authLoading}
            className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 transition-all text-left"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
              {switching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                user ? `${user.first_name?.[0] || 'A'}${user.last_name?.[0] || ''}` : 'A'
              )}
            </div>
            <div className="hidden md:block">
              <div className="text-xs font-semibold text-slate-800 leading-tight">
                {user ? `${user.first_name} ${user.last_name}` : 'Aditya Admin'}
              </div>
              <div className="text-[10px] font-mono text-slate-400 leading-tight">
                {role}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>

          {showRoleSwitcher && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-30 divide-y divide-slate-100">
              <div className="px-4 py-2 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-500">Switch Demo Persona</span>
                  <span className="text-[10px] text-indigo-600 font-medium">RBAC Simulator</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Switch role to test live security and permission bounds</p>
              </div>

              <div className="py-1">
                {DEMO_PERSONAS.map((persona) => {
                  const isCurrent = user?.email === persona.email;
                  return (
                    <button
                      key={persona.email}
                      onClick={() => handleRoleSelect(persona.email)}
                      disabled={switching}
                      className={`w-full px-4 py-2 text-left hover:bg-slate-50 transition-colors flex items-start justify-between gap-3 ${
                        isCurrent ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-800">{persona.name}</span>
                          <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded border ${getRoleBadgeColor(persona.role)}`}>
                            {persona.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">{persona.desc}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{persona.department}</div>
                      </div>
                      {isCurrent && (
                        <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="px-4 py-2 text-[10px] text-slate-400 bg-slate-50 flex items-center justify-between font-mono">
                <span>Default Password: Admin@123</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Zero-Cost Active
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
