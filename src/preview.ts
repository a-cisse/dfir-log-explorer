import sample from "./demo-data.json";
import type {
  Bridge,
  EventDetail,
  ImportProgress,
  Query,
  SearchField,
  Statistics,
  SourceSummary,
} from "./types";

let loaded = false;
let cancelled = false;
let importing = false;
export const emptyStatistics: Statistics = {
  total: 0,
  parsed: 0,
  partial: 0,
  unparsed: 0,
  warnings: 0,
  missingTimestamp: 0,
  totalRequests: 0,
  uniqueIps: 0,
  responses: [0, 0, 0, 0],
  timeline: [],
};
function field(row: EventDetail, key: SearchField): string {
  if (key === "raw") return row.raw;
  if (key === "all")
    return [
      row.raw,
      row.timestamp,
      row.sourceIp,
      row.method,
      row.path,
      row.status,
      row.responseBytes,
      row.protocol,
      row.referrer,
      row.userAgent,
    ]
      .filter((v) => v !== null)
      .join(" ");
  return String(row[key] ?? "");
}
function statistics(rows: EventDetail[]): Statistics {
  const stats: Statistics = {
    ...emptyStatistics,
    responses: [0, 0, 0, 0],
    timeline: [],
    total: rows.length,
  };
  const timestamps = rows.flatMap((row) =>
    row.timestampMs === null ? [] : [row.timestampMs],
  );
  const min = timestamps.length ? Math.min(...timestamps) : null;
  const max = timestamps.length ? Math.max(...timestamps) : null;
  const width =
    min !== null && max !== null
      ? Math.max(1000, Math.ceil((max - min + 1) / 32))
      : 1000;
  if (min !== null && max !== null) {
    stats.timeline = Array.from(
      { length: Math.floor((max - min) / width) + 1 },
      (_, i) => ({
        startMs: min + i * width,
        endMs: min + (i + 1) * width,
        parsed: 0,
        partial: 0,
        unparsed: 0,
        responses: [0, 0, 0, 0],
      }),
    );
  }
  for (const row of rows) {
    stats[row.parseStatus]++;
    if (row.parseError !== null) stats.warnings++;
    if (row.timestampMs === null) stats.missingTimestamp++;
    if (row.method !== null) stats.totalRequests++;
    const group = row.status === null ? -1 : Math.floor(row.status / 100) - 2;
    if (group >= 0 && group < 4) stats.responses[group]++;
    if (row.timestampMs !== null && min !== null) {
      const bucket =
        stats.timeline[Math.floor((row.timestampMs - min) / width)];
      bucket[row.parseStatus]++;
      if (group >= 0 && group < 4) bucket.responses[group]++;
    }
  }
  stats.uniqueIps = new Set(
    rows.flatMap((row) => (row.sourceIp === null ? [] : [row.sourceIp])),
  ).size;
  return stats;
}
export const previewBridge: Bridge = {
  isDesktop: false,
  async caseSummary() {
    return {
      name: "Temporary case",
      path: null,
      sources: loaded ? [sample.summary as SourceSummary] : [],
    };
  },
  async saveCase() {
    throw new Error("Persistent cases require the desktop application.");
  },
  async openCase() {
    throw new Error("Persistent cases require the desktop application.");
  },
  async closeCase() {
    loaded = false;
    return this.caseSummary();
  },
  async pickFile() {
    throw new Error(
      "Open the desktop application to import your local files. This preview uses synthetic data only.",
    );
  },
  async importFile() {
    throw new Error("Local file imports require the desktop application.");
  },
  async importDemo(progress) {
    if (importing) throw new Error("An import is already running.");
    cancelled = false;
    importing = true;
    try {
      for (let step = 0; step <= 5; step++) {
        if (cancelled)
          throw new Error(
            "Import cancelled. No events from this import were kept.",
          );
        progress({
          bytesRead: Math.round((sample.summary.totalBytes * step) / 5),
          totalBytes: sample.summary.totalBytes,
          linesRead: Math.round((sample.summary.totalEvents * step) / 5),
          elapsedMs: step * 80,
        } satisfies ImportProgress);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      if (cancelled)
        throw new Error(
          "Import cancelled. No events from this import were kept.",
        );
      loaded = true;
      return sample.summary as SourceSummary;
    } finally {
      importing = false;
    }
  },
  async cancelImport() {
    cancelled = true;
  },
  async query(query: Query) {
    if (
      query.limit < 1 ||
      query.limit > 500 ||
      query.offset < 0 ||
      query.search.length > 4096 ||
      (query.timeFrom != null &&
        query.timeTo != null &&
        query.timeFrom >= query.timeTo)
    )
      throw new Error("Invalid query.");
    const rows = loaded
      ? (sample.events as EventDetail[]).filter(
          (row) =>
            (query.searchField === undefined || query.searchField === "all"
              ? row.raw.toLowerCase().includes(query.search.toLowerCase()) ||
                (row.timestamp
                  ?.toLowerCase()
                  .includes(query.search.toLowerCase()) ??
                  false)
              : field(row, query.searchField)
                  .toLowerCase()
                  .includes(query.search.toLowerCase())) &&
            (query.sourceId == null || query.sourceId === row.sourceId) &&
            (query.parser == null || query.parser === row.parser) &&
            (query.hasTimestamp == null ||
              query.hasTimestamp === (row.timestampMs !== null)) &&
            (!query.jsonFilter ||
              String(row.jsonFields?.[query.jsonFilter.key]) ===
                query.jsonFilter.value) &&
            (!query.onlyWarnings || row.parseError !== null) &&
            (!query.parseStatus || query.parseStatus === row.parseStatus) &&
            (!query.fieldFilter ||
              field(row, query.fieldFilter.field) ===
                query.fieldFilter.value) &&
            (query.timeFrom == null ||
              (row.timestampMs !== null &&
                row.timestampMs >= query.timeFrom)) &&
            (query.timeTo == null ||
              (row.timestampMs !== null && row.timestampMs < query.timeTo)),
        )
      : [];
    const stats = statistics(rows);
    const key =
      query.sortBy === "timestamp"
        ? "timestampMs"
        : query.sortBy === "preview"
          ? "raw"
          : query.sortBy === "lineNumber"
            ? "id"
            : (query.sortBy ?? "id");
    rows.sort((a, b) => {
      const av = a[key],
        bv = b[key];
      if (av === null) return bv === null ? a.id - b.id : 1;
      if (bv === null) return -1;
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : av < bv
            ? -1
            : av > bv
              ? 1
              : 0;
      return (query.descending ? -cmp : cmp) || a.id - b.id;
    });
    return {
      rows: rows.slice(query.offset, query.offset + query.limit).map((row) => ({
        ...row,
        preview: row.raw.slice(0, 240),
        path: row.path?.slice(0, 240) ?? null,
        referrer: row.referrer?.slice(0, 240) ?? null,
        userAgent: row.userAgent?.slice(0, 240) ?? null,
      })),
      total: rows.length,
      offset: query.offset,
      limit: query.limit,
      elapsedMs: 0,
      statistics: stats,
    };
  },
  async detail(id) {
    const row =
      loaded && (sample.events as EventDetail[]).find((row) => row.id === id);
    if (!row)
      throw new Error("The selected event does not exist in this session.");
    return row;
  },
};
