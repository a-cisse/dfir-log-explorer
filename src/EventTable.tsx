import { useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  SearchX,
} from "lucide-react";
import { displayTimestamp, formatBytes } from "./format";
import { ParsingStatusBadge } from "./ParsingStatusBadge";
import { usePreference } from "./preferences";
import type { EventRow, SortField, SourceSummary } from "./types";
const columnOptions: { key: SortField; label: string; size: number }[] = [
  { key: "sourceId", label: "Source", size: 200 },
  { key: "lineNumber", label: "Line", size: 64 },
  { key: "timestamp", label: "Timestamp / source offset", size: 242 },
  { key: "sourceIp", label: "Client IP", size: 142 },
  { key: "method", label: "Method", size: 80 },
  { key: "path", label: "Path / URL", size: 280 },
  { key: "status", label: "HTTP status", size: 102 },
  { key: "responseBytes", label: "Response size", size: 115 },
  { key: "referrer", label: "Referer", size: 210 },
  { key: "userAgent", label: "User-Agent", size: 230 },
  { key: "parseStatus", label: "Parser status", size: 120 },
  { key: "preview", label: "Raw log preview", size: 340 },
];
const defaultColumns: SortField[] = [
  "sourceId",
  "lineNumber",
  "timestamp",
  "sourceIp",
  "method",
  "path",
  "status",
  "parseStatus",
  "preview",
];
interface Props {
  sources: SourceSummary[];
  rows: EventRow[];
  selectedId: number | null;
  onSelect: (row: EventRow) => void;
  loading: boolean;
  filtered: boolean;
  sortBy: SortField;
  descending: boolean;
  onSort: (key: SortField) => void;
}
export function EventTable({
  sources,
  rows,
  selectedId,
  onSelect,
  loading,
  filtered,
  sortBy,
  descending,
  onSort,
}: Props) {
  const parent = useRef<HTMLDivElement>(null);
  const [configuring, setConfiguring] = useState(false);
  const [visible, setVisible] = usePreference<SortField[]>(
    "columns",
    defaultColumns,
    (v): v is SortField[] =>
      Array.isArray(v) &&
      v.includes("lineNumber") &&
      v.every((k) => columnOptions.some((c) => c.key === k)),
  );
  const columns = useMemo<ColumnDef<EventRow>[]>(
    () =>
      columnOptions.map((c) => ({
        accessorKey: c.key,
        id: c.key,
        header: c.label,
        size: c.size,
        cell: ({ getValue }) => {
          const value = getValue<string | number | null>();
          if (c.key === "sourceId")
            return (
              <span
                className="cell-value"
                title={sources.find((s) => s.id === value)?.provenance}
              >
                #{value} ·{" "}
                {sources.find((s) => s.id === value)?.name ?? "Unknown source"}
              </span>
            );
          if (c.key === "parseStatus")
            return (
              <ParsingStatusBadge status={value as EventRow["parseStatus"]} />
            );
          if (c.key === "timestamp")
            return (
              <span
                className="mono"
                title={value === null ? undefined : String(value)}
              >
                {displayTimestamp(value as string | null)}
              </span>
            );
          if (c.key === "status")
            return <span className="http-code">{value ?? "—"}</span>;
          if (c.key === "responseBytes")
            return (
              <span className="mono">
                {value === null ? "—" : formatBytes(value as number)}
              </span>
            );
          return (
            <span
              className={
                c.key === "lineNumber"
                  ? "line-number"
                  : c.key === "method"
                    ? "method"
                    : "mono cell-value"
              }
              title={value === null ? undefined : String(value)}
            >
              {value ?? "—"}
            </span>
          );
        },
      })),
    [sources],
  );
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnVisibility: Object.fromEntries(
        columnOptions.map((c) => [
          c.key,
          visible.includes(c.key) ||
            (c.key === "sourceId" && sources.length > 1),
        ]),
      ),
    },
  });
  const tableRows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 38,
    overscan: 8,
  });
  useEffect(() => {
    parent.current?.scrollTo({ top: 0 });
  }, [rows]);
  const grid = table
    .getVisibleLeafColumns()
    .map((c) => `${c.getSize()}px`)
    .join(" ");
  const width = table.getTotalSize();
  function focusRow(index: number) {
    if (index < 0 || index >= rows.length) return;
    virtualizer.scrollToIndex(index);
    requestAnimationFrame(() =>
      parent.current
        ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
        ?.focus(),
    );
  }
  return (
    <>
      <div className="table-options">
        <span>
          <span className="live-dot" />{" "}
          {loading ? "Updating results…" : "Events"}
          <small>
            {" "}
            {rows.length} loaded ·{" "}
            {sortBy === "lineNumber" && !descending
              ? "source order"
              : "sorted across all results"}
          </small>
        </span>
        <div className="column-menu">
          <button
            className="text-button"
            aria-expanded={configuring}
            onClick={() => setConfiguring(!configuring)}
          >
            <Columns3 size={14} />
            Columns
          </button>
          {configuring && (
            <fieldset className="column-popover">
              <legend>Visible columns</legend>
              {columnOptions.map((c) => (
                <label key={c.key}>
                  <input
                    type="checkbox"
                    checked={
                      visible.includes(c.key) ||
                      (c.key === "sourceId" && sources.length > 1)
                    }
                    disabled={
                      c.key === "lineNumber" ||
                      (c.key === "sourceId" && sources.length > 1)
                    }
                    onChange={(e) =>
                      setVisible(
                        e.target.checked
                          ? [...visible, c.key]
                          : visible.filter((k) => k !== c.key),
                      )
                    }
                  />
                  {c.label}
                </label>
              ))}
              <button
                className="text-button"
                onClick={() => setVisible(defaultColumns)}
              >
                Reset columns
              </button>
            </fieldset>
          )}
        </div>
      </div>
      <div
        className={`table-shell ${loading ? "is-loading" : ""}`}
        aria-busy={loading}
      >
        <div className="table-scroll" ref={parent}>
          <div
            role="table"
            aria-label="Log events"
            aria-rowcount={rows.length + 1}
            className="event-table"
            style={{ width, minWidth: "100%" }}
          >
            <div role="rowgroup" className="table-head">
              {table.getHeaderGroups().map((group) => (
                <div
                  role="row"
                  key={group.id}
                  className="table-header"
                  style={{ gridTemplateColumns: grid }}
                >
                  {group.headers.map((header) => (
                    <div
                      role="columnheader"
                      key={header.id}
                      aria-sort={
                        sortBy === header.id
                          ? descending
                            ? "descending"
                            : "ascending"
                          : "none"
                      }
                    >
                      <button
                        disabled={loading}
                        onClick={() => onSort(header.id as SortField)}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {sortBy === header.id ? (
                          descending ? (
                            <ArrowDown size={12} />
                          ) : (
                            <ArrowUp size={12} />
                          )
                        ) : (
                          <ArrowUpDown size={11} className="sort-icon" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div
              role="rowgroup"
              style={{
                height: virtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((item) => {
                const row = tableRows[item.index];
                return (
                  <div
                    role="row"
                    aria-rowindex={item.index + 2}
                    aria-selected={selectedId === row.original.id}
                    key={row.original.id}
                    data-index={item.index}
                    className={`table-row ${selectedId === row.original.id ? "selected" : ""}`}
                    style={{
                      gridTemplateColumns: grid,
                      height: item.size,
                      transform: `translateY(${item.start}px)`,
                    }}
                    tabIndex={0}
                    onClick={() => !loading && onSelect(row.original)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (!loading) onSelect(row.original);
                      }
                      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                        e.preventDefault();
                        focusRow(item.index + (e.key === "ArrowDown" ? 1 : -1));
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div role="cell" key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          {!loading && rows.length === 0 && (
            <div className="no-results">
              <SearchX size={24} />
              <strong>
                {filtered ? "No matching events" : "This file has no events"}
              </strong>
              <span>
                {filtered
                  ? "Adjust your search or remove a filter to see more events."
                  : "Import a file containing at least one line."}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
