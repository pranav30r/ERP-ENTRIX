import React, { useState, useEffect } from 'react';
import { Bell, Search, ShieldCheck, ChevronDown, UserCheck } from 'lucide-react';
import { getSocket } from '../services/socket';
import { getCurrentUser, loginAsUser } from '../services/api';

const demoRoles = [
  { name: 'Aditya Admin', email: 'admin@entrix.local', role: 'SUPER_ADMIN', desc: 'Full System Control' },
  { name: 'Sarah Jenkins', email: 'hr@entrix.local', role: 'HR_MANAGER', desc: 'Personnel & Attendance' },
  { name: 'Rajesh Menon', email: 'finance@entrix.local', role: 'FINANCE_OFFICER', desc: 'Ledger & PR Sign-off' },
  { name: 'Kavita Rao', email: 'procurement@entrix.local', role: 'PROCUREMENT_OFFICER', desc: 'PO & Stock Adjustments' },
  { name: 'Vikram Mehta', email: 'staff@entrix.local', role: 'STAFF_USER', desc: 'Requisition Submitter Only' }
];

export const Header: React.FC = () => {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    setCurrentUser(getCurrentUser());
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
    setSwitching(true);
    try {
      await loginAsUser(roleEmail, 'Admin@123');
      setShowRoleSwitcher(false);
      window.location.reload();
    } catch (err) {
      alert('Failed to switch role.');
    } finally {
      setSwitching(false);
    }
  };

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
        <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
          isConnected 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
          {isConnected ? 'Socket.io Live' : 'Connecting...'}
        </div>

        {/* Notification Bell with Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-600"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">Real-Time Event Stream</span>
                <span className="text-[10px] text-slate-400 font-mono">{notifications.length} new</span>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No recent events. Actions trigger real-time broadcasts.
                  </div>
                ) : (
                  notifications.map((msg, idx) => (
                    <div key={idx} className="p-3 text-xs text-slate-700 hover:bg-slate-50 transition-colors">
                      <p className="font-medium">{msg}</p>
                      <span className="text-[10px] text-slate-400">Just now</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-slate-200"></div>

        {/* User Badge with Interactive RBAC Role Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
            className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200 text-left"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-sm shadow-indigo-500/20">
              {currentUser.first_name ? currentUser.first_name[0] : 'U'}
            </div>
            <div className="hidden md:block">
              <div className="flex items-center gap-1">
                <p className="text-xs font-semibold text-slate-800">
                  {currentUser.first_name} {currentUser.last_name}
                </p>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>
              <span className="inline-block text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {currentUser.role}
              </span>
            </div>
          </button>

          {showRoleSwitcher && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95">
              <div className="p-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Switch RBAC Persona</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Test granular permissions across roles</p>
              </div>

              <div className="p-1 space-y-0.5 max-h-72 overflow-y-auto">
                {demoRoles.map((r) => {
                  const isActive = currentUser.email === r.email;
                  return (
                    <button
                      key={r.email}
                      disabled={switching}
                      onClick={() => handleRoleSelect(r.email)}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-start justify-between ${
                        isActive 
                          ? 'bg-indigo-50/80 border border-indigo-200' 
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800">{r.name}</span>
                          {isActive && <UserCheck className="w-3 h-3 text-indigo-600" />}
                        </div>
                        <span className="text-[10px] text-indigo-600 font-mono font-bold block">{r.role}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{r.desc}</span>
                      </div>
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
