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
      "Recognizes Apache access events. Unknown lines remain searchable as raw text with Unparsed status.",
    formats: "Apache Common · Combined · raw text",
  },
  {
    mode: "apache",
    name: "Apache Access",
    description:
      "Validates Common and Combined access records. Field validation failures retain recoverable fields as Partial; pattern mismatches remain Unparsed.",
    formats: "Common Log Format · Combined Log Format",
  },
  {
    mode: "text",
    name: "Plain text",
    description:
      "Reads every line without structured extraction. A successfully read line is Parsed; encoding warnings are reported separately.",
    formats: "Uncompressed text · original source order",
  },
];
