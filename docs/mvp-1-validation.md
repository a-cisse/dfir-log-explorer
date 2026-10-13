# MVP 1 validation record

Recorded on 2026-10-13 for version 0.2.0 on the same Ubuntu 24.04 x64 VPS used for MVP 0. Rust 1.99.0, Node.js 24.21.0, DuckDB Rust client 1.10506.0 and Tauri 2.12.3. Tests use synthetic evidence only.

## Local checks

| Check                                 | Actual result                                                                                                                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust workspace tests                  | Passed: 26 tests, including seven new case/format regressions; desktop test targets compile                                                                                                                |
| Workspace Clippy with warnings denied | Passed                                                                                                                                                                                                     |
| Rust formatting                       | Passed                                                                                                                                                                                                     |
| TypeScript and production asset build | Passed                                                                                                                                                                                                     |
| Browser-preview unit tests            | Passed: three tests, including persistent-case/native boundaries and combined filters                                                                                                                      |
| Chromium workflows                    | Passed: eight workflows, including case controls, provenance and timestamp-presence filters                                                                                                                |
| Linux debug `.deb` packaging          | Passed: version 0.2.0 package, approximately 26.65 MiB                                                                                                                                                     |
| Native Linux MVP 1 smoke              | Passed with real save/open dialogs and source selection: persisted synthetic sample plus Nginx/JSON Lines imports, close/reopen, complete metadata, cross-source UTC/JSON filters and inspector provenance |

The native smoke uses `tests/native_cases.py`, a virtual X display, DBus and tauri-driver. It verifies the production Rust handlers and the real React/IPC import flow; no production file access is enabled for the webview. X11 keyboard input is test-only, used to operate native dialogs. Software compositing was enabled for the virtual display; application security settings were retained.

The core tests cover refusal to overwrite, rejection of non-case/missing/unknown-version files, exact source-local positions and raw bytes after reopening, append/rollback metadata/cache/IDs, independent JSON field validation, duplicate top-level keys, invalid/ambiguous dates, timestamp units, decoded escaped-value searches and bounded page payloads. Saved cases have no application encryption or source-removal/migration implementation.

## Representative release measurement

```sh
cargo build -p dfir-log-core --example benchmark --release --offline --locked
/usr/bin/time -v target/release/examples/benchmark 1000000
```

The local compiled release example used `/tmp/dfir-release-target` as its target directory. On a repetitive synthetic Apache source:

| Metric                 | Observed result                              |
| ---------------------- | -------------------------------------------- |
| Events / source bytes  | 1,000,000 / 107,950,000                      |
| Import                 | 7.167 seconds; 139,525 events/s; 14.36 MiB/s |
| First page             | 53 ms                                        |
| Literal searches       | 25, 8, 9, 8, 7 ms                            |
| Last unfiltered page   | 2 ms                                         |
| Peak engine RSS        | 251,220 KiB (about 245 MiB)                  |
| Whole benchmark / exit | 7.54 seconds / 0                             |

An initial MVP 1 measurement exposed an unnecessary JSON search join in cases containing no JSON fields and the cost of a full event-ID uniqueness index. The final implementation maintains event-ID uniqueness through serialized transactional allocation, retains only the source metadata primary key, and selects the simpler search predicate when no JSON attributes exist. Reopened cases and committed appends establish that state; failed imports cannot change it. The figures above apply to that final implementation.

These measurements exclude native UI/IPC and save-copy time, use repetitive/cached input and are not mixed-format, larger-than-RAM or product-comparison benchmarks. They do not establish a global process-memory limit or predict all real workloads.

## Platform delivery and acceptance

The [MVP 1 workflow](../.github/workflows/mvp-1.yml) runs interface checks and builds/tests/packages Linux and Windows independently. Its live run is the authoritative record for platform CI results and downloadable release installers. Interactive Windows acceptance and a new native/offline traffic audit were not performed locally. MVP 0 acceptance is recorded in the roadmap; MVP 1 still requires explicit human acceptance before MVP 2 begins.
