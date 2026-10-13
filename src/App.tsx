import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  Fingerprint,
  FlaskConical,
  FolderOpen,
  HardDrive,
  Layers,
  LoaderCircle,
  LockKeyhole,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { DetailPanel } from "./DetailPanel";
import { EventTable } from "./EventTable";
import { formatBytes, formatNumber } from "./format";
import type {
  Bridge,
  EventDetail,
  EventRow,
  ImportProgress,
  ParserMode,
  QueryPage,
  SourceSummary,
} from "./types";

const PAGE_SIZE = 500;
const emptyPage: QueryPage = {
  rows: [],
  total: 0,
  offset: 0,
  limit: PAGE_SIZE,
  elapsedMs: 0,
};

export function App({ bridge }: { bridge: Bridge }) {
  const [source, setSource] = useState<SourceSummary | null>(null);
  const [page, setPage] = useState<QueryPage>(emptyPage);
  const [mode, setMode] = useState<ParserMode>("auto");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [onlyWarnings, setOnlyWarnings] = useState(false);
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [picking, setPicking] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sourceInfo, setSourceInfo] = useState(false);
  const [help, setHelp] = useState(false);
  const [dark, setDark] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const detailRequest = useRef(0);
  const importRunning = useRef(false);
  const disabled = busy || picking;

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    if (!help && !sourceInfo) return;
    const dialog = document.querySelector<HTMLElement>(".modal");
    if (!dialog) return;
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button, a, input, select, [tabindex='0']",
        ),
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener("keydown", trapFocus);
    return () => dialog.removeEventListener("keydown", trapFocus);
  }, [help, sourceInfo]);
  useEffect(() => {
    const timeout = setTimeout(() => {
      setOffset(0);
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!source || busy) return;
    let current = true;
    setLoading(true);
    bridge
      .query({
        search: debouncedSearch,
        onlyWarnings,
        offset,
        limit: PAGE_SIZE,
      })
      .then((result) => {
        if (current) {
          setPage(result);
          setLoading(false);
        }
      })
      .catch((reason: unknown) => {
        if (current) {
          setError(String(reason));
          setLoading(false);
        }
      });
    return () => {
      current = false;
    };
  }, [bridge, source, debouncedSearch, onlyWarnings, offset, busy]);

  const beginImport = useCallback(
    async (demo = false) => {
      if (importRunning.current) return;
      importRunning.current = true;
      setError(null);
      setNotice(null);
      try {
        if (!demo) {
          setPicking(true);
          const name = await bridge.pickFile();
          setPicking(false);
          if (!name) return;
        }
        detailRequest.current++;
        setBusy(true);
        setProgress(null);
        setCancelling(false);
        const summary = await (demo
          ? bridge.importDemo(setProgress)
          : bridge.importFile(mode, setProgress));
        setSource(summary);
        setDetail(null);
        setSourceInfo(false);
        setSearch("");
        setDebouncedSearch("");
        setOnlyWarnings(false);
        setOffset(0);
        setPage(emptyPage);
        setNotice(
          `Imported ${formatNumber(summary.totalEvents)} events. Your source file was left unchanged.`,
        );
      } catch (reason) {
        const message =
          reason instanceof Error ? reason.message : String(reason);
        if (message.toLowerCase().includes("cancelled")) setNotice(message);
        else setError(message);
      } finally {
        importRunning.current = false;
        setBusy(false);
        setPicking(false);
        setCancelling(false);
        setProgress(null);
      }
    },
    [bridge, mode],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        if (!disabled) void beginImport();
      }
      if (event.key === "Escape") {
        detailRequest.current++;
        setDetail(null);
        setSourceInfo(false);
        setHelp(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [beginImport, disabled]);

  async function selectEvent(row: EventRow) {
    if (busy) return;
    const request = ++detailRequest.current;
    try {
      const selected = await bridge.detail(row.id);
      if (request === detailRequest.current) setDetail(selected);
    } catch (reason) {
      if (request === detailRequest.current) setError(String(reason));
    }
  }

  async function cancel() {
    setCancelling(true);
    try {
      await bridge.cancelImport();
    } catch (reason) {
      setError(String(reason));
      setCancelling(false);
    }
  }

  const percent =
    progress && progress.totalBytes > 0
      ? Math.min(100, (progress.bytesRead / progress.totalBytes) * 100)
      : 0;
  const filtered = debouncedSearch.length > 0 || onlyWarnings;
  const rangeStart = page.total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, page.total);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => event.preventDefault()}
          aria-label="DFIR Log Explorer"
        >
          <span className="brand-mark">
            <Layers size={23} strokeWidth={1.8} />
          </span>
          <span>
            <strong>DFIR</strong>
            <small>LOG EXPLORER</small>
          </span>
        </a>
        <div className="workspace-label">
          WORKSPACE<span className="version-tag">MVP 0</span>
        </div>
        <div className="nav-item active">
          <Activity size={18} />
          Event explorer
          <span className="nav-dot" />
        </div>
        <div className="sources-heading">
          <span>SOURCE</span>
          <button
            className="sidebar-icon"
            aria-label="Import another source"
            disabled={disabled}
            onClick={() => void beginImport()}
          >
            <Plus size={16} />
          </button>
        </div>
        {source ? (
          <button
            className={`source-item ${sourceInfo ? "selected" : ""}`}
            onClick={() => setSourceInfo(!sourceInfo)}
          >
            <FileText size={17} />
            <span>
              <strong>{source.name}</strong>
              <small>
                {formatBytes(source.totalBytes)} ·{" "}
                {formatNumber(source.totalEvents)} events
              </small>
            </span>
            <span className="source-dot" />
          </button>
        ) : (
          <div className="source-placeholder">
            <FileText size={17} />
            <span>No source imported</span>
          </div>
        )}
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <span className="privacy-icon">
              <ShieldCheck size={18} />
            </span>
            <div>
              <strong>Your evidence stays here.</strong>
              <p>
                Local processing. No telemetry.
                <br />
                No cloud connection.
              </p>
            </div>
          </div>
          <div className="session-label">
            <span className="source-dot" />
            Temporary session
            <button
              className="sidebar-icon"
              aria-label="Session help"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            <FolderOpen size={15} />
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>Untitled session</strong>
          </div>
          <div className="topbar-actions">
            <span className="local-badge">
              <LockKeyhole size={12} />
              LOCAL ONLY
            </span>
            <button
              className="icon-button"
              aria-label={
                dark ? "Switch to light theme" : "Switch to dark theme"
              }
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              className="icon-button"
              aria-label="Open help"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={17} />
            </button>
          </div>
        </header>
        {!bridge.isDesktop && (
          <div className="preview-banner">
            <FlaskConical size={14} />
            <span>
              Interface preview · synthetic data only. Open the desktop app to
              analyze your files.
            </span>
          </div>
        )}
        <section className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">FROM RAW LOGS TO CLEAR SIGNALS</div>
              <h1>
                Event explorer<span className="heading-dot">.</span>
              </h1>
              <p>Explore your logs. Find the details that matter.</p>
            </div>
            <div className="import-actions">
              <label className="parser-control">
                <span>Format</span>
                <select
                  aria-label="Parser format"
                  value={mode}
                  disabled={disabled}
                  onChange={(event) =>
                    setMode(event.target.value as ParserMode)
                  }
                >
                  <option value="auto">Auto detect</option>
                  <option value="apache">Apache Common / Combined</option>
                  <option value="text">Plain text</option>
                </select>
              </label>
              <button
                className="primary-button"
                disabled={disabled}
                onClick={() => void beginImport()}
              >
                {picking ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <Plus size={17} />
                )}
                Import log file
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="message error-message">
              <AlertTriangle size={17} />
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {notice && !busy && (
            <div role="status" className="message notice-message">
              <Check size={16} />
              <span>{notice}</span>
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setNotice(null)}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {busy && (
            <div className="import-progress" role="status">
              <div className="progress-heading">
                <div>
                  <LoaderCircle size={17} className="spin" />
                  <strong>
                    {cancelling ? "Cancelling import…" : "Importing locally…"}
                  </strong>
                  <span>
                    {formatNumber(progress?.linesRead ?? 0)} events read
                  </span>
                </div>
                <button
                  className="secondary-button"
                  disabled={cancelling}
                  onClick={() => void cancel()}
                >
                  Cancel import
                </button>
              </div>
              <div className="progress-track">
                <div style={{ width: `${percent}%` }} />
              </div>
              <div className="progress-caption">
                <span>
                  {formatBytes(progress?.bytesRead ?? 0)} /{" "}
                  {formatBytes(progress?.totalBytes ?? 0)}
                </span>
                <span>{Math.round(percent)}%</span>
              </div>
            </div>
          )}

          {source ? (
            <>
              <div className="metrics-strip">
                <div className="metric">
                  <span className="metric-label">
                    <Layers size={15} />
                    TOTAL EVENTS
                  </span>
                  <strong>{formatNumber(source.totalEvents)}</strong>
                  <small>Original order preserved</small>
                </div>
                <div className="metric">
                  <span className="metric-label">
                    <BracesIcon />
                    APACHE EVENTS
                  </span>
                  <strong>{formatNumber(source.parsedEvents)}</strong>
                  <small>
                    {formatNumber(source.textEvents)} plain-text events
                  </small>
                </div>
                <div className="metric">
                  <span className="metric-label">
                    <AlertTriangle size={15} />
                    PARSING WARNINGS
                  </span>
                  <strong
                    className={source.warningEvents ? "metric-warning" : ""}
                  >
                    {formatNumber(source.warningEvents)}
                  </strong>
                  <small>Raw content preserved</small>
                </div>
                <div className="metric">
                  <span className="metric-label">
                    <HardDrive size={15} />
                    SOURCE SIZE
                  </span>
                  <strong>{formatBytes(source.totalBytes)}</strong>
                  <small>
                    Imported in {(source.elapsedMs / 1000).toFixed(2)} s
                  </small>
                </div>
              </div>
              <div className="explorer-card">
                <div className="explorer-toolbar">
                  <div className="search-box">
                    <Search size={17} />
                    <input
                      ref={searchInput}
                      aria-label="Search logs"
                      placeholder="Search any text in your logs…"
                      value={search}
                      maxLength={4096}
                      disabled={busy}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    {search ? (
                      <button
                        className="icon-button"
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                      >
                        <X size={15} />
                      </button>
                    ) : (
                      <kbd>Ctrl K</kbd>
                    )}
                  </div>
                  <button
                    className={`filter-button ${onlyWarnings ? "active" : ""}`}
                    aria-pressed={onlyWarnings}
                    disabled={busy}
                    onClick={() => {
                      setOnlyWarnings(!onlyWarnings);
                      setOffset(0);
                    }}
                  >
                    <AlertTriangle size={15} />
                    Warnings
                    {source.warningEvents > 0 && (
                      <span>{source.warningEvents}</span>
                    )}
                  </button>
                </div>
                <div className="results-heading">
                  <div>
                    <span className="live-dot" />
                    <strong>
                      {filtered ? "Search results" : "All events"}
                    </strong>
                    <span className="count-badge">
                      {formatNumber(page.total)}
                    </span>
                  </div>
                  <span>
                    {loading
                      ? "Searching…"
                      : "Click an event to inspect its details"}
                  </span>
                </div>
                <EventTable
                  rows={page.rows}
                  selectedId={detail?.id ?? null}
                  onSelect={(row) => void selectEvent(row)}
                  loading={loading || busy}
                  filtered={filtered}
                />
                <footer className="table-footer">
                  <span>
                    {formatNumber(rangeStart)}–{formatNumber(rangeEnd)} of{" "}
                    {formatNumber(page.total)} events
                  </span>
                  <div>
                    <span className="query-time">
                      {bridge.isDesktop
                        ? `${page.elapsedMs} ms`
                        : "Synthetic preview"}
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Previous page"
                      disabled={offset === 0 || loading || busy}
                      onClick={() => {
                        setDetail(null);
                        setOffset(Math.max(0, offset - PAGE_SIZE));
                      }}
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Next page"
                      disabled={
                        offset + PAGE_SIZE >= page.total || loading || busy
                      }
                      onClick={() => {
                        setDetail(null);
                        setOffset(offset + PAGE_SIZE);
                      }}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </footer>
              </div>
            </>
          ) : (
            !busy && (
              <div className="empty-state">
                <div className="empty-illustration">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="file-illustration">
                    <FileText size={36} strokeWidth={1.3} />
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="illustration-lock">
                    <LockKeyhole size={17} />
                  </span>
                  <span className="illustration-search">
                    <Search size={20} />
                  </span>
                </div>
                <span className="eyebrow">
                  YOUR NEXT INVESTIGATION STARTS HERE
                </span>
                <h2>Every log tells a story.</h2>
                <p>
                  Import a log file to explore its events, search the raw text,
                  <br />
                  and inspect the evidence — all on your machine.
                </p>
                <button
                  className="primary-button"
                  disabled={disabled}
                  onClick={() => void beginImport()}
                >
                  <ArrowDownToLine size={17} />
                  Choose a log file
                  <ArrowRight size={16} />
                </button>
                <button
                  className="sample-button"
                  disabled={disabled}
                  onClick={() => void beginImport(true)}
                >
                  <FlaskConical size={14} />
                  Explore a synthetic sample
                  <ArrowRight size={14} />
                </button>
                <div className="supported-formats">
                  <span>Apache Common & Combined</span>
                  <span className="separator-dot" />
                  <span>Plain text</span>
                  <span className="separator-dot" />
                  <span>UTF-8</span>
                </div>
              </div>
            )
          )}
          <footer className="workspace-footer">
            <span>
              <LockKeyhole size={12} />
              Your files never leave this device.
            </span>
            <span>
              DFIR Log Explorer <span className="footer-version">v0.1.0</span>
            </span>
          </footer>
        </section>
      </main>
      {detail && (
        <DetailPanel
          detail={detail}
          onClose={() => {
            detailRequest.current++;
            setDetail(null);
          }}
        />
      )}
      {((sourceInfo && source) || help) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setSourceInfo(false);
            setHelp(false);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={help ? "Application help" : "Source information"}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <h2>
                {help
                  ? "A private workspace for your logs"
                  : "Source information"}
              </h2>
              <button
                className="icon-button"
                autoFocus
                aria-label="Close dialog"
                onClick={() => {
                  setSourceInfo(false);
                  setHelp(false);
                }}
              >
                <X size={18} />
              </button>
            </div>
            {help ? (
              <>
                <p>
                  Choose a local file and its format. Auto detect recognizes
                  Apache Common and Combined events; other lines remain
                  searchable as plain text.
                </p>
                <p>
                  This version uses a temporary session. Importing another file
                  replaces the current dataset after a successful import.
                  Cancelling keeps the previous dataset.
                </p>
                <p>
                  Session data is removed on normal application exit. A forced
                  termination can leave temporary files on disk. Use an
                  encrypted local drive for sensitive evidence.
                </p>
                <div className="shortcut-list">
                  <span>
                    <kbd>Ctrl O</kbd> Import a file
                  </span>
                  <span>
                    <kbd>Ctrl K</kbd> Focus search
                  </span>
                  <span>
                    <kbd>Esc</kbd> Close details
                  </span>
                </div>
              </>
            ) : (
              source && (
                <>
                  <p className="source-modal-name">
                    <FileText size={18} />
                    {source.name}
                  </p>
                  <dl className="field-list">
                    <div>
                      <dt>Source size</dt>
                      <dd>{formatBytes(source.totalBytes)}</dd>
                    </div>
                    <div>
                      <dt>Events</dt>
                      <dd>{formatNumber(source.totalEvents)}</dd>
                    </div>
                    <div>
                      <dt>Warnings</dt>
                      <dd>{formatNumber(source.warningEvents)}</dd>
                    </div>
                  </dl>
                  <h3>
                    <Fingerprint size={16} />
                    SHA-256 / imported source bytes
                  </h3>
                  <pre className="raw-event hash">{source.sha256}</pre>
                  <p className="muted">
                    Raw bytes and source offsets are retained. Source files are
                    opened read-only.
                  </p>
                </>
              )
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function BracesIcon() {
  return (
    <span className="braces-icon" aria-hidden="true">
      {"{ }"}
    </span>
  );
}
