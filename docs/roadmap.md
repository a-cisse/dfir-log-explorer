# Incremental delivery

Each MVP is delivered as an independently testable build with documented scope, checks, and limitations. The user tests and explicitly accepts it before the next MVP starts. Pull requests are never merged automatically.

| Step  | Scope                                                                                                                                    | Acceptance focus                                                          |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| MVP 0 | Temporary single-source sessions, text/Apache import, literal search, virtualized pages, raw detail, warnings, progress and cancellation | Correctness, usability, offline operation, first performance measurements |
| MVP 1 | Persistent cases, multiple sources, Nginx and JSON Lines, structured filters, date/time model                                            | Persistence, source management, query reliability                         |
| MVP 2 | Selected firewall/WAF/Syslog/HAProxy formats and necessary multiline handling                                                            | Verified format-specific extraction and diagnostics                       |
| MVP 3 | Interactive timelines, statistics and saved searches                                                                                     | Useful investigation workflows                                            |
| MVP 4 | Custom local parsing profiles with previews and versioning                                                                               | Importing a previously unsupported text format                            |
| MVP 5 | Measured large-volume optimization, resumable ingestion, compression and exports                                                         | Stability, resource use and throughput                                    |
| Later | Binary readers, correlations, annotations and additional validated requirements                                                          | Explicitly agreed features                                                |

The requested MVP 0 UI/UX redesign brings basic structured/status/time filters, global sorting, exact statistics and an interactive bounded timeline forward into MVP 0. Persistent cases, additional readers, saved searches and exports remain outside this redesign.

The sequence may be adjusted after MVP 0 feedback. Performance work is also permitted within each MVP when necessary to meet that MVP's acceptance criteria; it is not deferred wholesale to MVP 5.
