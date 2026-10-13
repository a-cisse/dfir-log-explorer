import { AlertTriangle, Braces, FileText, X } from "lucide-react";
import { displayTimestamp, formatBytes, statusClass } from "./format";
import type { EventDetail } from "./types";

export function DetailPanel({
  detail,
  onClose,
}: {
  detail: EventDetail;
  onClose: () => void;
}) {
  const fields = [
    ["Timestamp", displayTimestamp(detail.timestamp)],
    ["Source address", detail.sourceIp],
    ["Method", detail.method],
    ["Path", detail.path],
    ["Protocol", detail.protocol],
    [
      "Response size",
      detail.responseBytes === null ? null : formatBytes(detail.responseBytes),
    ],
    ["Referrer", detail.referrer],
    ["User agent", detail.userAgent],
  ];
  return (
    <aside className="detail-panel" aria-label="Event details">
      <div className="detail-heading">
        <div>
          <span className="eyebrow">EVENT DETAILS</span>
          <h2>Line {detail.lineNumber}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close event details"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div className="detail-meta">
        <span className="parser-tag">
          {detail.parser === "apache"
            ? "Apache"
            : detail.parser === "text"
              ? "Plain text"
              : "Unparsed"}
        </span>
        {detail.status !== null && (
          <span className={`status-pill ${statusClass(detail.status)}`}>
            {detail.status}
          </span>
        )}
        <span className="mono">Offset {detail.byteOffset} B</span>
      </div>
      {detail.parseError && (
        <div className="detail-warning">
          <AlertTriangle size={17} />
          <div>
            <strong>Parsing warning</strong>
            <p>{detail.parseError}</p>
          </div>
        </div>
      )}
      <h3>
        <Braces size={15} />
        Extracted fields
      </h3>
      <dl className="field-list">
        {fields
          .filter(([, value]) => value !== null && value !== "—")
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {fields.every(([, value]) => value === null || value === "—") && (
        <p className="muted detail-note">
          This event is available as plain text. Its original content is
          preserved.
        </p>
      )}
      <h3>
        <FileText size={15} />
        Raw event
      </h3>
      <pre className="raw-event" tabIndex={0}>
        {detail.raw || "(empty line)"}
      </pre>
      {detail.rawHex && (
        <>
          <h3>Original bytes / hexadecimal</h3>
          <pre className="raw-event hex">{detail.rawHex}</pre>
        </>
      )}
    </aside>
  );
}
