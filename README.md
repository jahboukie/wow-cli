# WOW — AI-native coding toolbox (MVP)

Single CLI both agents and humans can run. Simple contracts, JSON-friendly output, and an append-only ledger.

Commands
- wow init — set up .wow and sanity-check git
- wow run <cmd> [--json] — run a shell command; JSON logs when --json
	- add --sandbox to run in a soft sandbox (temp copy + allowlist + timeout)
- wow apply [--from-file <path>] [-m <msg>] [--json] — apply unified diff, branch, commit via watchdog
- wow ledger [--tail] — print or stream ledger.ndjson
 - wow index [--json] — build a local symbol index
 - wow search <query> [--json] — search the index
 - wow fix-build [--json] [--min-score N] — run plan, execute, evaluate; optionally JSON and fail if score < N (or policy default)
 - wow add-feature [description...] [--json] [--min-score N] — scaffold tiny feature and evaluate (honors policy default)
 - wow clean [--json] [--min-score N] — run cleanup/lint routine and evaluate (honors policy default)
 - wow eval [--json] [--min-score N] — run evaluator only (useful in CI; honors policy default)
 - wow simulate <file> [--timeout ms] [--json] — run a JS module exporting async main() in a restricted VM
 - wow simulate-fix-build [--json] [--min-confidence N] [--preview] [--patch] [--summary-only] — simulate fix-build in a temp copy; show change summary/diff or confidence metrics
 - wow simulate-add-feature [description...] [--json] [--min-confidence N] [--preview] [--patch] [--summary-only] — simulate add-feature; show change summary/diff or confidence metrics
 - wow simulate-clean [--json] [--min-confidence N] [--preview] [--patch] [--summary-only] — simulate clean; show change summary/diff or confidence metrics

Policy (.wow/policy.json)
- Controls defaults for simulate-first and thresholds.
- Example:

	{
		"simulateFirst": true,
		"minConfidence": 90,
		"minScore": 25,
		"commands": {
			"fix-build": { "simulateFirst": true },
			"add-feature": { "simulateFirst": true },
			"clean": { "simulateFirst": true }
		}
	}

- When simulateFirst is enabled, fix-build/add-feature/clean auto-run the corresponding simulate-* command and abort if confidence < minConfidence.
- After execution, fix-build/add-feature/clean/eval fail (exit code 1) if evaluator score < minScore (CLI flag overrides; policy provides default).

Design
- AI-native: stable JSON I/O, idempotent ops, atomic git patches
- Human-usable: clear text output by default, switchable to JSON
- Glass box: .wow/ledger.ndjson captures every action with timestamps

Evaluator
- Computes simple metrics for build/test and optional lint
- Outputs: text summary or `{"evaluator": { build, test, lint?, score }}` with --json
- Threshold: use `--min-score` on fix-build/add-feature/clean to set process exit code to 1 when below target (useful in CI)
 - Confidence: simulation commands compute a 0–100 confidence from evaluator score without modifying your working copy

CI
- GitHub Actions runs on Ubuntu and Windows with Node 22
- Builds, tests, and runs an evaluator step; see `.github/workflows/ci.yml`

MVP limitations
- Secrets scan is regex-based and conservative
- Diff apply expects standard unified diffs
 - Lint is optional and only runs when a config or npm script is present
 - Sandbox: VM sandbox is for JS only; process sandbox uses allowlist+temp copy (not a kernel container)
 
Notes
- Run commands from the wow directory so .wow/policy.json is discovered:
	- cd ./wow
	- node ./dist/cli.js simulate-fix-build --preview --json

