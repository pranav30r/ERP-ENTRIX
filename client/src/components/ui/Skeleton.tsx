import React from 'react';

export interface SkeletonProps {
  variant?: 'line' | 'block' | 'table-row';
  columns?: number;
  className?: string;
  width?: string;
  height?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'line',
  columns = 4,
  className = '',
  width,
  height,
}) => {
  if (variant === 'table-row') {
    return (
      <tr className={`animate-pulse border-b border-border ${className}`}>
        {Array.from({ length: columns }).map((_, i) => (
          <td key={i} className="py-3 px-4">
            <div className="h-4 bg-slate-200 rounded w-full max-w-[80%]" />
          </td>
        ))}
      </tr>
    );
  }

  if (variant === 'block') {
    return (
      <div
        className={`animate-pulse bg-slate-200 rounded-lg ${className}`}
        style={{ width: width || '100%', height: height || '80px' }}
      />
    );
  }

  return (
    <div
      className={`animate-pulse bg-slate-200 rounded ${className}`}
      style={{ width: width || '100%', height: height || '16px' }}
    />
  );
};

export default Skeleton;
