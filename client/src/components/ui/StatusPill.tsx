import React from 'react';

export type StatusPillVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type StatusPillSize = 'sm' | 'md';

export interface StatusPillProps {
  variant?: StatusPillVariant;
  size?: StatusPillSize;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<StatusPillVariant, { bg: string; text: string; dotColor: string; border: string }> = {
  success: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dotColor: 'bg-emerald-500',
    border: 'border-emerald-200',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dotColor: 'bg-amber-500',
    border: 'border-amber-200',
  },
  danger: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    dotColor: 'bg-rose-500',
    border: 'border-rose-200',
  },
  info: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    dotColor: 'bg-indigo-500',
    border: 'border-indigo-200',
  },
  neutral: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    dotColor: 'bg-slate-400',
    border: 'border-slate-200',
  },
};

const sizeStyles: Record<StatusPillSize, { padding: string; text: string; dotSize: string }> = {
  sm: {
    padding: 'px-2 py-0.5',
    text: 'text-xs',
    dotSize: 'w-1.5 h-1.5',
  },
  md: {
    padding: 'px-2.5 py-1',
    text: 'text-xs',
    dotSize: 'w-2 h-2',
  },
};

export const StatusPill: React.FC<StatusPillProps> = ({
  variant = 'neutral',
  size = 'md',
  children,
  dot = false,
  className = '',
}) => {
  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border font-sans ${v.bg} ${v.text} ${v.border} ${s.padding} ${s.text} ${className}`}
    >
      {dot && <span className={`rounded-full shrink-0 ${v.dotColor} ${s.dotSize}`} />}
      <span>{children}</span>
    </span>
  );
};

export default StatusPill;
