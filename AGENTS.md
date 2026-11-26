# AI CLI Dashboard — development agent entry point

Goal: provide the agent-dashboard single-line status bar design in both Claude Code and Codex CLI. Do not create a separate window or service.

## Working rules
- Read docs/ROADMAP.md and docs/STATUS.md first, then select the first incomplete task. Read only that document and its direct prerequisite contracts.
- Do not perform large refactors before establishing the upstream fork baseline. Preserve existing user features.
- Do not invent fields or commands without checking the actual SDK/host schema. Hide unconfirmed data.
- Delegate tests and detailed implementation work to the assigned sub-agents. The parent agent reviews their changes and reported evidence. Record executed tests; never mark unexecuted validation as PASS.
- Small commits per task are recommended. Do not automatically push or publish.
- Write Git commit messages in English.
- Keep `docs/` local and ignored; do not add it to Git history.
- These documents describe a design; they do not imply implementation or completed tests.
- Use English for source identifiers, CLI messages and repository documentation. Provide Korean translation through the Pages language selector.

## Priorities
Safe configuration changes > host compatibility > original UX > feature count > visual identity.

## Initial setup
Initialize this project with an independent Git history and only the project's `origin` remote. Preserve the upstream source attribution and license in UPSTREAM.md and LICENSE. Keep planning documents under the ignored local docs/ directory. The assigned sub-agent checks package.json before running npm ci and the existing test commands.
