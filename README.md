# WOW — AI-native coding toolbox (MVP)

Single CLI both agents and humans can run. Simple contracts, JSON-friendly output, and an append-only ledger.

Commands
- wow init — set up .wow and sanity-check git
- wow run <cmd> [--json] — run a shell command; JSON logs when --json
- wow apply [--from-file <path>] [-m <msg>] [--json] — apply unified diff, branch, commit via watchdog
- wow ledger [--tail] — print or stream ledger.ndjson

Design
- AI-native: stable JSON I/O, idempotent ops, atomic git patches
- Human-usable: clear text output by default, switchable to JSON
- Glass box: .wow/ledger.ndjson captures every action with timestamps

MVP limitations
- Secrets scan is regex-based and conservative
- Diff apply expects standard unified diffs

