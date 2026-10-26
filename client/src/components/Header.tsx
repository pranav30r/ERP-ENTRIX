import React, { useState, useEffect } from 'react';
import { Bell, Search, ChevronDown, Loader2, Menu } from 'lucide-react';
import { getSocket } from '../services/socket';
import { useAuth, DEMO_PERSONAS } from '../context/AuthContext';
import { useNav } from '../context/NavContext';

export const Header: React.FC = () => {
  const { user, role, switchRole, loading: authLoading } = useAuth();
  const { toggleMobile } = useNav();
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
      setNotifications((prev) => [data.message || `Requisition ${data.pr?.pr_code} created`, ...prev.slice(0, 9)]);
    };

    const handlePRStatus = (data: any) => {
      setNotifications((prev) => [data.message || `Requisition ${data.pr?.pr_code} updated`, ...prev.slice(0, 9)]);
    };

    const handleGRN = (data: any) => {
      setNotifications((prev) => [data.message || `Goods received & inventory updated`, ...prev.slice(0, 9)]);
    };

    const handleInv = (data: any) => {
      setNotifications((prev) => [`Stock updated for SKU ${data.sku_code}: ${data.stock_qty} units`, ...prev.slice(0, 9)]);
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
      window.location.reload();
    } catch {
      alert('Failed to switch persona.');
    } finally {
      setSwitching(false);
    }
  };

  const getRoleBadgeColor = (r: string) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'FINANCE_OFFICER':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'HR_MANAGER':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PROCUREMENT_OFFICER':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <header className="h-[68px] lg:h-[72px] bg-white border-b border-slate-200 px-6 sm:px-8 xl:px-10 flex items-center justify-between sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {/* Left: Mobile hamburger & Search Input */}
      <div className="flex items-center gap-3.5 max-w-lg w-full">
        {/* Mobile menu toggle */}
        <button
          onClick={toggleMobile}
          aria-label="Open mobile navigation menu"
          className="lg:hidden p-2.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Menu className="w-6 h-6" aria-hidden="true" />
        </button>

        <div className="relative w-full">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search workspace entities"
            placeholder="Search SKU, requisition ID, ledger entries..."
            className="w-full h-11 pl-11 pr-4 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Right User & Live Status Section */}
      <div className="flex items-center gap-3 sm:gap-5">
        {/* Real-time Socket Indicator */}
        <div
          role="status"
          aria-label={isConnected ? 'Live WebSocket telemetry active' : 'Telemetry polling active'}
          className={`hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-colors ${
            isConnected
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} aria-hidden="true" />
          <span className="font-mono text-xs">{isConnected ? 'Live Telemetry' : 'Telemetry Polling'}</span>
        </div>

        {/* Real-time Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label={`Real-time events (${notifications.length} notifications)`}
            aria-expanded={showNotifications}
            className="relative p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
            {notifications.length > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-indigo-600 rounded-full ring-2 ring-white" aria-hidden="true" />
            )}
          </button>

          {showNotifications && (
            <div
              role="region"
              aria-label="Recent notifications"
              className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-30 text-sm"
            >
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between font-semibold text-slate-700">
                <span>Socket.io Live Events</span>
                <span className="text-xs text-slate-400 font-mono">{notifications.length} recent</span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-slate-400 text-sm">
                    No new event transmissions received.
                  </div>
                ) : (
                  notifications.map((msg, idx) => (
                    <div key={idx} className="px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-start gap-2 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" aria-hidden="true" />
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
            aria-label={`Current persona: ${user ? `${user.first_name} ${user.last_name}` : 'Admin'} (${role}). Click to switch persona.`}
            aria-expanded={showRoleSwitcher}
            disabled={switching || authLoading}
            className="flex items-center gap-3 pl-3.5 pr-2.5 py-1.5 min-h-[44px] rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 transition-all text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
              {switching ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-label="Switching" />
              ) : (
                user ? `${user.first_name?.[0] || 'A'}${user.last_name?.[0] || ''}` : 'A'
              )}
            </div>
            <div className="hidden md:block">
              <div className="text-sm font-semibold text-slate-800 leading-tight">
                {user ? `${user.first_name} ${user.last_name}` : 'Aditya Admin'}
              </div>
              <div className="text-xs font-mono text-slate-400 leading-tight mt-0.5">
                {role}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 ml-1" aria-hidden="true" />
          </button>

          {showRoleSwitcher && (
            <div
              role="menu"
              aria-label="Demo persona switcher"
              className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-30 divide-y divide-slate-100"
            >
              <div className="px-4 py-2 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-500">Switch Demo Persona</span>
                  <span className="text-[10px] text-indigo-600 font-medium">RBAC Simulator</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Switch role to test live security and permission bounds</p>
              </div>

              <div className="py-1">
                {DEMO_PERSONAS.map((p) => {
                  const isCurrent = user?.email === p.email;
                  return (
                    <button
                      key={p.email}
                      role="menuitem"
                      onClick={() => handleRoleSelect(p.email)}
                      disabled={switching}
                      className={`w-full px-4 py-2.5 text-left flex items-start justify-between hover:bg-slate-50 transition-colors ${
                        isCurrent ? 'bg-indigo-50/60 font-semibold' : ''
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold text-slate-800">{p.name}</div>
                        <div className="text-[11px] text-slate-500">{p.department}</div>
                        <div className="text-[10px] font-mono text-slate-400">{p.email}</div>
                      </div>
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getRoleBadgeColor(p.role)}`}>
                        {p.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
