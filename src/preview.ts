import sample from "./demo-data.json";
import type { Bridge, EventDetail, ImportProgress } from "./types";

let loaded = false;
let cancelled = false;
let importing = false;

export const previewBridge: Bridge = {
  isDesktop: false,
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
      return sample.summary;
    } finally {
      importing = false;
    }
  },
  async cancelImport() {
    cancelled = true;
  },
  async query(query) {
    const rows = loaded
      ? (sample.events as EventDetail[]).filter(
          (row) =>
            row.raw.toLowerCase().includes(query.search.toLowerCase()) &&
            (!query.onlyWarnings || row.parseError !== null),
        )
      : [];
    return {
      rows: rows.slice(query.offset, query.offset + query.limit),
      total: rows.length,
      offset: query.offset,
      limit: query.limit,
      elapsedMs: 0,
    };
  },
  async detail(id) {
    const row =
      loaded &&
      (sample.events as EventDetail[]).find((event) => event.id === id);
    if (!row)
      throw new Error("The selected event does not exist in this session.");
    return row;
  },
};
