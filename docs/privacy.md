# Privacy and local data handling

## Application behavior

No log content, metadata, source hashes, queries, usage events, or crash reports are intentionally sent to an external service. All UI assets are packaged locally. No account, API key, cloud backend, analytics SDK, remote parser download, HTTP plugin, or application updater is present.

The Rust core disables DuckDB external file/network access and automatic extension installation/loading. It reads only the selected source through its own reader. The packaged webview's CSP allows only application resources and local IPC.

The browser preview is explicitly limited to a bundled synthetic fixture. It refuses local file imports and has no upload API. Browser network-request tests cover this preview; they do not prove native-process behavior on every platform.

## Local artifacts

The engine writes decoded events, original bytes, extracted fields, and query spill data into a unique `dfir-log-explorer-*` directory beneath the OS temporary directory. These files are not encrypted by the application. Use local storage appropriate for the sensitivity of your evidence; operating-system disk encryption is the initial protection at rest.

Normal engine teardown removes the temporary directory. A crash, power loss, or forced termination can leave files behind. MVP 0 does not automatically delete unidentified old directories. Deleting a file is not a guarantee of secure erasure on SSDs or backed-up filesystems.

Technical startup errors contain no log payloads. The UI displays import errors locally. The application does not create diagnostic files containing events or automatically upload debugging output.

## Operating-system boundary

The application does not control operating-system telemetry, crash dumps, antivirus submissions, synchronized temporary directories, backup software, or a shared WebView2 runtime's independent maintenance. The Windows package initially embeds the offline runtime installer rather than a fixed runtime. A native traffic audit and interactive platform testing are required before claiming a verified zero-egress runtime environment.

## Development and CI

Package downloads and public-source build artifacts can use npm, crates.io, Microsoft, and GitHub during development/building. These activities are separate from log analysis. CI tests use synthetic documentation-range addresses and `example.test`; real logs, credentials, and private cases must never be added to repository fixtures or workflow artifacts.
