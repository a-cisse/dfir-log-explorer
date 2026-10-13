# MVP 0 validation record

Recorded on 2026-10-13. These results apply to the recorded environment and synthetic workloads; they are not a comparison with commercial DFIR products. Live platform build status is available from the associated pull request's checks.

## Environment

- Ubuntu 24.04 x64 virtual machine, two vCPUs reported as AMD EPYC 9354P, approximately 8 GiB RAM, no swap.
- Local ext4 filesystem; physical storage characteristics were not established.
- Rust 1.99.0, Node.js 24.21.0, DuckDB Rust client 1.10506.0, Tauri 2.12.3.
- Engine budget: 512 MB for DuckDB's buffer manager, two DuckDB threads. This is not a process-wide memory limit.

## Executed checks

| Check                                                                      | Actual result                                                                                                           |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `cargo test --workspace --offline --locked`                                | Passed: 14 Rust tests; GUI test targets compiled, with no GUI unit tests                                                |
| `cargo clippy --workspace --all-targets --offline --locked -- -D warnings` | Passed, no warnings                                                                                                     |
| `cargo fmt --all --check`                                                  | Passed                                                                                                                  |
| `npm run build`                                                            | Passed: TypeScript checking and bundled production assets                                                               |
| `npm test`                                                                 | Passed: one browser-preview boundary test                                                                               |
| `npm run test:e2e`                                                         | Passed: three Chromium workflows                                                                                        |
| `npm run format:check`                                                     | Passed                                                                                                                  |
| Native Linux smoke                                                         | Passed on the final local binary with syscall tracing: real Rust import/query/detail, warning filter, and native bridge |
| Linux `.deb` packaging                                                     | Passed; the local acceptance package uses the debug profile                                                             |
| Windows build/acceptance                                                   | Pending repository workflow and interactive Windows testing                                                             |

Browser workflows cover literal case-insensitive search, preserved malformed events, cancellation, empty results, keyboard focus, theme switching, and untrusted HTML shown as text. No external requests were observed in those browser-preview paths.

The native test used a persistent HTTP WebDriver connection and syscall tracing. Only the local test-driver IP destination `127.0.0.1` was observed. This is workload-specific evidence, not an audit of every feature or Windows runtime behavior. No application security settings were disabled; software compositing was used for the headless display.

## Initial release-mode engine measurement (before pagination optimization)

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

## Larger workload and resulting improvements

The same generator was run with 10,000,000 events: 1,079,500,000 bytes (approximately 1,029.49 MiB). The initial run imported them in 66.993 seconds, but the final unfiltered page took 6,439 ms and peak engine RSS reached 742,132 KiB. That run used a 2 GiB virtual-address limit for the benchmark process.

Unfiltered pagination was changed to use the contiguous event-ID boundary instead of an SQL offset. Extracted strings in list responses were also bounded, while selected-event details keep the full values. A regression test verifies a small page payload for long HTTP paths/agents without losing their complete detail.

The subsequent release-mode run on the same synthetic workload, without a virtual-address limit, observed:

| Metric                           | Observed result                               |
| -------------------------------- | --------------------------------------------- |
| Events / source bytes            | 10,000,000 / 1,079,500,000                    |
| Engine import                    | 71.485 seconds; 139,889 events/s; 14.40 MiB/s |
| First page                       | 10 ms                                         |
| Repeated literal searches        | 24, 20, 21, 23, 24 ms                         |
| Final unfiltered page            | 4 ms                                          |
| Peak engine RSS                  | 259,732 KiB (approximately 253.6 MiB)         |
| Whole benchmark wall time / exit | 74.15 seconds / 0                             |

The navigation improvement is directly observed on this workload. Import-rate variation is not claimed as an improvement. The generated file is repetitive and cached; these results do not predict every real log workload. The input exceeds the database buffer budget, but remains smaller than physical RAM, so this is not a larger-than-RAM demonstration.

The local `.deb` is a debug acceptance build; it must not be attributed the release benchmark's throughput. Release installers are built by the active repository workflow. Human acceptance of MVP 0, including Windows/offline behavior, remains required before MVP 1 starts.
