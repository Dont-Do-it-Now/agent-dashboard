---
title: Commands
description: All available command reference
sidebar:
  order: 1
---

agent-dashboard provides six commands for setup, usage checking, shell integration, and updating.

## /agent-dashboard:setup

Configure the status line display mode, language, plan, and theme.

### Usage

```bash
# Interactive mode (asks questions)
/agent-dashboard:setup

# Direct mode with arguments
/agent-dashboard:setup [displayMode] [language] [plan] ["customWidgets"]
```

### Arguments

| Argument | Options | Default | Description |
|----------|---------|---------|-------------|
| displayMode | `compact`, `normal`, `detailed`, `custom` | `compact` | Number of lines and widget selection |
| language | `auto`, `en`, `ko` | `auto` | UI language |
| plan | `max`, `ultra`, `pro` | `max` | Subscription plan (affects available rate limit widgets) |
| customWidgets | `"widget1,widget2\|widget3"` | -- | Custom layout (only for `custom` mode) |

### Examples

```bash
/agent-dashboard:setup                          # Interactive
/agent-dashboard:setup compact                  # 1 line, defaults
/agent-dashboard:setup normal en pro            # 2 lines, English, Pro
/agent-dashboard:setup detailed ko max          # 6 lines, Korean, Max
/agent-dashboard:setup custom auto max "model,context,cost|projectInfo,todoProgress"
```

### Notes

- The status line updates on the next message after setup
- Run this command again at any time to change settings
- Interactive mode is best for preset selection; for full widget control, use direct mode or edit the JSON file directly

## /agent-dashboard:check-usage

Check usage limits for all installed AI CLIs and get a recommendation for which one has the most available capacity.

### Usage

```bash
/agent-dashboard:check-usage              # Interactive output with colors
/agent-dashboard:check-usage --json       # JSON output for scripting
/agent-dashboard:check-usage --lang ko    # Specify language
/agent-dashboard:check-usage --lang en    # Specify language
```

### Output

Shows usage for each installed CLI:

- **Claude**: 5h and 7d rate limits with reset times
- **Codex**: Rate limits with plan info, if installed — each window is labeled by its actual duration (5h + 7d on Plus, a single 7d on Pro)
- **Gemini**: Usage percentage with model info (if installed)
- **Antigravity**: Weekly quota per model family — Gemini vs Claude+GPT (if installed)
- **z.ai**: Token and MCP usage with model info (if configured)

At the bottom, recommends the CLI with the lowest current usage.

## /agent-dashboard:setup-alias

Add a `check-ai` shell alias to quickly check all AI CLI usage from your terminal. Supports macOS/Linux (zsh/bash) and Windows (PowerShell).

### Usage

```bash
/agent-dashboard:setup-alias
```

### After Setup

Once the alias is installed, you can run it directly from your terminal (outside of Claude Code):

```bash
check-ai          # Pretty output
check-ai --json   # JSON output for scripting
```

### Platform Support

- **macOS / Linux**: Adds a shell function to `~/.zshrc` or `~/.bashrc`
- **Windows**: Adds a PowerShell function to your PowerShell profile

### Notes

- The function dynamically finds the latest plugin version, so it continues to work after updates
- Run this command again if you need to reinstall the alias
- The alias works independently of Claude Code

## /agent-dashboard:update

Repair or verify the statusLine shim (usually automatic).

### Usage

```bash
/agent-dashboard:update
```

### When to Use

Normally unnecessary — `statusLine` points at a permanent shim path
(`plugins/data/agent-dashboard-agent-dashboard/statusline.mjs`) that resolves the newest
installed build on every render, so a `SessionStart` hook keeps it current automatically after
`/plugin update agent-dashboard`. Run this command only if you have hooks disabled or the
status line is not updating.

### What It Does

1. Installs or refreshes the shim at the permanent data-directory path and points
   `statusLine` in `settings.json` at it — `$CLAUDE_CONFIG_DIR/settings.json` if that
   variable is set, `~/.claude/settings.json` otherwise
2. Reports which build the shim currently resolves to

If `settings.json` changed, it takes effect at your next interaction with Claude Code — no
restart is needed.

## /agent-dashboard-pane

Open or close a pane beside the transcript (mod, tested on Claude Code 2.1.289). Takes `on`, `off`, a view name, or no argument to flip the current state (the last view is kept). A view name opens the pane on that view, or switches an open pane in place.

```bash
/agent-dashboard-pane on
/agent-dashboard-pane off
/agent-dashboard-pane      # no argument: flip the current state
/agent-dashboard-pane turns   # dashboard | turns | agents | files | todos | errors | bg
```

Views: `dashboard` (sectioned overview, default), `turns` (per-prompt tokens/tools), `agents` (subagents), `files` (files edited), `todos`, `errors` (failed tool calls), `bg` (background jobs). The view lasts for the session only. For the `dashboard` view, the `modPane` config key switches it to widget lines (unset = the overview). See [Mods](/guides/mods/) for details on each view.

## /agent-dashboard-band

Draw the dashboard above the prompt and hide the status line for the current session only.

```bash
/agent-dashboard-band on
/agent-dashboard-band off
/agent-dashboard-band      # no argument: flip the current state
```

Layout comes from `modBand` (default: your status line layout). Set `"modBandDefault": true` to turn it on at session start. `settings.json` is never modified. See [Mods](/guides/mods/).
