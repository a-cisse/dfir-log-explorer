# MVP 0 validation record

Recorded on 2026-10-13. These results apply to the recorded environment and synthetic workloads; they are not a comparison with commercial DFIR products.

## Environment

- Ubuntu 24.04 x64 virtual machine, two vCPUs reported as AMD EPYC 9354P, approximately 8 GiB RAM, no swap.
- Local ext4 filesystem; physical storage characteristics were not established.
- Rust 1.99.0, Node.js 24.21.0, DuckDB Rust client 1.10506.0, Tauri 2.12.3.
- Engine budget: 512 MB for DuckDB's buffer manager, two DuckDB threads. This is not a process-wide memory limit.

## Executed checks

| Check                                                                      | Actual result                                                                                                         |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `cargo test --workspace --offline --locked`                                | Passed: 13 Rust tests; GUI test targets compiled, with no GUI unit tests                                              |
| `cargo clippy --workspace --all-targets --offline --locked -- -D warnings` | Passed, no warnings                                                                                                   |
| `cargo fmt --all --check`                                                  | Passed                                                                                                                |
| `npm run build`                                                            | Passed: TypeScript checking and bundled production assets                                                             |
| `npm test`                                                                 | Passed: one browser-preview boundary test                                                                             |
| `npm run test:e2e`                                                         | Passed: three Chromium workflows                                                                                      |
| `npm run format:check`                                                     | Passed                                                                                                                |
| Native Linux smoke                                                         | Passed without tracing: real Rust import/query/detail, warning filter, and native bridge (no browser-preview adapter) |
| Linux `.deb` packaging                                                     | Passed; the local acceptance package uses the debug profile                                                           |
| Windows build/acceptance                                                   | Pending repository workflow and interactive Windows testing                                                           |

Browser workflows cover literal case-insensitive search, preserved malformed events, cancellation, empty results, keyboard focus, theme switching, and untrusted HTML shown as text. No external requests were observed in those browser-preview paths.

Two earlier native attempts under syscall tracing lost their WebKit driver connection; those runs are not counted as passes. The smoke client was changed from urllib's close-after-request transport to a persistent HTTP connection to avoid intermediary connection-reuse races. The subsequent traced run passed, with only the local test-driver IP destination `127.0.0.1` observed. This is workload-specific evidence, not an audit of every feature or Windows runtime behavior. No application security settings were disabled for these tests; software compositing was used for the headless display.

## First release-mode engine measurement

```sh
cargo build -p dfir-log-core --example benchmark --release --locked
/usr/bin/time -v target/release/examples/benchmark 1000000
```

The local build used a separate target directory under `/tmp`; the workload and compiled release profile are the same as the documented command.

| Metric                              | Observed result                                       |
| ----------------------------------- | ----------------------------------------------------- |
| Events                              | 1,000,000, all recognized as Apache                   |
| Source bytes                        | 107,950,000 (approximately 102.95 MiB)                |
| Engine import time                  | 6.687 seconds                                         |
| Import throughput                   | 149,538 events/s; 15.39 MiB/s                         |
| First result page                   | 10 ms                                                 |
| Five repeated literal searches      | 7, 7, 7, 7, 7 ms                                      |
| Final page                          | 217 ms                                                |
| Peak engine-process resident memory | 335,568 KiB (approximately 327.7 MiB)                 |
| Whole benchmark wall time           | 7.21 seconds, including source generation and queries |
| Exit status                         | 0; imported and matched counts verified               |

The source contains repetitive fixed-width Apache events and two routes, with `/login` appearing in one percent of events. The generated source benefits from the OS page cache, and repetition improves database compression. Peak memory excludes the desktop/webview. Query times exclude IPC serialization and rendering. There is no cold-storage, mixed-format, larger-than-RAM, or product-to-product comparison in this result.

The local `.deb` is a debug acceptance build; it must not be attributed the release benchmark's throughput. Release installers are built by the repository workflow after activation. Human acceptance of MVP 0, including Windows/offline behavior, remains required before MVP 1 starts.
