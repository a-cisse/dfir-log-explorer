import type { ReactNode, RefObject } from "react";
import {
  Activity,
  Braces,
  ChevronRight,
  CircleHelp,
  FileText,
  FolderOpen,
  Layers,
  LoaderCircle,
  LockKeyhole,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { formatBytes, formatNumber } from "./format";
import type { ParserMode, SourceSummary } from "./types";
import type { View } from "./workspace";
export function Sidebar({
  source,
  view,
  navigate,
  disabled,
  onImport,
  collapsed,
  onToggle,
  onHelp,
}: {
  source: SourceSummary | null;
  view: View;
  navigate: (view: View) => void;
  disabled: boolean;
  onImport: () => void;
  collapsed: boolean;
  onToggle: () => void;
  onHelp: () => void;
}) {
  return (
    <aside className="sidebar" aria-label="Workspace navigation">
      <div className="brand">
        <span className="brand-mark">
          <Layers size={22} />
        </span>
        <div>
          <strong>DFIR</strong>
          <small>LOG EXPLORER</small>
        </div>
      </div>
      <div className="workspace-label">
        <span>WORKSPACE</span>
        <span className="version-tag">MVP 1</span>
      </div>
      <nav>
        {(
          [
            { name: "Explore", icon: Activity },
            { name: "Evidence", icon: FolderOpen },
            { name: "Parsers", icon: Braces },
            { name: "Settings", icon: Settings2 },
          ] as const
        ).map((item) => (
          <button
            key={item.name}
            className={`nav-item ${view === item.name ? "active" : ""}`}
            aria-current={view === item.name ? "page" : undefined}
            title={item.name}
            onClick={() => {
              navigate(item.name);
            }}
          >
            <item.icon size={17} />
            <span>{item.name}</span>
            {view === item.name && <i />}
          </button>
        ))}
      </nav>
      <div className="sources-heading">
        <span>ACTIVE SOURCE</span>
        <button
          className="icon-button"
          aria-label="Import another source"
          disabled={disabled}
          onClick={onImport}
        >
          <Plus size={14} />
        </button>
      </div>
      {source ? (
        <button
          className="source-item"
          title={source.name}
          onClick={() => {
            navigate("Evidence");
          }}
        >
          <FileText size={16} />
          <span>
            <strong>{source.name}</strong>
            <small>
              {formatBytes(source.totalBytes)} ·{" "}
              {formatNumber(source.totalEvents)} lines
            </small>
          </span>
        </button>
      ) : (
        <div className="source-placeholder">
          <FileText size={16} />
          <span>No source imported</span>
        </div>
      )}
      <div className="sidebar-bottom">
        <div className="privacy-card">
          <ShieldCheck size={18} />
          <div>
            <strong>Private by design</strong>
            <p>
              Local processing.
              <br />
              Your evidence stays here.
            </p>
          </div>
        </div>
        <button className="sidebar-help" onClick={onHelp} title="Session help">
          <CircleHelp size={16} />
          <span>Help & shortcuts</span>
        </button>
        <button
          className="collapse-button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggle}
        >
          {collapsed ? (
            <PanelLeftOpen size={17} />
          ) : (
            <PanelLeftClose size={17} />
          )}
          <span>Collapse sidebar</span>
        </button>
      </div>
    </aside>
  );
}
export function Topbar({
  caseName,
  source,
  busy,
  search,
  setSearch,
  searchInput,
  navigate,
  themeControl,
}: {
  source: SourceSummary | null;
  caseName: string;
  busy: boolean;
  search: string;
  setSearch: (value: string) => void;
  searchInput: RefObject<HTMLInputElement | null>;
  navigate: (view: View) => void;
  themeControl: ReactNode;
}) {
  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <span>Workspace</span>
        <ChevronRight size={13} />
        <strong>{caseName}</strong>
      </div>
      <div className="global-search">
        <Search size={16} />
        <input
          ref={searchInput}
          aria-label="Search logs"
          placeholder="Search fields and raw logs…"
          value={search}
          maxLength={4096}
          disabled={!source || busy}
          onChange={(e) => {
            setSearch(e.target.value);
            navigate("Explore");
          }}
        />
        {search ? (
          <button
            className="icon-button"
            aria-label="Clear search"
            onClick={() => setSearch("")}
          >
            <X size={14} />
          </button>
        ) : (
          <kbd>Ctrl K</kbd>
        )}
      </div>
      <div className="topbar-actions">
        <span className="local-badge">
          <LockKeyhole size={12} />
          LOCAL
        </span>
        {themeControl}
        <button
          className="icon-button"
          aria-label="Open settings"
          onClick={() => {
            navigate("Settings");
          }}
        >
          <Settings2 size={16} />
        </button>
      </div>
    </header>
  );
}
export function PageHeading({
  view,
  mode,
  setMode,
  disabled,
  picking,
  beginImport,
}: {
  view: View;
  mode: ParserMode;
  setMode: (mode: ParserMode) => void;
  disabled: boolean;
  picking: boolean;
  beginImport: () => Promise<void>;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">LOCAL INVESTIGATION WORKSPACE</span>
        <h1>
          {view}
          <span className="heading-caption">
            {view === "Explore"
              ? "Read the evidence. Follow the details."
              : view === "Evidence"
                ? "Source integrity and provenance"
                : view === "Parsers"
                  ? "Built-in readers and validation"
                  : "Workspace preferences"}
          </span>
        </h1>
      </div>
      <div className="import-actions">
        <label className="parser-control">
          <span>Parser</span>
          <select
            aria-label="Parser format"
            value={mode}
            disabled={disabled}
            onChange={(e) => setMode(e.target.value as ParserMode)}
          >
            <option value="auto">Auto detect</option>
            <option value="apache">Apache Common / Combined</option>
            <option value="nginx">Nginx Access</option>
            <option value="json_lines">JSON Lines</option>
            <option value="text">Plain text</option>
          </select>
        </label>
        <button
          className="primary-button"
          disabled={disabled}
          onClick={() => void beginImport()}
        >
          {picking ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <Plus size={15} />
          )}
          Import log file
        </button>
      </div>
    </div>
  );
}
