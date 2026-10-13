export type ParserMode = "auto" | "apache" | "text";

export interface ImportProgress {
  bytesRead: number;
  totalBytes: number;
  linesRead: number;
  elapsedMs: number;
}

export interface SourceSummary {
  name: string;
  totalBytes: number;
  totalEvents: number;
  parsedEvents: number;
  textEvents: number;
  warningEvents: number;
  sha256: string;
  elapsedMs: number;
}

export interface EventRow {
  id: number;
  lineNumber: number;
  byteOffset: number;
  preview: string;
  parser: string;
  timestamp: string | null;
  timestampMs: number | null;
  sourceIp: string | null;
  method: string | null;
  path: string | null;
  protocol: string | null;
  status: number | null;
  responseBytes: number | null;
  referrer: string | null;
  userAgent: string | null;
  parseError: string | null;
}

export interface EventDetail extends EventRow {
  raw: string;
  rawHex: string | null;
}

export interface Query {
  search: string;
  onlyWarnings: boolean;
  offset: number;
  limit: number;
}

export interface QueryPage {
  rows: EventRow[];
  total: number;
  offset: number;
  limit: number;
  elapsedMs: number;
}

export interface Bridge {
  isDesktop: boolean;
  pickFile(): Promise<string | null>;
  importFile(
    mode: ParserMode,
    progress: (value: ImportProgress) => void,
  ): Promise<SourceSummary>;
  importDemo(progress: (value: ImportProgress) => void): Promise<SourceSummary>;
  cancelImport(): Promise<void>;
  query(query: Query): Promise<QueryPage>;
  detail(id: number): Promise<EventDetail>;
}
