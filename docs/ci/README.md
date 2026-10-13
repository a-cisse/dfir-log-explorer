# Activating desktop build verification

The repository's existing Git authentication rejected a task-branch push containing `.github/workflows/mvp-0.yml`, because its token lacks the `workflow` scope. The application is delivered on a clean branch without any workflow-file changes in its ancestry. The original local development branch is retained; no published history or credential configuration was rewritten.

The ready-to-use workflow is [mvp-0.yml](mvp-0.yml). An authorized maintainer can add it through GitHub's web interface, or copy it with their normal workflow-capable authentication:

```sh
mkdir -p .github/workflows
cp docs/ci/mvp-0.yml .github/workflows/mvp-0.yml
```

Commit that file to the task branch and open or update its pull request. Do not merge without human approval. Do not send credentials or tokens through chat, commit them, or add them to the workflow.

The workflow runs interface checks and release-mode Rust checks, then builds `.deb` and Windows NSIS packages. It uses synthetic data only and publishes build artifacts for 14 days. This is build infrastructure; application runtime and log processing remain local.

Until it is activated, Windows build results and downloadable CI installers are unavailable. Local build and acceptance commands are documented in the project README.
