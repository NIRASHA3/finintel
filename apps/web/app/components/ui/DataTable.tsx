import React from "react";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  className?: string;
  isNumeric?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  className?: string;
  onRowClick?: (item: T) => void;
  caption?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyTitle = "No records found",
  emptyDescription = "There is currently no data to display for this view.",
  emptyActionLabel,
  onEmptyAction,
  className = "",
  onRowClick,
  caption,
}: DataTableProps<T>) {
  if (loading) {
    return <LoadingSkeleton variant="table" count={5} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
        className={className}
      />
    );
  }

  return (
    <div className={`w-full rounded-xl border border-slate-200 bg-white shadow-card overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-bold text-slate-600 uppercase tracking-wider">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={`px-4 py-3.5 ${
                    col.align === "right" || col.isNumeric
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left"
                  } ${col.className || ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {data.map((item, rowIdx) => {
              const rowKey = keyExtractor(item, rowIdx);
              return (
                <tr
                  key={rowKey}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={`transition-colors ${
                    onRowClick ? "cursor-pointer hover:bg-slate-50" : "hover:bg-slate-50/50"
                  }`}
                >
                  {columns.map((col) => {
                    const content = col.render
                      ? col.render(item, rowIdx)
                      : (item as Record<string, unknown>)[col.key] !== undefined
                      ? String((item as Record<string, unknown>)[col.key])
                      : null;

                    return (
                      <td
                        key={`${rowKey}-${col.key}`}
                        className={`px-4 py-3.5 whitespace-nowrap text-slate-700 ${
                          col.align === "right" || col.isNumeric
                            ? "text-right tnum font-mono"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left"
                        } ${col.className || ""}`}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
