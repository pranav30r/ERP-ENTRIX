import React, { useState, useEffect } from 'react';
import { Bell, Search } from 'lucide-react';
import { getSocket } from '../services/socket';

interface HeaderProps {
  user?: {
    first_name: string;
    last_name: string;
    role: string;
    email: string;
  };
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

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
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
            )}
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

        {/* User Badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-sm shadow-indigo-500/20">
            {user ? `${user.first_name[0]}${user.last_name[0]}` : 'AS'}
          </div>
          <div className="text-left hidden md:block">
            <p className="text-xs font-semibold text-slate-800">
              {user ? `${user.first_name} ${user.last_name}` : 'Aditya Sakarkar'}
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              {user ? user.role : 'SUPER_ADMIN'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
