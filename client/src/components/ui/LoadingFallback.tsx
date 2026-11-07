import React from 'react';
import { Skeleton } from './Skeleton';

export const LoadingFallback: React.FC = () => {
  return (
    <div className="space-y-6" role="status" aria-label="Loading page content">
      {/* PageHeader Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border gap-4">
        <div className="space-y-2">
          <Skeleton variant="line" className="h-7 w-48" />
          <Skeleton variant="line" className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton variant="block" className="h-9 w-24" />
          <Skeleton variant="block" className="h-9 w-28" />
        </div>
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-5 bg-surface border border-border rounded-xl space-y-3">
            <Skeleton variant="line" className="h-3 w-20" />
            <Skeleton variant="line" className="h-8 w-28" />
            <Skeleton variant="line" className="h-2 w-36" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton variant="block" className="h-9 w-64" />
          <Skeleton variant="block" className="h-9 w-32" />
        </div>
        <div className="space-y-2 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="block" className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoadingFallback;
