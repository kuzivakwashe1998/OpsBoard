import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Table as TanstackTable,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { EmptyState } from './primitives'

export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, any>[]
  globalFilter?: string
  pageSize?: number
  onRowClick?: (row: T) => void
  rowKey: (row: T) => string
  empty?: ReactNode
  /** Controlled table instance (optional; used for CSV export of sorted rows) */
  tableRef?: (table: TanstackTable<T>) => void
  initialSorting?: SortingState
}

export function DataTable<T>({
  data,
  columns,
  globalFilter = '',
  pageSize = 20,
  onRowClick,
  rowKey,
  empty,
  tableRef,
  initialSorting,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? [])
  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _id, value) => {
      const v = String(value).toLowerCase()
      return row.getAllCells().some((c) => String(c.getValue() ?? '').toLowerCase().includes(v))
    },
    initialState: { pagination: { pageSize } },
  })

  useEffect(() => {
    tableRef?.(table)
  }, [table, tableRef])

  // reset to first page when the underlying data set changes
  const dataLen = data.length
  useEffect(() => {
    table.setPageIndex(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalFilter, dataLen])

  return (
    <div className="flex min-w-0 flex-col">
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-left text-[12.5px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sortable = h.column.getCanSort()
                  const sorted = h.column.getIsSorted()
                  const align = (h.column.columnDef.meta?.align as 'left' | 'right' | 'center' | undefined) ?? 'left'
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      className={cn(
                        'sticky top-0 z-10 border-b border-slate-200/80 bg-slate-50/95 px-3 py-2 text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-400',
                        align === 'right' && 'text-right',
                        align === 'center' && 'text-center',
                        sortable && 'cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200',
                        h.column.columnDef.meta?.className,
                      )}
                      onClick={sortable ? h.column.getToggleSortingHandler() : undefined}
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    >
                      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sortable &&
                          (sorted === 'asc' ? (
                            <ArrowUp className="h-3 w-3 text-emerald-600" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-35" />
                          ))}
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-2">
                  {empty ?? <EmptyState title="No rows match" body="Loosen the filters or clear the search." />}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={rowKey(row.original)}
                  className={cn(
                    'group border-b border-slate-100/90 transition-colors last:border-0 dark:border-slate-800/70',
                    onRowClick && 'cursor-pointer hover:bg-emerald-50/40 dark:hover:bg-emerald-500/[0.04]',
                  )}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => {
                    const align = (cell.column.columnDef.meta?.align as 'left' | 'right' | 'center' | undefined) ?? 'left'
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          'px-3 py-[7px] align-middle whitespace-nowrap',
                          align === 'right' && 'tnum text-right',
                          align === 'center' && 'text-center',
                          cell.column.columnDef.meta?.className,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="muted flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 px-3 pt-2.5 text-[11px] dark:border-slate-800">
        <span>
          {table.getFilteredRowModel().rows.length === 0
            ? '0 rows'
            : `${table.getState().pagination.pageIndex * pageSize + 1}–${Math.min(
                (table.getState().pagination.pageIndex + 1) * pageSize,
                table.getFilteredRowModel().rows.length,
              )} of ${table.getFilteredRowModel().rows.length} rows`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md border border-slate-200 p-1 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="tnum min-w-16 text-center font-medium text-slate-600 dark:text-slate-300">
            Page {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
          </span>
          <button
            type="button"
            className="rounded-md border border-slate-200 p-1 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}


