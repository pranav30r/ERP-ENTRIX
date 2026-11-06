import React from 'react';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ComponentType<{ className?: string }>;
  'aria-label': string;
  tooltip?: string;
  variant?: 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon: Icon,
      'aria-label': ariaLabel,
      tooltip,
      variant = 'ghost',
      size = 'md',
      loading = false,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeClasses = size === 'sm' ? 'w-8 h-8 min-w-[32px] min-h-[32px]' : 'w-9 h-9 min-w-[36px] min-h-[36px]';

    const variantClasses =
      variant === 'danger'
        ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 active:bg-rose-100'
        : 'text-slate-600 hover:text-text hover:bg-surface-2 active:bg-slate-200';

    const buttonElement = (
      <button
        ref={ref}
        type="button"
        aria-label={ariaLabel}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center rounded-lg border border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40 disabled:pointer-events-none select-none ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        <Icon className={`w-4 h-4 shrink-0 ${loading ? 'animate-spin' : ''}`} />
      </button>
    );

    if (tooltip || ariaLabel) {
      return <Tooltip content={tooltip || ariaLabel}>{buttonElement}</Tooltip>;
    }

    return buttonElement;
  }
);

IconButton.displayName = 'IconButton';
export default IconButton;
