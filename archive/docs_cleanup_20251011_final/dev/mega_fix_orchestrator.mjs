/**
 * MEGA FIX ORCHESTRATOR
 * 
 * Reads MEGA_DISCOVERY_REPORT.json and emits per-feature fix prompts.
 * No app code changes here—just generating human-ready, copy/paste prompts.
 */

import fs from 'fs';
import path from 'path';

const JSON_PATH = 'reports/MEGA_DISCOVERY_REPORT.json';
const OUT_DIR = 'reports/fix_prompts';
const OUT_MASTER = 'reports/MEGA_TEST_REPORT.v2.md';

function loadJSON(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function short(list, n = 3) {
  if (!list || list.length === 0) return '—';
  const arr = Array.isArray(list) ? list : [list];
  return arr.length > n ? `${arr.slice(0, n).join(', ')} …` : arr.join(', ');
}

function basename(p) {
  return p ? p.split(/[/\\]/).pop() : p;
}

function mdFixPromptForFeature(f) {
  const {
    key, status, confidence, flows = [],
    evidence = {}, counts = {}
  } = f;

  const allMarkers = [
    ...(evidence.markers || []),
  ];
  
  const todos = allMarkers.filter(m => /TODO/i.test(m));
  const stubs = allMarkers.filter(m => /STUB|DO NOT SHIP/i.test(m));
  const hasCandidates = (evidence.candidates || []).length > 0;

  // Heuristics → Fix tactics
  const tasks = [];

  // 1) Candidate promotion
  if (hasCandidates) {
    tasks.push({
      title: 'Promote candidate files',
      steps: (evidence.candidates || []).map(p => `Promote: \`${p}\` → replace live counterpart (backup old).`)
    });
  }

  // 2) Command/service parity
  if ((counts.commands || 0) === 0 && (counts.services || 0) > 0) {
    tasks.push({
      title: 'Create user-facing command shell',
      steps: [
        'Create a minimal plain-text slash command:',
        `- Path: \`src/commands/${key}/${key}.js\` (or similar)`,
        `- Register in \`src/commands/index.js\``,
        'Add rate limiting entry in \`src/middleware/RateLimiter.js\`',
        `- Wire to existing service(s): ${short(evidence.services || [])}`
      ]
    });
  }
  if ((counts.commands || 0) > 0 && (counts.services || 0) === 0 && (counts.tables || 0) > 0) {
    tasks.push({
      title: 'Add service layer for DB access',
      steps: [
        `Create \`src/services/${key}/${capitalize(key)}Service.js\` to wrap queries for: ${short(evidence.tables || [])}`,
        'Inject in \`src/services/index.js\` and import in the command',
        'Keep outputs plain text (no embeds)'
      ]
    });
  }

  // 3) DB present but no service
  if ((counts.tables || 0) > 0 && (counts.services || 0) === 0) {
    tasks.push({
      title: 'Bridge feature to database',
      steps: [
        `Map table(s): ${short(evidence.tables || [])}`,
        `Implement CRUD/query methods in \`src/services/${key}/${capitalize(key)}Service.js\``,
        `Call from commands/jobs: ${short([...(evidence.commands||[]), ...(evidence.jobs||[])], 4)}`
      ]
    });
  }

  // 4) TODO/STUB cleanup
  if (stubs.length) {
    tasks.push({
      title: 'Replace stub(s)',
      steps: stubs.slice(0, 5).map(s => `Replace stub: \`${s}\` with real implementation.`)
    });
  }
  if (todos.length) {
    tasks.push({
      title: 'Resolve TODOs',
      steps: todos.slice(0, 5).map(s => `Clear TODO: \`${s}\``)
    });
  }

  // 5) ENV linkage
  const uniqueEnv = Array.from(new Set(evidence.env || []));
  if (uniqueEnv.length) {
    tasks.push({
      title: 'ENV validation',
      steps: uniqueEnv.slice(0, 8).map(k => `Ensure \`${k}\` is present in \`.env\` (and documented in \`ENV_TEMPLATE.txt\`).`)
    });
  }

  // 6) Events/jobs glue
  if ((counts.jobs || 0) && !(counts.commands || 0)) {
    tasks.push({
      title: 'Expose admin runner for scheduled job',
      steps: [
        `Create \`/${key}-admin run [dry:true]\` to dry-run \`${short(evidence.jobs || [])}\` and print effects.`,
        'This accelerates QA without waiting for scheduler windows.'
      ]
    });
  }

  const primaryFlow = flows && flows.length ? flows[0] : '—';

  return `# 🧩 FIX PROMPT — ${key}

**Status:** ${status} • **Confidence:** ${confidence ?? 0}

**Primary Flow:** ${primaryFlow}

**Evidence**
- Commands: ${short(evidence.commands || [], 5)}
- Services: ${short(evidence.services || [], 5)}
- Tables: ${short(evidence.tables || [], 5)}
- Events: ${short(evidence.events || [], 5)}
- Jobs: ${short(evidence.jobs || [], 5)}
- Candidates: ${short(evidence.candidates || [], 6)}
- Markers: ${allMarkers.length} (TODO: ${todos.length}, STUB: ${stubs.length})

---

## 🎯 Targeted Tasks

${tasks.length ? tasks.map(renderTask).join('\n\n') : '_No actions required (PASS)._'}

---

## 📝 Counts Summary
- Commands: ${counts.commands ?? 0}
- Services: ${counts.services ?? 0}
- Tables: ${counts.tables ?? 0}
- Events: ${counts.events ?? 0}
- Jobs: ${counts.jobs ?? 0}
- ENV keys: ${uniqueEnv.length}
- Candidates: ${(evidence.candidates || []).length}
`;
}

function renderTask(t) {
  return `### ${t.title}
${t.steps.map(s => `- ${s}`).join('\n')}`;
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function makeMasterReport(features, data) {
  const pass = features.filter(f => f.status === 'PASS').length;
  const warn = features.filter(f => f.status === 'WARN').length;
  const fail = features.filter(f => f.status === 'FAIL').length;
  const skip = features.filter(f => f.status === 'SKIP').length;

  const rows = features.map(f => {
    const allMarkers = f.evidence?.markers || [];
    const todo = allMarkers.filter(x => /TODO/i.test(x)).length;
    const stub = allMarkers.filter(x => /STUB|DO NOT SHIP/i.test(x)).length;
    return `| ${f.key} | ${f.status} | ${f.confidence ?? 0} | ${f.counts?.commands ?? 0} | ${f.counts?.services ?? 0} | ${f.counts?.tables ?? 0} | ${f.counts?.events ?? 0} | ${f.counts?.jobs ?? 0} | ${todo} | ${stub} |`;
  }).join('\n');

  const actionIndex = features
    .filter(f => f.status !== 'PASS')
    .map(f => `- [${f.key}](./fix_prompts/${f.key}.md) — ${f.status} (conf ${f.confidence ?? 0})`)
    .join('\n');

  const flows = features
    .slice(0, 20) // Top 20 flows
    .map(f => `- **${f.key}** → ${f.flows?.[0] ?? '—'}`)
    .join('\n');

  // Extract migration gaps
  const migrationGaps = data.migrations?.gaps || [];
  const migrationSection = migrationGaps.length 
    ? migrationGaps.map(id => `- Missing migration: **${id}** — suggest: \`${id}_<meaningful_name>.sql\``).join('\n')
    : '_None detected._';

  // Extract ENV delta
  const envMissing = data.env?.missing || [];
  const envSection = envMissing.length
    ? envMissing.map(k => `- Add to .env: \`${k}=REPLACE_ME\``).join('\n')
    : '_All used ENV keys are documented in template._';

  // Build hotspots from marker data
  const fileMarkerCounts = new Map();
  for (const f of features) {
    for (const cmd of (f.evidence?.commands || [])) {
      if (!fileMarkerCounts.has(cmd)) fileMarkerCounts.set(cmd, { path: cmd, todo: 0, stub: 0 });
    }
    for (const svc of (f.evidence?.services || [])) {
      if (!fileMarkerCounts.has(svc)) fileMarkerCounts.set(svc, { path: svc, todo: 0, stub: 0 });
    }
    
    const markers = f.evidence?.markers || [];
    for (const m of markers) {
      // Markers might be strings like "file:line: TODO text"
      // For now, attribute to all files in this feature
      const allFiles = [
        ...(f.evidence?.commands || []),
        ...(f.evidence?.services || []),
        ...(f.evidence?.jobs || [])
      ];
      
      for (const file of allFiles) {
        const entry = fileMarkerCounts.get(file);
        if (entry) {
          if (/TODO/i.test(m)) entry.todo++;
          if (/STUB|DO NOT SHIP/i.test(m)) entry.stub++;
        }
      }
    }
  }
  
  const hotspots = Array.from(fileMarkerCounts.values())
    .filter(h => h.todo > 0 || h.stub > 0)
    .sort((a, b) => (b.todo + b.stub) - (a.todo + a.stub))
    .slice(0, 10);

  const hotspotsSection = hotspots.length
    ? hotspots.map(h => `- \`${h.path}\` → TODO: ${h.todo}, STUB: ${h.stub}`).join('\n')
    : '_No TODO/STUB markers detected._';

  return `# 🧪 MEGA TEST REPORT — v2

**Generated:** ${new Date().toISOString()}

**Features:** ${features.length} • ✅ PASS: ${pass} • ⚠️ WARN: ${warn} • ❌ FAIL: ${fail} • ⏸️ SKIP: ${skip}

> Auto-generated from MEGA_DISCOVERY_REPORT.json by mega_fix_orchestrator.mjs

---

## 📊 Executive Summary

This report synthesizes automated codebase discovery into actionable fix prompts.

**Status Distribution:**
- **PASS (${pass})**: Complete features with command + service + no critical markers
- **WARN (${warn})**: Partial implementations, backend-only, or minor TODOs
- **FAIL (${fail})**: Missing core pieces or broken imports (mostly utils/config—expected)
- **SKIP (${skip})**: Event handlers and low-confidence inference artifacts

**Key Metrics:**
- Total commands: ${features.reduce((sum, f) => sum + (f.counts?.commands ?? 0), 0)}
- Total services: ${features.reduce((sum, f) => sum + (f.counts?.services ?? 0), 0)}
- Total tables: ${Array.from(new Set(features.flatMap(f => f.evidence?.tables || []))).length}
- Migration gaps: ${migrationGaps.length}

---

## 📚 Auto-Discovered Features

| Feature | Status | Conf | Cmds | Svcs | Tables | Evts | Jobs | TODOs | STUBs |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${rows}

---

## 🧭 Primary Flows (Top 20)

${flows}

---

## 🛠️ Actionable Fixes Index

Each WARN/FAIL feature has a dedicated fix prompt with targeted tasks.

${actionIndex || '_None_ (All features PASS).'}

---

## 🧱 Migration Gaps

${migrationSection}

---

## 🔑 ENV Delta

${envSection}

---

## 🔥 Hotspots (TODO/STUB heavy files)

${hotspotsSection}

---

## 🎯 Next Steps

1. Review individual fix prompts in \`reports/fix_prompts/<feature>.md\`
2. Address FAIL features first (missing critical wiring)
3. Promote candidate files where applicable
4. Clear TODO/STUB markers in hotspot files
5. Fill migration gaps with meaningful schemas
6. Validate all ENV keys are set in \`.env\`

---

**How to use this report:**
- Each feature link above points to a precise, copy-paste-ready fix prompt
- Prompts include file paths, exact steps, and guardrails
- Run \`node scripts/dev/mega_discovery.mjs\` after fixes to verify progress
`;
}

(function main() {
  console.log('🛠️  MEGA FIX ORCHESTRATOR\n');

  const data = loadJSON(JSON_PATH);
  const features = data.features || [];

  console.log(`📊 Loaded ${features.length} features from ${JSON_PATH}`);

  ensureDir(OUT_DIR);

  // Write per-feature prompts
  let promptCount = 0;
  for (const f of features) {
    const file = path.join(OUT_DIR, `${f.key}.md`);
    fs.writeFileSync(file, mdFixPromptForFeature(f), 'utf-8');
    promptCount++;
  }

  // Write master v2 report
  fs.writeFileSync(OUT_MASTER, makeMasterReport(features, data), 'utf-8');

  console.log(`✅ Wrote ${promptCount} fix prompts → ${OUT_DIR}/`);
  console.log(`✅ Master report → ${OUT_MASTER}`);
  console.log(`\n📄 Quick preview: head -50 ${OUT_MASTER}`);
})();


