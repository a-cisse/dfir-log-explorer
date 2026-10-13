export type ParserMode = "auto" | "apache" | "text";
export type ParseStatus = "parsed" | "partial" | "unparsed";
export type SearchField =
  | "all"
  | "raw"
  | "timestamp"
  | "sourceIp"
  | "method"
  | "path"
  | "status"
  | "responseBytes"
  | "protocol"
  | "referrer"
  | "userAgent";
export type SortField =
  | "lineNumber"
  | "timestamp"
  | "sourceIp"
  | "method"
  | "path"
  | "status"
  | "responseBytes"
  | "referrer"
  | "userAgent"
  | "parseStatus"
  | "preview";
export interface FieldFilter {
  field: SearchField;
  value: string;
}
export interface ImportProgress {
  bytesRead: number;
  totalBytes: number;
  linesRead: number;
  elapsedMs: number;
}
export interface SourceSummary {
  name: string;
  provenance: string;
  parserMode: ParserMode;
  totalBytes: number;
  totalEvents: number;
  parsedEvents: number;
  partialEvents: number;
  unparsedEvents: number;
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
  parseStatus: ParseStatus;
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
  searchField?: SearchField;
  parseStatus?: ParseStatus | null;
  fieldFilter?: FieldFilter | null;
  timeFrom?: number | null;
  timeTo?: number | null;
  sortBy?: SortField;
  descending?: boolean;
}
export interface TimeBucket {
  startMs: number;
  endMs: number;
  parsed: number;
  partial: number;
  unparsed: number;
  responses: number[];
}
export interface Statistics {
  total: number;
  parsed: number;
  partial: number;
  unparsed: number;
  warnings: number;
  missingTimestamp: number;
  totalRequests: number;
  uniqueIps: number;
  responses: number[];
  timeline: TimeBucket[];
}
export interface QueryPage {
  rows: EventRow[];
  total: number;
  offset: number;
  limit: number;
  elapsedMs: number;
  statistics: Statistics;
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
