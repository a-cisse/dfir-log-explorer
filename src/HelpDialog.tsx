import { X } from "lucide-react";
export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Application help"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>A private workspace for your logs</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <p>
          Choose a local file and a preconfigured parser. Every source line
          remains available, including Partial and Unparsed results.
        </p>
        <p>
          Sources are opened read-only. Timestamps preserve their source
          offsets; timeline intervals and time filters use UTC explicitly.
          Missing timestamps stay outside the timeline.
        </p>
        <p>
          Imports add sources to the active case; cancellation preserves
          previous evidence. Save case as… retains all imported data in a local
          file. Saved cases reopen without the original logs and save future
          imports automatically. Unsaved temporary cases are removed on normal
          exit.
        </p>
        <div className="shortcut-list">
          <span>
            <kbd>Ctrl O</kbd>Import a file
          </span>
          <span>
            <kbd>Ctrl K</kbd>Focus search
          </span>
          <span>
            <kbd>↑ ↓</kbd>Navigate visible event rows
          </span>
          <span>
            <kbd>Enter</kbd>Inspect event
          </span>
          <span>
            <kbd>Esc</kbd>Close inspector or help
          </span>
        </div>
      </section>
    </div>
  );
}
