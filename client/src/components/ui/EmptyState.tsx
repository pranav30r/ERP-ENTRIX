import React from 'react';

export interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-muted mb-3 shadow-sm">
        <Icon className="w-6 h-6 text-muted" />
      </div>
      <h3 className="text-base font-semibold text-text mb-1 font-sans">{title}</h3>
      {description && (
        <p className="text-xs text-muted max-w-sm mb-4 leading-relaxed font-sans">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};

export default EmptyState;
