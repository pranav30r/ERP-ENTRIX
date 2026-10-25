import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">404 — Workspace View Not Found</h1>
      <p className="text-sm text-slate-500 max-w-sm">
        The organizational endpoint or module you requested does not exist or has been relocated.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 transition shadow-sm"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Return to Dashboard
      </Link>
    </div>
  );
};
