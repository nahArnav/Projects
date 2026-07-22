import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

function normalizeValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function buildInitialFilters(filters) {
  return filters.reduce((accumulator, filter) => {
    accumulator[filter.id] = "all";
    return accumulator;
  }, {});
}

export function DataTable({
  title,
  rows,
  columns,
  rowKey,
  emptyMessage,
  searchPlaceholder = "Search by applicant ID",
  searchAccessor,
  filters = [],
  pageSizeOptions = [10, 25],
  initialPageSize = 10
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);
  const [activeFilters, setActiveFilters] = useState(() => buildInitialFilters(filters));
  const filterConfigSignature = useMemo(
    () =>
      filters
        .map((filter) => `${filter.id}:${filter.options.map((option) => option.value).join(",")}`)
        .join("|"),
    [filters]
  );

  useEffect(() => {
    setActiveFilters(buildInitialFilters(filters));
  }, [filterConfigSignature]);

  const filterSignature = useMemo(
    () =>
      filters
        .map((filter) => `${filter.id}:${activeFilters[filter.id] ?? "all"}`)
        .join("|"),
    [activeFilters, filters]
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalizeValue(searchTerm);

    return (rows || []).filter((row) => {
      const passesSearch =
        !normalizedSearch ||
        normalizeValue(searchAccessor?.(row))
          .split(" ")
          .join(" ")
          .includes(normalizedSearch);

      if (!passesSearch) {
        return false;
      }

      return filters.every((filter) => {
        const selectedValue = activeFilters[filter.id] ?? "all";
        if (selectedValue === "all") {
          return true;
        }

        return normalizeValue(filter.getValue(row)) === normalizeValue(selectedValue);
      });
    });
  }, [activeFilters, filters, rows, searchAccessor, searchTerm]);

  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, pageSize, filterSignature, rows]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const rangeStart = totalRows ? (currentPage - 1) * pageSize + 1 : 0;
  const rangeEnd = totalRows ? Math.min(currentPage * pageSize, totalRows) : 0;

  return (
    <div className="rounded-[1.75rem] border border-line-subtle bg-black/20 p-5 shadow-panel">
      <div className="text-xs uppercase tracking-[0.24em] text-gold-soft">{title}</div>

      <div className="sticky top-0 z-10 -mx-5 mt-4 border-y border-line-subtle bg-ink/95 px-5 py-4 backdrop-blur-md">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.2fr)_repeat(3,minmax(150px,0.55fr))]">
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.24em] text-parchment-muted">Search</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={searchPlaceholder}
                className="mt-2 w-full rounded-2xl border border-line-subtle bg-black/30 px-4 py-3 text-sm text-parchment outline-none transition placeholder:text-parchment-muted/60 focus:border-gold/45"
              />
            </label>

            {filters.map((filter) => (
              <label key={filter.id} className="block">
                <span className="text-[11px] uppercase tracking-[0.24em] text-parchment-muted">{filter.label}</span>
                <select
                  value={activeFilters[filter.id] ?? "all"}
                  onChange={(event) =>
                    setActiveFilters((current) => ({
                      ...current,
                      [filter.id]: event.target.value
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-line-subtle bg-black/30 px-4 py-3 text-sm text-parchment outline-none transition focus:border-gold/45"
                >
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}

            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.24em] text-parchment-muted">Rows</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="mt-2 w-full rounded-2xl border border-line-subtle bg-black/30 px-4 py-3 text-sm text-parchment outline-none transition focus:border-gold/45"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option} per page
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-full border border-line-subtle bg-black/20 px-4 py-3 text-sm text-parchment-muted">
            Showing {rangeStart}-{rangeEnd} of {totalRows}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={clsx(
                    "border-b border-gold/20 px-6 py-4 text-[11px] font-medium uppercase tracking-[0.22em] text-parchment-muted",
                    column.headerClassName
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length ? (
              paginatedRows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-b border-white/5 text-parchment-muted transition hover:bg-white/5"
                >
                  {columns.map((column) => (
                    <td
                      key={`${rowKey(row)}-${column.key}`}
                      className={clsx("px-6 py-4 align-top", column.cellClassName)}
                    >
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-10 text-center text-sm text-parchment-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-line-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-parchment-muted">
          Client-side pagination prevents endless scrolling while keeping the audit data in session memory.
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={currentPage === 1}
            className="rounded-full border border-line-subtle px-4 py-2 text-sm text-parchment-muted transition hover:border-gold/35 hover:text-parchment disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <div className="rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold">
            Page {currentPage} of {totalPages}
          </div>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={currentPage === totalPages}
            className="rounded-full border border-line-subtle px-4 py-2 text-sm text-parchment-muted transition hover:border-gold/35 hover:text-parchment disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
