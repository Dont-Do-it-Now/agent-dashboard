---
name: agent-dashboard
description: Configure and explain the native Agent Dashboard integration for Codex CLI.
---

# Agent Dashboard for Codex

Use this skill when the user asks to install, configure, or inspect Agent Dashboard in Codex CLI.

## Supported behavior

- Keep the integration native to Codex CLI. Do not create a wrapper, daemon, supervisor, or external server.
- Explain that Codex plugin installation is performed by `codex plugin`, not `npx`.
- Use the repository's documented configuration and status commands only when they are supported by the installed Codex version.
- Do not invent token, quota, reset-time, or status fields that the host does not expose.
- The Codex footer provider is implemented through the official MCP statusline contract: `tools/list` advertises one `statusline` entrypoint and `resources/read` renders the thread snapshot.

## Setup guidance

1. Check the installed version with `codex --version`.
2. Check plugin support with `codex features list` and `codex plugin --help`.
3. Follow the repository README for the current Agent Dashboard setup steps.
4. Enable the official experimental host feature with `codex features enable tui_extensions_statusline` when it is not already enabled.
5. Select the installed `Agent Dashboard` provider once under `/statusline`; Codex persists that provider selection and polls it automatically for every displayed thread.
6. If a requested statusline or usage field is not exposed by the host, state that limitation and provide the manual configuration guidance instead.

## Safety

Never store credentials, OAuth tokens, or API keys in Agent Dashboard configuration. Preserve existing user settings and ask before replacing them.
