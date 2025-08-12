# WOW — AI-native coding toolbox (MVP)

Single CLI both agents and humans can run. Simple contracts, JSON-friendly output, and an append-only ledger.

## Tiers & Philosophy
WOW is open-source and we do NOT gate core functionality. Everything that makes the tool useful day‑to‑day is available in the free tier.

| Feature | Free | Sponsor | Sponsor Dev |
|---------|------|---------|-------------|
| All current non-experimental features | ✓ | ✓ | ✓ |
| Experimental / unstable previews | ✗ | ✗ | ✓ |

Sponsors fund maintenance & velocity — not access. Experimental items graduate to Free once stable.

Selecting a tier (optional):
1. Free (default) — nothing to do.
2. Sponsor — `{ "tier": "sponsor" }` in `.wow/license.json` (no extra features today; gratitude!)
3. Sponsor Dev — `{ "tier": "sponsor-dev" }` to opt into unstable experiments.

Check your current tier: `wow features` (add `--json`).

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
 - wow simulate-fix-build [--json] [--min-confidence N] [--preview] [--patch] [--summary-only] [--full-build] [--advice-limit N] — simulate fix-build in a temp copy; optional full npm install for realistic build; limit coaching items
 - wow simulate-add-feature [description...] [--json] [--min-confidence N] [--preview] [--patch] [--summary-only] [--full-build] [--advice-limit N] — simulate add-feature; same options
 - wow simulate-clean [--json] [--min-confidence N] [--preview] [--patch] [--summary-only] [--full-build] [--advice-limit N] — simulate clean; same options
 - wow verify [--json] [--story] [--report md] [--advice-limit N] — aggregate project health (build/test/lint/score); non-zero exit if build or test fail; --story gives a narrative summary; --report md prints a markdown report
 - Deltas: simulation & verify JSON outputs include scoreDelta / confidenceDelta once a prior run exists (persisted in .wow/state.json). verify --story and --report md also surface these deltas.
 - wow autofix [--json] — attempt lightweight automated fixes (build, lint --fix) and summarize

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
 - Phases: plan/execute/evaluate markers + verify:* phases for explain+ timeline

Evaluator
- Computes simple metrics for build/test and optional lint
- Outputs: text summary or `{"evaluator": { build, test, lint?, score }}` with --json
- Threshold: use `--min-score` on fix-build/add-feature/clean to set process exit code to 1 when below target (useful in CI)
 - Confidence: simulation commands compute a 0–100 confidence from evaluator score without modifying your working copy
 - Scoring model (MVP): build pass +15, test pass +30, lint pass +10 (lint fail is neutral initially; missing scripts/tools are skipped). Max = 55 (reported as maxScore). After 3 consecutive lint failures an adaptive gentle penalty (-5) is applied until lint passes (counter resets on success).
 - Adaptive lint penalty is configurable in `.wow/policy.json` via a `lintPenalty` block (optional):
	 ```jsonc
	 {
		 "lintPenalty": { "threshold": 3, "points": 5 }
	 }
	 ```
	 Fields:
	 - threshold: consecutive failing lint evaluations before applying the penalty (default 3)
	 - points: score points subtracted once threshold reached (default 5)
	 Penalty is removed (counter resets) after a successful lint pass.
 - Confidence = (score / 55)*100 capped at 100. Default policy minConfidence: 50 (tunable in `.wow/policy.json`).
 - Guidance: `verify`, `simulate-*`, and narrative modes emit `advice[]` + `nextStep` (JSON) or a short “Advice/Next:” section / story text (with --story) to coach non-experts.

Story / Narrative & Reports
- explain <last|run> --story: human-friendly recap of a run timeline.
- verify --story: narrative project health summary including score/maxScore, deltas (if prior run), key warnings, and next action.
- verify --report md: structured markdown report (Build/Test/Lint/Score, optional deltas, warnings, advice, next step) ideal for CI artifact or PR comment.

CI
- GitHub Actions runs on Ubuntu and Windows with Node 22
- Builds, tests, and runs an evaluator step; see `.github/workflows/ci.yml`

MVP limitations
- Secrets scan is regex-based and conservative
- Diff apply expects standard unified diffs
 - Lint is optional and only runs when a config or npm script is present. Repeated failures trigger a small adaptive score penalty to nudge cleanup without hard gating early attempts.
 - Sandbox: VM sandbox is for JS only; process sandbox uses allowlist+temp copy (not a kernel container)
 
Notes
- Run commands from the wow directory so .wow/policy.json is discovered:
	- cd ./wow
	- node ./dist/cli.js simulate-fix-build --preview --json
- State (.wow/state.json) stores lastScore, lastConfidence, and lintFailCount to compute deltas & adaptive lint penalty. Delete the file to reset.

## Privacy & Offline Guarantee
WOW is designed for fully local, air‑gapped friendly use:
- No telemetry, analytics, or external network calls
- No cloud functions or remote execution
- All evaluation, planning, simulation, and scanning happen on your machine
- Ledger, policy, and index stay in the repo under .wow/
- Secret scan never uploads findings; it only inspects your staged git diff locally

You can audit this: there are no imports of fetch/axios/http/https nor any telemetry SDKs in `src/`.

If you spot anything that could unexpectedly contact the network (even transitive), open an issue and it will be removed or made optional.

