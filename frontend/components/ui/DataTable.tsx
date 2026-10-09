import * as React from 'react';
import { cn } from '@/lib/utils';
import { EmptyState } from './EmptyState';
import { SkeletonTableRow } from './LoadingState';

export interface Column<T> {
  header: string | React.ReactNode;
  accessorKey?: keyof T;
  cell?: (item: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items to display in this table.',
  emptyAction,
  onRowClick,
  className,
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-xl border border-slate-800/90 bg-navy-850/90 shadow-card backdrop-blur-sm',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-200">
          <thead className="border-b border-slate-800 bg-navy-900/90 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  scope="col"
                  className={cn(
                    'px-4 py-3.5 font-semibold select-none',
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <SkeletonTableRow key={idx} columns={columns.length} />
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              data.map((item, rowIdx) => (
                <tr
                  key={item.id ?? rowIdx}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    'transition-colors duration-150 hover:bg-navy-800/60',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={cn('px-4 py-3.5 align-middle', col.className)}
                    >
                      {col.cell
                        ? col.cell(item, rowIdx)
                        : col.accessorKey
                        ? String(item[col.accessorKey] ?? '')
                        : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
