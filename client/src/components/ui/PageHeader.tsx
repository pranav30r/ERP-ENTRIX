import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  className = '',
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8 ${className}`}>
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-text tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm sm:text-base text-muted leading-relaxed">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-3 sm:self-center">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
