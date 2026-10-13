import type { ParserMode } from "./types";
export type View = "Explore" | "Evidence" | "Parsers" | "Settings";
export const parsers: {
  mode: ParserMode;
  name: string;
  description: string;
  formats: string;
}[] = [
  {
    mode: "auto",
    name: "Auto detect",
    description:
      "Recognizes access records and JSON objects. Unknown lines remain searchable as raw text with Unparsed status.",
    formats: "Apache / Nginx Combined · JSON Lines · raw text",
  },
  {
    mode: "apache",
    name: "Apache Access",
    description:
      "Validates Common and Combined access records. Field validation failures retain recoverable fields as Partial; pattern mismatches remain Unparsed.",
    formats: "Common Log Format · Combined Log Format",
  },
  {
    mode: "nginx",
    name: "Nginx Access",
    description:
      "Reads standard Common/Combined access layouts. Choose this reader to identify Nginx explicitly; its Combined format also matches Apache.",
    formats: "Standard access log · Combined",
  },
  {
    mode: "json_lines",
    name: "JSON Lines",
    description:
      "Reads one JSON object per line, retains original fields and extracts documented HTTP/date aliases. Invalid lines remain visible with diagnostics.",
    formats: "JSONL · NDJSON · UTF-8 objects",
  },
  {
    mode: "text",
    name: "Plain text",
    description:
      "Reads every line without structured extraction. A successfully read line is Parsed; encoding warnings are reported separately.",
    formats: "Uncompressed text · original source order",
  },
];
