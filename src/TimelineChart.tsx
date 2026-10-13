import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ChartNoAxesColumn } from "lucide-react";
import { formatNumber } from "./format";
import type { Statistics } from "./types";
function utc(value: number) {
  return new Date(value)
    .toISOString()
    .replace("T", " ")
    .replace(".000Z", " UTC");
}
export function TimelineChart({
  stats,
  onRange,
  disabled,
  available,
  pending,
}: {
  stats: Statistics;
  onRange: (from: number, to: number) => void;
  disabled: boolean;
  available: boolean;
  pending: boolean;
}) {
  const [expanded, setExpanded] = useState(() => window.innerHeight > 760);
  useEffect(() => {
    const compact = window.matchMedia("(max-height: 760px)");
    const resize = () => setExpanded(!compact.matches);
    compact.addEventListener("change", resize);
    return () => compact.removeEventListener("change", resize);
  }, []);
  const [view, setView] = useState<"parsing" | "http">("parsing");
  const buckets = stats.timeline;
  const values = buckets.map((b) =>
    view === "parsing" ? [b.parsed, b.partial, b.unparsed] : b.responses,
  );
  const maximum = Math.max(
    1,
    ...values.map((v) => v.reduce((a, b) => a + b, 0)),
  );
  return (
    <section
      className={`timeline-panel ${expanded ? "" : "collapsed"}`}
      aria-label="Event timeline"
    >
      <div className="timeline-heading">
        <button
          className="text-button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <ChartNoAxesColumn size={15} />
          <strong>Event volume</strong>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <div className="timeline-controls">
          <span>
            {available
              ? `${formatNumber(stats.missingTimestamp)} without valid timestamp`
              : pending
                ? "Updating…"
                : "Unavailable"}
          </span>
          {expanded && (
            <select
              aria-label="Timeline distribution"
              value={view}
              onChange={(e) => setView(e.target.value as typeof view)}
            >
              <option value="parsing">Parsing status</option>
              <option value="http">HTTP responses</option>
            </select>
          )}
          <span className="utc-label">UTC</span>
        </div>
      </div>
      {expanded &&
        (!available ? (
          <div className="timeline-empty">
            {pending
              ? "Updating event distribution…"
              : "Timeline unavailable. Retry the query."}
          </div>
        ) : buckets.length ? (
          <>
            <div
              className="histogram"
              aria-label="Click an interval to filter events"
            >
              {buckets.map((bucket, i) => (
                <button
                  key={bucket.startMs}
                  disabled={disabled}
                  className="histogram-bin"
                  aria-label={`Filter interval ${utc(bucket.startMs)} to ${utc(bucket.endMs)}`}
                  title={`${utc(bucket.startMs)} → ${utc(bucket.endMs)}\n${bucket.parsed + bucket.partial + bucket.unparsed} events · Parsed ${bucket.parsed}, Partial ${bucket.partial}, Unparsed ${bucket.unparsed}\nHTTP ${bucket.responses.map((n, j) => `${j + 2}xx: ${n}`).join(", ")}`}
                  onClick={() => onRange(bucket.startMs, bucket.endMs)}
                >
                  {values[i].map((count, j) => (
                    <span
                      key={j}
                      className={
                        view === "parsing"
                          ? ["parsed", "partial", "unparsed"][j]
                          : `group-${j}`
                      }
                      style={{ height: `${(count / maximum) * 100}%` }}
                    />
                  ))}
                </button>
              ))}
            </div>
            <div className="timeline-axis">
              <span>{utc(buckets[0].startMs)}</span>
              <span className="chart-legend">
                {(view === "parsing"
                  ? ["Parsed", "Partial", "Unparsed"]
                  : ["2xx", "3xx", "4xx", "5xx"]
                ).map((label, i) => (
                  <span key={label}>
                    <i
                      className={
                        view === "parsing" ? label.toLowerCase() : `group-${i}`
                      }
                    />
                    {label}
                  </span>
                ))}
              </span>
              <span>{utc(buckets.at(-1)!.endMs)}</span>
            </div>
          </>
        ) : (
          <div className="timeline-empty">
            No valid timestamps in these results. Events remain available in the
            table.
          </div>
        ))}
    </section>
  );
}
