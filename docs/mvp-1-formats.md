# MVP 1 readers and date rules

All readers consume uncompressed UTF-8 text one line at a time. Every source line is retained, with source ID, source-local line number, byte offset and original bytes. Invalid UTF-8 generates a warning without discarding evidence.

## Nginx access

The explicit Nginx reader supports the standard Common/Combined access layout, including IPv6/host addresses, quoted/escaped request fields, optional byte counts and Combined referrer/user-agent fields. Its [standard Combined layout](https://nginx.org/en/docs/http/ngx_http_log_module.html#log_format) overlaps Apache Combined: auto mode identifies these rows as Apache-compatible access records, not as proof of which server produced them. Select Nginx explicitly to label them Nginx. Arbitrary custom `log_format`, error logs and multiline events need later readers/profiles. Escaped access strings are preserved without decoding.

## JSON Lines objects

[JSON Lines](https://jsonlines.org/) permits any JSON value per line. This MVP deliberately accepts the object subset for structured logs. Arrays, scalar values, blank lines and malformed JSON produce an Unparsed event with a warning; nothing is silently skipped. A valid object with invalid known fields is Partial; valid fields remain extracted. Duplicate top-level keys produce a Partial diagnostic; normalized values use the last occurrence, while raw evidence retains every occurrence. Nested objects use the JSON decoder’s last-key behavior. Unknown fields and nested objects/arrays remain available in the inspector and raw log.

| Normalized field | Accepted top-level aliases, in priority order                                                 |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Timestamp        | `timestamp`, `@timestamp`, `time_iso8601`, `time`, `time_local`; alternatively `timestamp_ms` |
| Client IP / host | `sourceIp`, `source_ip`, `remote_addr`, `client_ip`                                           |
| Method           | `method`, `request_method`                                                                    |
| Path             | `path`, `request_uri`, `url`                                                                  |
| Protocol         | `protocol`, `server_protocol`                                                                 |
| HTTP status      | `status`                                                                                      |
| Response bytes   | `responseBytes`, `response_bytes`, `body_bytes_sent`                                          |
| Referrer         | `referrer`, `http_referer`                                                                    |
| User agent       | `userAgent`, `user_agent`, `http_user_agent`                                                  |

The first non-null alias wins; other original values remain available for inspection. `request` can extract method/path/protocol when all three normalized fields are absent. HTTP statuses must be integers between 100 and 599; response bytes must be nonnegative integers. Integer strings are also accepted. Missing/null optional values are valid absences. Nested fields are not automatically normalized.

Top-level strings, numbers and booleans support exact JSON filters. Values use decoded strings or JSON scalar text (for example `true` or `401`); nested values/null are not indexed as scalars. Field names and values are bound parameters, not SQL expressions. Global search includes decoded scalar values, so escaped strings remain searchable. Full JSON objects appear only in selected-event details, not in list pages.

## Date and time

Access dates use their explicit numeric offset. JSON text dates accept RFC 3339 with an explicit offset or the standard access-log date format. `timestamp_ms` means integer milliseconds since the Unix epoch, always UTC. Numeric timestamps in generic `timestamp` are rejected; units are never guessed.

The engine retains a normalized ISO timestamp with its source offset and the corresponding UTC milliseconds. Timeline, sorting and inclusive-start/exclusive-end filters compare UTC instants across sources. Missing and invalid timestamps are excluded from ranges/timeline and can be selected with the timestamp-presence filter. A malformed preferred text timestamp never silently falls back to `timestamp_ms`. No source timezone override is implemented.
