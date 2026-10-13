# MVP 1 acceptance guide

MVP 0 was explicitly accepted on 2026-10-13. MVP 1 is version 0.2.0. Test the desktop builds on Windows 11 x64 and Ubuntu 24.04 x64; browser preview still contains only the synthetic sample and cannot persist/import local evidence.

## Persistent cases and multiple sources

1. Launch an empty temporary case. Import Apache, explicit Nginx and JSON Lines synthetic sources. Each successful import adds a source; previous events remain searchable.
2. Select each source and compare its line counts, SHA-256, original path, parser mode and raw lines with the source. Import the same filename twice and verify distinct source IDs.
3. Select all sources. Sort by timestamp and inspect events from different files. Each inspector must identify the correct source/hash; line numbers and byte offsets are local to that source.
4. Choose **Save case as…** and a new local `.dfir` filename. Verify all imported evidence is retained. Attempt to save over an existing file from a separate temporary case: it must refuse to overwrite.
5. Import another source into the saved case. Close the application, then relaunch and choose **Open case…**. Verify all sources, counts, original bytes, JSON fields and provenance survive without access to original log files.
6. Choose **New case** from a saved case and verify an empty temporary case starts. Reopen the saved case. Trying to switch away from populated unsaved evidence must request saving first through an explanatory error.
7. Open a non-case file or unsupported-version database: the current case must stay available. Cancel native dialogs: the current case must stay available.

## Readers, dates and queries

1. Import `tests/fixtures/nginx-access.log` with Nginx, and `tests/fixtures/events.jsonl` with JSON Lines. Verify reader labels and independent Parsed/Partial/Unparsed results. Auto mode recognizes JSON objects and Apache-compatible access layouts; it cannot determine the access-log producer.
2. Combine source, reader, parsing/warning, normalized-field and JSON scalar filters. Filter `user = alice` and compare results with the raw source. Inspect retained nested JSON fields.
3. Search decoded JSON escapes and text beyond the list preview. Inspect the complete selected event.
4. Compare offset dates representing the same instant across sources. Apply an inclusive UTC start and exclusive UTC end. Dates lacking an explicit offset remain outside ranges/timeline, with a diagnostic.
5. Exercise the timestamp-presence filter for missing/invalid dates. Clear filters and verify totals/HTTP statistics return to the full case.
6. Cancel a large additional import after progress advances. Attempt an oversized line and unsupported compressed format. Reopen the case and verify previous events and source metadata remain unchanged; failed imports must create no source entries.

## Packaging and limitations

Run offline and record platform, build, file sizes, import/search times, memory/disk observations and any issue. Saved cases contain raw evidence and local paths in cleartext; close them before copying/backing up. Compression, custom layouts, error logs, source removal, saved searches, exports and schema migrations remain outside this MVP. See [format/date rules](mvp-1-formats.md) and [validation](mvp-1-validation.md).

```text
Build / commit:
Operating system:
CPU / RAM / storage:
Formats and sizes tested (no sensitive payloads):
Persistence / source / reader / query checks:
Offline checks:
Performance observations:
Issues:
Decision: accepted / changes requested
```

MVP 2 starts only after explicit human acceptance of MVP 1. Pull requests are never merged automatically.
