# Incremental delivery

Each MVP is delivered as an independently testable build with documented scope, checks, and limitations. The user tests and explicitly accepts it before the next MVP starts. Pull requests are never merged automatically.

| Step  | Scope                                                                                                                                    | Acceptance focus                                                          |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| MVP 0 | Temporary single-source sessions, text/Apache import, literal search, virtualized pages, raw detail, warnings, progress and cancellation | Correctness, usability, offline operation, first performance measurements |
| MVP 1 | Persistent cases, multiple sources, Nginx and JSON Lines, structured filters, date/time model                                            | Persistence, source management, query reliability                         |
| MVP 2 | Netfilter/iptables, Syslog RFC 5424/BSD, HAProxy HTTP and native ModSecurity 2.x multiline audit                                         | Verified format-specific extraction and diagnostics                       |
| MVP 3 | Interactive timelines, statistics and saved searches                                                                                     | Useful investigation workflows                                            |
| MVP 4 | Custom local parsing profiles with previews and versioning                                                                               | Importing a previously unsupported text format                            |
| MVP 5 | Measured large-volume optimization, resumable ingestion, compression and exports                                                         | Stability, resource use and throughput                                    |
| Later | Binary readers, correlations, annotations and additional validated requirements                                                          | Explicitly agreed features                                                |

The requested MVP 0 UI/UX redesign brings basic structured/status/time filters, global sorting, exact statistics and an interactive bounded timeline forward into MVP 0. Persistent cases, additional readers, saved searches and exports remain outside this redesign.

The sequence may be adjusted after MVP 0 feedback. Performance work is also permitted within each MVP when necessary to meet that MVP's acceptance criteria; it is not deferred wholesale to MVP 5.

## Current delivery

MVP 0 was explicitly accepted on 2026-10-13. MVP 1 and the README/Statistics PRs (#3, #4, #5) are merged into `main`. On 2026-10-15 the user requested proceeding to MVP 2 after checking integration; `main` and `origin/main` matched `bb51d38`, with no open PR awaiting integration.

MVP 2 v0.3.0 adds four explicit readers, bounded native ModSecurity audit framing, physical source-line ranges, reader attributes in the inspector and combined scalar filters. See the [format contract](mvp-2-formats.md), [acceptance guide](mvp-2-acceptance.md) and [validation record](mvp-2-validation.md). MVP 2 requires human review and acceptance before MVP 3 begins. The compact default workspace and the Statistics improvements from PR #5 remain the starting interface.
