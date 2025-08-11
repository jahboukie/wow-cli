# WOW — AI-native coding toolbox (MVP)

Single CLI both agents and humans can run. Simple contracts, JSON-friendly output, and an append-only ledger.

Commands
- wow init — set up .wow and sanity-check git
- wow run <cmd> [--json] — run a shell command; JSON logs when --json
- wow apply [--from-file <path>] [-m <msg>] [--json] — apply unified diff, branch, commit via watchdog
- wow ledger [--tail] — print or stream ledger.ndjson
 - wow index [--json] — build a local symbol index
 - wow search <query> [--json] — search the index
 - wow fix-build [--json] [--min-score N] — run plan, execute, evaluate; optionally JSON and fail if score < N
 - wow add-feature [description...] [--json] [--min-score N] — scaffold tiny feature and evaluate
 - wow clean [--json] [--min-score N] — run cleanup/lint routine and evaluate
 - wow eval [--json] [--min-score N] — run evaluator only (useful in CI)

Design
- AI-native: stable JSON I/O, idempotent ops, atomic git patches
- Human-usable: clear text output by default, switchable to JSON
- Glass box: .wow/ledger.ndjson captures every action with timestamps

Evaluator
- Computes simple metrics for build/test and optional lint
- Outputs: text summary or `{"evaluator": { build, test, lint?, score }}` with --json
- Threshold: use `--min-score` on fix-build/add-feature/clean to set process exit code to 1 when below target (useful in CI)

CI
- GitHub Actions runs on Ubuntu and Windows with Node 22
- Builds, tests, and runs an evaluator step; see `.github/workflows/ci.yml`

MVP limitations
- Secrets scan is regex-based and conservative
- Diff apply expects standard unified diffs
 - Lint is optional and only runs when a config or npm script is present

