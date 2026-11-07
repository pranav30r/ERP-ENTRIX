import React from 'react';
import { Filter } from 'lucide-react';

export interface TestDataToggleProps {
  showTestData: boolean;
  onToggle: (next: boolean) => void;
  hiddenCount?: number;
  className?: string;
}

export const TestDataToggle: React.FC<TestDataToggleProps> = ({
  showTestData,
  onToggle,
  hiddenCount = 0,
  className = '',
}) => {
  return (
    <div className={`inline-flex items-center gap-2 text-xs select-none ${className}`}>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={showTestData}
          onChange={(e) => onToggle(e.target.checked)}
          className="sr-only peer"
          aria-label="Toggle test data visibility"
        />
        <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
      </label>
      <span className="text-slate-600 font-medium">Show test data</span>
      {!showTestData && hiddenCount > 0 && (
        <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-full font-mono">
          <Filter className="w-4 h-4" />
          {hiddenCount} hidden
        </span>
      )}
    </div>
  );
};
