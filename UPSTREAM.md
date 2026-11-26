# Upstream baseline

- Project: https://github.com/Dont-Do-it-Now/agent-dashboard
- Maintainer: Reizeo <lugway@gmail.com>
- Upstream: https://github.com/uppinote20/claude-dashboard
- Imported commit: `24458736e52f900a34f2fd000bc11c629ed77e7b`
- Imported version: `1.36.0`
- License: MIT; the original copyright and full license remain in `LICENSE`.
- Import date: 2026-11-26

This project uses an independent Git history starting with a single initial
commit. The original upstream history, tags and remote references are not retained.
Only `origin` points to the project repository. Local planning documents remain
under the ignored `docs/` directory and are not included in Git history.
The pinned upstream SHA above records source provenance, not a commit in this
project's independent history.

## Source inventory

| Path | Purpose |
| --- | --- |
| `package.json`, `package-lock.json` | ESM TypeScript project and locked development dependencies |
| `scripts/statusline.ts` | Existing Claude status line entry point |
| `scripts/check-usage.ts` | Existing usage command |
| `scripts/widgets/`, `scripts/views/`, `scripts/utils/` | Widgets, pane views, host and data utilities |
| `scripts/mod/`, `types/` | Existing Claude mod and host declarations |
| `scripts/build.js` | esbuild bundling and plugin version synchronization |
| `dist/index.js`, `dist/check-usage.js`, `dist/mod.js` | Committed bundles; initial upstream import subsequently rebuilt for 1.36.1 |
| `.claude-plugin/`, `commands/`, `hooks/` | Existing marketplace metadata, commands and hooks |
| `scripts/__tests__/`, `vitest.config.ts` | Existing Vitest suite and fixtures |
| `website/` | Astro/Starlight documentation; English root and Korean `ko` locale |
| `README.md`, `CONTRIBUTING.md`, `LICENSE` | Original public documentation and license |
| `images/`, `demo.gif` | Original visual references; not screenshots of this fork |
| `.github/workflows/` | Inherited automation; not executed or accepted for this fork |

## Baseline evidence

Initial source import did not install dependencies, rebuild bundles, run tests or
launch the CLI. A validation sub-agent subsequently installed dependencies, rebuilt
1.36.1 and ran the Windows suite successfully. See `docs/STATUS.md` for counts,
platform skips and parent review. Actual CLI runtime acceptance remains pending.

The repository specifies `npm ci` and `npm test` for the baseline. Baseline results
must be recorded before T01 can be marked complete. The user's later instruction
authorizes sub-agents to run validation; the parent reviews their evidence and changes.

## Installation and automation constraints

- `scripts/statusline-shim.mjs` resolves bundles from
  `plugins/cache/claude-dashboard/claude-dashboard/<version>/dist/index.js`.
  Renaming marketplace/plugin IDs requires an explicit migration; changing only
  display metadata is insufficient.
- `hooks/ensure-statusline.mjs` migrates only recognized upstream version-pinned
  commands. It does not register a new status line for a manual clone. The manual
  path must be handled by the future installer.
- `hooks/hooks.json` invokes the migration on `SessionStart` and loads the
  existing mod. Installing the plugin can therefore affect later Claude sessions.
- `.github/workflows/release.yml` publishes a release on a `v*` tag push.
  Do not push release tags before reviewing this inherited publication behavior.
- The imported tree has no Pages deployment workflow. `website/astro.config.mjs`
  still targets the upstream custom domain; the fork needs its own site URL,
  repository base path and internal-link review before Pages deployment.
- No `.github/FUNDING.yml` was present in the imported tree. No AI sponsorship
  entry was added.

These are source observations, not results of installation or runtime checks.

## Fork conventions

- New source identifiers, CLI messages and repository documentation use English.
- Korean translation is provided through the Pages language selector.
- Preserve upstream plugin IDs and configuration compatibility until migration is implemented.
- Commits use `Reizeo <lugway@gmail.com>` as author and committer.
- Git commit messages use English. Keep only the project's `origin` remote.
- Do not add AI sponsor, contributor or `Co-Authored-By` attribution.
- Keep upstream copyright attribution; it is required by the imported license.
- No automatic push, package publication or release.
