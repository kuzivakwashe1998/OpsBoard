/**
 * TanStack Table v8 declaration merging — lets column definitions carry
 * presentation metadata (alignment, CSV export formatting). Types only.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { RowData } from '@tanstack/react-table'

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: 'left' | 'right' | 'center'
    /** CSV export for this column. If omitted, the column is skipped in exports. */
    exportValue?: (row: TData) => string | number
    className?: string
  }
}

export {}
