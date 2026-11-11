import * as React from 'react';
import { cn } from '@/lib/utils';
import { EmptyState } from './EmptyState';
import { SkeletonTableRow } from './LoadingState';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface Column<T> {
  header: string | React.ReactNode;
  accessorKey?: keyof T | string;
  cell?: (item: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (item: T) => void;
  selectedRowId?: string | number;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnKey: string) => void;
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
  selectedRowId,
  sortColumn,
  sortDirection,
  onSort,
  className,
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-2xl border border-wf-border-default bg-wf-surface-card shadow-card backdrop-blur-sm transition-colors duration-hover',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-wf-text-primary border-collapse">
          <thead className="sticky top-0 z-10 border-b border-wf-border-default bg-wf-surface-subtle/90 backdrop-blur-md text-[11px] uppercase tracking-wider text-wf-text-secondary select-none h-12">
            <tr>
              {columns.map((col, idx) => {
                const colKey = String(col.accessorKey || idx);
                const isSorted = sortColumn === colKey;
                const isSortable = Boolean(col.sortable && onSort);

                return (
                  <th
                    key={idx}
                    scope="col"
                    onClick={isSortable ? () => onSort?.(colKey) : undefined}
                    className={cn(
                      'px-6 py-3.5 font-semibold text-wf-text-secondary align-middle',
                      isSortable && 'cursor-pointer hover:text-wf-text-primary transition-colors',
                      col.headerClassName
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {isSortable && (
                        <span className="shrink-0 text-wf-text-tertiary">
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp className="h-3.5 w-3.5 text-wf-brand-burgundy dark:text-wf-cream" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-wf-brand-burgundy dark:text-wf-cream" />
                            )
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-wf-border-subtle">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <SkeletonTableRow key={idx} columns={columns.length} />
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 sm:p-12 text-center">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              data.map((item, rowIdx) => {
                const isSelected = selectedRowId !== undefined && item.id === selectedRowId;

                return (
                  <tr
                    key={item.id ?? rowIdx}
                    onClick={() => onRowClick?.(item)}
                    className={cn(
                      'transition-colors duration-micro min-h-[56px] md:h-[60px]',
                      isSelected
                        ? 'bg-wf-brand-burgundy/10 dark:bg-wf-brand-burgundy/20 font-medium'
                        : 'hover:bg-wf-surface-subtle/70',
                      onRowClick && 'cursor-pointer'
                    )}
                  >
                    {columns.map((col, colIdx) => (
                      <td
                        key={colIdx}
                        className={cn(
                          'px-6 py-3.5 md:py-4 align-middle text-sm font-normal text-wf-text-primary',
                          col.className
                        )}
                      >
                        {col.cell
                          ? col.cell(item, rowIdx)
                          : col.accessorKey
                          ? String((item as Record<string, unknown>)[col.accessorKey as string] ?? '')
                          : null}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
