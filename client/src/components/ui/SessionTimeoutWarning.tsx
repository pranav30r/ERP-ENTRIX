import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { ensureAuthenticated } from '../../services/api';

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 mins
const WARNING_BEFORE_MS = 2 * 60 * 1000;    // 2 mins warning

export const SessionTimeoutWarning: React.FC = () => {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(120);

  useEffect(() => {
    let lastActivity = Date.now();

    const resetActivity = () => {
      lastActivity = Date.now();
      if (showWarning) setShowWarning(false);
    };

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((ev) => window.addEventListener(ev, resetActivity));

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      const timeLeft = INACTIVITY_LIMIT_MS - elapsed;

      if (timeLeft <= WARNING_BEFORE_MS && timeLeft > 0) {
        setShowWarning(true);
        setSecondsRemaining(Math.ceil(timeLeft / 1000));
      } else if (timeLeft <= 0) {
        setShowWarning(false);
        // Force session expire
        localStorage.removeItem('entrix_token');
        localStorage.removeItem('entrix_refresh_token');
        window.location.href = '/';
      } else {
        if (showWarning) setShowWarning(false);
      }
    }, 1000);

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetActivity));
      clearInterval(interval);
    };
  }, [showWarning]);

  if (!showWarning) return null;

  const handleStaySignedIn = async () => {
    await ensureAuthenticated();
    setShowWarning(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900">Session Inactivity Warning</h3>
          <p className="text-xs text-slate-500">
            You will be signed out in <span className="font-mono font-bold text-amber-600">{secondsRemaining}s</span> due to inactivity.
          </p>
        </div>
        <div className="pt-2 flex justify-center gap-2">
          <Button variant="primary" size="sm" onClick={handleStaySignedIn}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Stay Signed In
          </Button>
        </div>
      </div>
    </div>
  );
};
