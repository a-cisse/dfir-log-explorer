import { useEffect, useMemo, useRef } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, ArrowUpRight, SearchX } from "lucide-react";
import { displayTimestamp, statusClass } from "./format";
import type { EventRow } from "./types";

interface Props {
  rows: EventRow[];
  selectedId: number | null;
  onSelect: (row: EventRow) => void;
  loading: boolean;
  filtered: boolean;
}

export function EventTable({
  rows,
  selectedId,
  onSelect,
  loading,
  filtered,
}: Props) {
  const parent = useRef<HTMLDivElement>(null);
  const columns = useMemo<ColumnDef<EventRow>[]>(
    () => [
      {
        accessorKey: "lineNumber",
        header: "Line",
        size: 66,
        cell: ({ getValue }) => (
          <span className="line-number">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: "timestamp",
        header: "Timestamp / source offset",
        size: 246,
        cell: ({ getValue }) => (
          <span className="timestamp">
            {displayTimestamp(getValue<string | null>())}
          </span>
        ),
      },
      {
        accessorKey: "sourceIp",
        header: "Source address",
        size: 142,
        cell: ({ getValue }) => (
          <span className="mono">{getValue<string | null>() ?? "—"}</span>
        ),
      },
      {
        accessorKey: "method",
        header: "Method",
        size: 76,
        cell: ({ getValue }) => (
          <span className="method">{getValue<string | null>() ?? "—"}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 78,
        cell: ({ getValue }) => {
          const status = getValue<number | null>();
          return (
            <span className={`status-pill ${statusClass(status)}`}>
              {status ?? "—"}
            </span>
          );
        },
      },
      {
        id: "event",
        header: "Event / request",
        size: 350,
        cell: ({ row }) => (
          <span className="event-preview">
            {row.original.path ?? (row.original.preview || "(empty line)")}
          </span>
        ),
      },
      {
        id: "quality",
        header: "",
        size: 38,
        cell: ({ row }) =>
          row.original.parseError ? (
            <AlertTriangle
              size={14}
              className="warning-icon"
              aria-label="Parsing warning"
            />
          ) : (
            <ArrowUpRight size={14} className="row-arrow" />
          ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const tableRows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 46,
    overscan: 8,
  });
  useEffect(() => {
    parent.current?.scrollTo({ top: 0 });
  }, [rows]);
  const grid = "66px 246px 142px 76px 78px minmax(280px, 1fr) 38px";
  return (
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
                  <div role="columnheader" key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div
            role="rowgroup"
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const row = tableRows[item.index];
              return (
                <div
                  role="row"
                  aria-rowindex={item.index + 2}
                  aria-selected={selectedId === row.original.id}
                  key={row.original.id}
                  className={`table-row ${selectedId === row.original.id ? "selected" : ""}`}
                  style={{
                    gridTemplateColumns: grid,
                    height: item.size,
                    transform: `translateY(${item.start}px)`,
                  }}
                  tabIndex={0}
                  onClick={() => onSelect(row.original)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(row.original);
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
            <SearchX size={28} />
            <strong>
              {filtered ? "No matching events" : "This file has no events"}
            </strong>
            <span>
              {filtered
                ? "Try a different search or turn off the warning filter."
                : "Import a file containing at least one line."}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
