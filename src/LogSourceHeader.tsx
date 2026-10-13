import { FileText, Fingerprint } from "lucide-react";
import { formatBytes } from "./format";
import { parsers } from "./workspace";
import type { SourceSummary } from "./types";
export function LogSourceHeader({
  source,
  onEvidence,
}: {
  source: SourceSummary;
  onEvidence: () => void;
}) {
  return (
    <section className="source-header">
      <div className="source-file-icon">
        <FileText size={19} />
      </div>
      <div className="source-title">
        <strong>{source.name}</strong>
        <span title={source.provenance}>{source.provenance}</span>
      </div>
      <span className="parser-tag">
        {parsers.find((p) => p.mode === source.parserMode)?.name}
      </span>
      <span className="source-facts">
        {formatBytes(source.totalBytes)}
        <span>·</span>
        {(source.elapsedMs / 1000).toFixed(2)} s
      </span>
      <button
        className="text-button"
        onClick={() => {
          onEvidence();
        }}
      >
        <Fingerprint size={14} />
        Source details
      </button>
    </section>
  );
}
