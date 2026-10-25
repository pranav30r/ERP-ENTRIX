import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingFallback: React.FC<{ message?: string }> = ({ message = 'Loading workspace module...' }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[360px] w-full flex flex-col items-center justify-center p-8 text-center space-y-3"
    >
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" aria-hidden="true" />
      <p className="text-xs font-medium text-slate-500 font-mono">{message}</p>
      <span className="sr-only">Loading content, please wait.</span>
    </div>
  );
};

export default LoadingFallback;
