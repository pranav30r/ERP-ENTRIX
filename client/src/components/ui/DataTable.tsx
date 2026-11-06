import React from 'react';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { FileQuestion, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  numeric?: boolean;
  hideBelow?: 'md' | 'lg';
  width?: string;
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (newPage: number) => void;
  showJumps?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T, index: number) => string;
  pagination?: PaginationConfig;
  footer?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyState,
  onRowClick,
  rowClassName,
  pagination,
  footer,
  className = '',
}: DataTableProps<T>): React.ReactElement {
  const getResponsiveClass = (col: Column<T>) => {
    if (col.hideBelow === 'md') return 'hidden md:table-cell';
    if (col.hideBelow === 'lg') return 'hidden lg:table-cell';
    return '';
  };

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  return (
    <div className={`w-full bg-surface border border-border rounded-lg shadow-card overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-surface-2 border-b border-border z-10">
            <tr>
              {columns.map((col) => {
                const isNumeric = col.numeric || col.align === 'right';
                const isCenter = col.align === 'center';
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={{ width: col.width }}
                    className={`h-11 px-4 text-[11px] font-semibold text-muted uppercase tracking-wide font-sans select-none ${
                      isNumeric ? 'text-right' : isCenter ? 'text-center' : 'text-left'
                    } ${getResponsiveClass(col)}`}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-slate-700">
            {loading ? (
              Array.from({ length: pagination?.pageSize || 5 }).map((_, idx) => (
                <Skeleton key={idx} variant="table-row" columns={columns.length} />
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  {emptyState || (
                    <EmptyState
                      icon={FileQuestion}
                      title="No records found"
                      description="There are currently no rows to display for this view."
                    />
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`h-11 min-h-[44px] transition-colors ${
                    rowClassName ? rowClassName(row, idx) : ''
                  } ${onRowClick ? 'cursor-pointer hover:bg-surface-2/70' : 'hover:bg-surface-2/40'}`}
                >
                  {columns.map((col) => {
                    const isNumeric = col.numeric || col.align === 'right';
                    const isCenter = col.align === 'center';
                    const cellContent = col.render ? col.render(row) : (row as Record<string, any>)[col.key];

                    return (
                      <td
                        key={col.key}
                        className={`h-11 px-4 text-xs ${
                          isNumeric ? 'text-right font-mono tabular-nums' : isCenter ? 'text-center' : 'text-left font-sans'
                        } ${getResponsiveClass(col)}`}
                      >
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          {footer && (
            <tfoot className="border-t-2 border-border bg-surface-2/60 font-medium">
              <tr>
                <td colSpan={columns.length} className="px-4 py-3">
                  {footer}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {pagination && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border bg-surface text-xs text-muted">
          <div>
            Showing{' '}
            <span className="font-semibold text-text font-mono">
              {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1}
            </span>
            -
            <span className="font-semibold text-text font-mono">
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}
            </span>{' '}
            of <span className="font-semibold text-text font-mono">{pagination.total}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {pagination.showJumps && (
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => pagination.onPageChange(1)}
                className="p-1.5 rounded border border-border text-slate-600 hover:bg-surface-2 disabled:opacity-40 disabled:pointer-events-none transition"
                aria-label="First Page"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              className="p-1.5 rounded border border-border text-slate-600 hover:bg-surface-2 disabled:opacity-40 disabled:pointer-events-none transition"
              aria-label="Previous Page"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium text-text">
              Page {pagination.page} of {Math.max(1, totalPages)}
            </span>
            <button
              type="button"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              className="p-1.5 rounded border border-border text-slate-600 hover:bg-surface-2 disabled:opacity-40 disabled:pointer-events-none transition"
              aria-label="Next Page"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {pagination.showJumps && (
              <button
                type="button"
                disabled={pagination.page >= totalPages}
                onClick={() => pagination.onPageChange(totalPages)}
                className="p-1.5 rounded border border-border text-slate-600 hover:bg-surface-2 disabled:opacity-40 disabled:pointer-events-none transition"
                aria-label="Last Page"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
