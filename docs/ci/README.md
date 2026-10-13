# Desktop build verification

The active workflow is [mvp-0.yml](../../.github/workflows/mvp-0.yml). It runs on task-branch pushes and pull requests, with read-only repository permissions. Do not merge the pull request without human approval.

The interface job checks TypeScript, the production asset bundle, formatting, preview boundaries, and Chromium workflows. The desktop matrix builds on Ubuntu 24.04 and Windows 2025, runs workspace Rust tests and Clippy in release mode, and packages Linux `.deb` and Windows NSIS installers.

The workflow uses synthetic data only and retains platform build artifacts for 14 days. No credentials or private evidence are required or published. Build infrastructure can download public dependencies; application runtime and log processing remain local.

Open a successful workflow run and download `dfir-log-explorer-linux` or `dfir-log-explorer-windows` from its artifacts section. Extract the archive and follow the acceptance guide. Platform build success does not substitute for interactive Windows/Linux testing or an offline runtime audit.

See `docs/validation.md` for actual observed results. The initial local Linux package is a debug acceptance build; workflow installers use the release profile.
