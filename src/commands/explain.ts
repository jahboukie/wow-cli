import fs from 'fs-extra';
import path from 'path';

type LedgerEntry = { ts: string; kind: string; runId?: string; data: any };

function parseLines(lines: string[]): LedgerEntry[] {
  return lines.map(l => { try { return JSON.parse(l); } catch { return null as any; } }).filter(Boolean);
}

function groupByRun(entries: LedgerEntry[]) {
  const groups: Record<string, LedgerEntry[]> = {};
  let legacyCounter = 0;
  for (const e of entries) {
    const id = e.runId || `legacy-${legacyCounter}`;
    if (!e.runId) legacyCounter = 1; // all legacy lumped
    groups[id] = groups[id] || [];
    groups[id].push(e);
  }
  return groups;
}

interface ExplainOpts { json?: boolean; run?: string; story?: boolean; }

function extractCommandArg(e: LedgerEntry): string | undefined {
  return e.data?.argv?.[0];
}

export async function explainCommand(which: 'last'|'run'|'list', opts: ExplainOpts) {
  const file = path.join(process.cwd(), '.wow', 'ledger.ndjson');
  if (!(await fs.pathExists(file))) {
    if (opts.json) console.log(JSON.stringify({ ok: false, error: 'no-ledger' })); else console.log('No ledger.');
    return;
  }
  const content = await fs.readFile(file, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);
  const entries = parseLines(lines);
  const grouped = groupByRun(entries);
  if (which === 'list') {
    const runs = Object.entries(grouped).map(([id, evts]) => {
      const start = evts.find(e => e.data?.msg === 'run.start');
      const end = evts.find(e => e.data?.msg === 'run.end');
      return {
        runId: id,
        started: start?.ts,
        durationMs: end?.data?.durationMs,
        command: start ? (extractCommandArg(start) || 'unknown') : 'unknown'
      };
    }).sort((a,b)=> (a.started||'').localeCompare(b.started||''));
    if (opts.json) console.log(JSON.stringify({ ok:true, runs }));
    else runs.slice(-20).forEach(r => console.log(`${r.runId}  ${r.started}  ${r.command}  ${r.durationMs??'-'}ms`));
    return;
  }
  let runId: string | undefined;
  if (which === 'last') {
    const reversed = entries.slice().reverse();
    // Prefer the most recent non-explain run if current run is an explain invocation without run.end yet
    let candidate = reversed.find(e => e.data?.msg === 'run.start');
    if (candidate && extractCommandArg(candidate) === 'explain') {
      candidate = reversed.find(e => e.data?.msg === 'run.start' && extractCommandArg(e) !== 'explain');
    }
    runId = opts.run || candidate?.runId;
    if (!runId) runId = Object.keys(grouped).pop();
  } else {
    runId = opts.run;
  }
  if (!runId || !grouped[runId]) {
    if (opts.json) console.log(JSON.stringify({ ok:false, error:'run-not-found', runId })); else console.log('Run not found');
    return;
  }
  const evts = grouped[runId];
  const startEvt = evts.find(e => e.data?.msg === 'run.start');
  const endEvt = evts.find(e => e.data?.msg === 'run.end');
  const command = startEvt?.data?.argv?.[0] || 'unknown';
  const started = startEvt?.ts;
  const durationMs = endEvt?.data?.durationMs;
  const evaluatorEvt = evts.find(e => e.data?.msg === 'evaluator.summary');
  // Phase reconstruction
  const phases: { name: string; start?: string; end?: string; durationMs?: number; meta?: any }[] = [];
  const phaseStarts: Record<string, LedgerEntry> = {};
  for (const e of evts) {
    if (e.data?.msg === 'phase.start') phaseStarts[e.data.phase] = e;
    if (e.data?.msg === 'phase.end') {
      const start = phaseStarts[e.data.phase];
      phases.push({
        name: e.data.phase,
        start: start?.ts,
        end: e.ts,
        durationMs: start && e.ts ? (new Date(e.ts).getTime() - new Date(start.ts).getTime()) : undefined,
        meta: { ...e.data }
      });
    }
  }
  const gitCommits = evts.filter(e => e.kind === 'git.commit').length;
  const runs = evts.filter(e => e.kind === 'run').map(r => ({ cmd: r.data?.cmd, code: r.data?.code }));
  const writes = evts.filter(e => e.data?.msg === 'write').map(w => w.data?.file);
  const summary = {
    runId,
    command,
    started,
    durationMs,
    commits: gitCommits,
    runs,
    writes,
    evaluator: evaluatorEvt?.data?.summary,
    phases: phases.length ? phases : undefined,
  };
  if (opts.json) {
    console.log(JSON.stringify({ ok: true, explain: summary }));
    return;
  }

  // Standard tabular output (non-story)
  if (!opts.story) {
    console.log(`Run ${runId}`);
    if (started) console.log(` started: ${started}`);
    if (durationMs != null) console.log(` duration: ${durationMs}ms`);
    console.log(` command: ${command}`);
    console.log(` commits: ${gitCommits}`);
    if (writes.length) console.log(' writes:');
    for (const f of writes) console.log(`  - ${f}`);
    if (runs.length) console.log(' run steps:');
    for (const r of runs) console.log(`  - ${r.cmd} (code=${r.code})`);
    if (summary.evaluator) console.log(` evaluator: score=${summary.evaluator.score}`);
    return;
  }

  // Narrative story mode
  const storyLines: string[] = [];
  const startedDt = started ? new Date(started) : undefined;
  const durSec = durationMs != null ? (durationMs/1000).toFixed(1) : undefined;
  storyLines.push(`Run ${runId} (${command})${startedDt ? ' began ' + startedDt.toISOString() : ''}${durSec ? ' and finished in ' + durSec + 's' : ''}.`);
  if (phases.length) {
    // Sort phases by start
    const ordered = phases.slice().sort((a,b)=> (a.start||'').localeCompare(b.start||''));
    const phaseSummaries = ordered.map(p => {
      const pdur = p.durationMs != null ? `${(p.durationMs/1000).toFixed(1)}s` : 'unknown time';
      return `${p.name} (${pdur})`;
    });
  storyLines.push(`It progressed through ${phaseSummaries.length} phase${phaseSummaries.length===1?'':'s'}: ${phaseSummaries.join(', ')}.`);
  }
  if (writes.length) storyLines.push(`It wrote ${writes.length} file${writes.length===1?'':'s'}: ${writes.slice(0,5).join(', ')}${writes.length>5? ' and more':''}.`);
  if (gitCommits) storyLines.push(`Git activity: ${gitCommits} commit${gitCommits===1?'':''}.`);
  if (runs.length) {
    const failed = runs.filter(r=> r.code !== 0).length;
  storyLines.push(`Executed ${runs.length} shell step${runs.length===1?'':'s'}${failed?`, with ${failed} failing`:''}.`);
  }
  if (summary.evaluator) {
    const score = summary.evaluator.score;
  storyLines.push(`Evaluator scored the run at ${score} (scale 0-${summary.evaluator.maxScore ?? 'N/A'}).`);
  }
  if (!summary.evaluator && runs.length) {
  storyLines.push('No evaluator summary was recorded for this run.');
  }
  // Light interpretation / next hint
  if (summary.evaluator?.score != null) {
    const score = summary.evaluator.score as number;
    if (score < (summary.evaluator.maxScore? summary.evaluator.maxScore*0.3 : 20)) {
  storyLines.push('Next: consider running verify for a detailed health report.');
    } else if (score < (summary.evaluator.maxScore? summary.evaluator.maxScore*0.7 : 40)) {
  storyLines.push('Next: you could improve the score by addressing remaining build/test/lint gaps.');
    } else {
  storyLines.push('Next: looks solid — proceed to add-feature or clean for incremental improvements.');
    }
  }
  console.log(storyLines.join('\n'));
}
