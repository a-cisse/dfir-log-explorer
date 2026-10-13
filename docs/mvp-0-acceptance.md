# MVP 0 acceptance guide

MVP 1 starts only after the user explicitly accepts MVP 0. Record the operating system, application build, hardware, source format/size, and any issues with each test. Do not attach sensitive logs to public issues.

## First launch and interface

1. Install and launch the package on Windows 11 x64 or Ubuntu 24.04 x64.
2. Confirm the empty workspace is legible and the interface is in English.
3. Switch light/dark themes, resize the window, and inspect keyboard focus.
4. Open help and confirm the temporary-session behavior is understandable.

## Built-in sample

1. Click **Explore a synthetic sample**.
2. Expect 13 total events, 11 Apache events, one plain-text event, and one warning.
3. Search `POST /LOGIN`. Expect two results regardless of case.
4. Select a result. Inspect the HTTP status, source address, raw event, line, and byte offset.
5. Clear the search and enable **Warnings**. Inspect the invalid timestamp; the original line remains available.
6. Inspect the source information and its SHA-256 hash.

## Real local file

1. Import a stable, uncompressed Apache Common or Combined log using **Auto detect**.
2. Compare total lines and several extracted events with the source file.
3. Confirm the displayed timestamp retains the source offset.
4. Search text present beyond the first 240 characters of a long line; it must still match.
5. Navigate pages on a file with more than 500 events and verify event order and continuity.
6. Import a plain-text log, including blank lines and a last line without a newline.
7. Choose explicit Apache mode for plain text: unmatched events must produce warnings and remain visible.
8. Compare the source hash with `sha256sum FILE` on Linux or `Get-FileHash FILE -Algorithm SHA256` in PowerShell.

## Cancellation and failures

1. Import a valid source and note its event count.
2. Start a substantially larger import and cancel while progress is advancing.
3. Confirm cancellation completes and the previous dataset is unchanged.
4. Attempt a gzip, ZIP, UTF-16, or EVTX file: expect an unsupported-format error.
5. Attempt a source containing a line larger than 1 MiB: expect a clear error and full rollback.
6. Check that imported source contents and modification time have not changed.

## Performance and offline operation

1. Record import duration for representative files and whether the interface responds while importing.
2. Record first and repeated searches, empty-result searches, warning filters, and deep-page navigation.
3. Observe RAM and temporary disk use; do not infer a process-wide limit from the database budget.
4. Install using the complete platform package and run while disconnected from the Internet.
5. Inspect process connections on each platform. Report application-originated external requests separately from operating-system/runtime activity.

## Acceptance record

```text
Build / commit:
Operating system:
CPU / RAM / storage:
Formats and sizes tested (no sensitive payloads):
Checks completed:
Performance observations:
Issues:
Decision: accepted / changes requested
```
