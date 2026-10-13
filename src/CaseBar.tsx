import { FolderOpen, Save, Plus } from "lucide-react";
import type { CaseSummary, JsonFilter, ParserMode } from "./types";

export function CaseBar({
  info,
  disabled,
  onSave,
  onOpen,
  onNew,
}: {
  info: CaseSummary;
  disabled: boolean;
  onSave: () => void;
  onOpen: () => void;
  onNew: () => void;
}) {
  return (
    <section className="case-bar" aria-label="Case management">
      <div className="case-title">
        <strong>{info.name}</strong>
        <span title={info.path ?? undefined}>
          {info.path
            ? "Saved locally · imports are saved automatically"
            : "Temporary case · save to keep your analysis"}{" "}
          · {info.sources.length} sources
        </span>
      </div>
      <button
        className="secondary-button"
        disabled={disabled || info.path !== null}
        onClick={onSave}
      >
        <Save size={14} />
        Save case as…
      </button>
      <button className="secondary-button" disabled={disabled} onClick={onOpen}>
        <FolderOpen size={14} />
        Open case…
      </button>
      <button className="secondary-button" disabled={disabled} onClick={onNew}>
        <Plus size={14} />
        New case
      </button>
    </section>
  );
}
export function SourceFilters({
  info,
  sourceId,
  onSource,
  parser,
  onParser,
  hasTimestamp,
  onTimestamp,
  jsonFilter,
  onJson,
  disabled,
}: {
  info: CaseSummary;
  sourceId: number | null;
  onSource: (id: number | null) => void;
  parser: ParserMode | null;
  onParser: (mode: ParserMode | null) => void;
  hasTimestamp: boolean | null;
  onTimestamp: (value: boolean | null) => void;
  jsonFilter: JsonFilter | null;
  onJson: (filter: JsonFilter | null) => void;
  disabled: boolean;
}) {
  return (
    <div className="source-filters">
      <label>
        Source
        <select
          aria-label="Source filter"
          disabled={disabled}
          value={sourceId ?? ""}
          onChange={(e) =>
            onSource(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">All sources</option>
          {info.sources.map((source) => (
            <option key={source.id} value={source.id}>
              #{source.id} · {source.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Reader
        <select
          aria-label="Reader filter"
          disabled={disabled}
          value={parser ?? ""}
          onChange={(e) =>
            onParser((e.target.value || null) as ParserMode | null)
          }
        >
          <option value="">All readers</option>
          <option value="apache">Apache</option>
          <option value="nginx">Nginx</option>
          <option value="json_lines">JSON Lines</option>
          <option value="text">Text</option>
        </select>
      </label>
      <label>
        Timestamp
        <select
          aria-label="Timestamp presence"
          disabled={disabled}
          value={hasTimestamp === null ? "" : String(hasTimestamp)}
          onChange={(e) =>
            onTimestamp(
              e.target.value === "" ? null : e.target.value === "true",
            )
          }
        >
          <option value="">Any timestamp</option>
          <option value="true">Valid timestamp</option>
          <option value="false">Missing / invalid timestamp</option>
        </select>
      </label>
      <form
        className="json-filter-form"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          onJson({
            key: String(data.get("key")),
            value: String(data.get("value")),
          });
        }}
      >
        <label>
          JSON field
          <input
            aria-label="JSON field name"
            name="key"
            placeholder="e.g. user"
            maxLength={4096}
            required
            disabled={disabled}
          />
        </label>
        <label>
          Equals
          <input
            aria-label="JSON field value"
            name="value"
            placeholder="Exact scalar value"
            maxLength={4096}
            disabled={disabled}
          />
        </label>
        <button className="secondary-button" disabled={disabled}>
          Apply JSON filter
        </button>
      </form>
      {jsonFilter && (
        <button
          className="filter-chip"
          disabled={disabled}
          onClick={() => onJson(null)}
          title="Remove JSON filter"
        >
          {jsonFilter.key} = {jsonFilter.value} ×
        </button>
      )}
    </div>
  );
}
