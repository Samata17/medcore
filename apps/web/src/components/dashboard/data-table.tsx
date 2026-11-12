"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState } from "@/components/dashboard/states";
import { cn } from "@/lib/utils";

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number;
  className?: string;
  /** Hide on small screens to keep tables readable on phones. */
  hideBelow?: "sm" | "md" | "lg";
}

export interface Filter<T> {
  id: string;
  label: string;
  options: { label: string; value: string }[];
  match: (row: T, value: string) => boolean;
}

interface DataTableProps<T> {
  data: T[] | undefined;
  columns: Column<T>[];
  getRowId: (row: T) => string;
  /** Text searched by the search box; omit to hide the search box. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  initialSearch?: string;
  filters?: Filter<T>[];
  pageSize?: number;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Extra controls rendered at the right of the toolbar (e.g. "Add" button). */
  toolbar?: React.ReactNode;
  caption?: string;
}

const HIDE = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" } as const;

/**
 * Generic searchable, sortable, filterable, paginated table.
 * Works client-side on the rows it receives; the API returns pre-scoped rows
 * (tenant + role), so filtering here is only for convenience, never for security.
 */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchText,
  searchPlaceholder = "Search…",
  initialSearch = "",
  filters = [],
  pageSize = 10,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  emptyTitle = "No records found",
  emptyDescription,
  toolbar,
  caption,
}: DataTableProps<T>) {
  const [search, setSearch] = useState(initialSearch);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    let out = data ?? [];
    const q = search.trim().toLowerCase();
    if (q && searchText) out = out.filter((r) => searchText(r).toLowerCase().includes(q));
    for (const f of filters) {
      const v = filterValues[f.id];
      if (v) out = out.filter((r) => f.match(r, v));
    }
    if (sort) {
      const col = columns.find((c) => c.id === sort.id);
      if (col?.sortValue) {
        const get = col.sortValue;
        out = [...out].sort((a, b) => {
          const av = get(a);
          const bv = get(b);
          const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [data, search, searchText, filters, filterValues, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, totalPages);
  const pageRows = rows.slice((current - 1) * pageSize, current * pageSize);

  function toggleSort(id: string) {
    setSort((s) => (s?.id !== id ? { id, dir: "asc" } : s.dir === "asc" ? { id, dir: "desc" } : null));
  }

  const hasToolbar = searchText || filters.length > 0 || toolbar;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {hasToolbar && (
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
          {searchText && (
            <div className="relative md:max-w-xs md:flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                aria-label={searchPlaceholder}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
                className="h-9 pl-9"
              />
            </div>
          )}
          {filters.map((f) => (
            <NativeSelect
              key={f.id}
              aria-label={f.label}
              value={filterValues[f.id] ?? ""}
              onChange={(e) => {
                setFilterValues((s) => ({ ...s, [f.id]: e.target.value }));
                setPage(1);
              }}
              className="md:w-44 [&_select]:h-9"
            >
              <option value="">All {f.label.toLowerCase()}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          ))}
          {toolbar && <div className="flex gap-2 md:ml-auto">{toolbar}</div>}
        </div>
      )}

      {isError ? (
        <ErrorState message={errorMessage} onRetry={onRetry} />
      ) : (
        <Table>
          {caption && <caption className="sr-only">{caption}</caption>}
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead
                  key={c.id}
                  className={cn(c.hideBelow && HIDE[c.hideBelow], c.className)}
                  aria-sort={sort?.id === c.id ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.id)}
                      className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {c.header}
                      {sort?.id === c.id ? (
                        sort.dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-50" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.id} className={cn(c.hideBelow && HIDE[c.hideBelow])}>
                      <Skeleton className="h-4 w-full max-w-36" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : pageRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="p-0">
                  <EmptyState
                    title={emptyTitle}
                    description={search || Object.values(filterValues).some(Boolean) ? "Try changing your search or filters." : emptyDescription}
                  />
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow key={getRowId(row)}>
                  {columns.map((c) => (
                    <TableCell key={c.id} className={cn(c.hideBelow && HIDE[c.hideBelow], c.className)}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
          <p>
            {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, rows.length)} of {rows.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="px-2 tabular-nums">
              {current} / {totalPages}
            </span>
            <Button variant="outline" size="icon-sm" disabled={current >= totalPages} onClick={() => setPage(current + 1)} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
