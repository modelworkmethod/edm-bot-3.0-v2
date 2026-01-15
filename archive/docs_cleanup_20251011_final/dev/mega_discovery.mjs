#!/usr/bin/env node
/**
 * MEGA DISCOVERY RUNNER
 * Dynamic feature discovery, flow mapping, and health diagnostics
 * 
 * Usage:
 *   node scripts/dev/mega_discovery.mjs
 *   node scripts/dev/mega_discovery.mjs --dry=false --log=true
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Parse CLI args
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, val] = arg.replace(/^--/, '').split('=');
  acc[key] = val === 'false' ? false : val === 'true' ? true : val || true;
  return acc;
}, {});

const CONFIG = {
  dry: args.dry !== false, // Default true
  json: args.json !== false, // Default true
  log: args.log === true, // Default false
  maxFiles: parseInt(args.maxFiles) || 5000
};

// Logger
function log(msg, data = null) {
  if (CONFIG.log) {
    console.log(`[MEGA] ${msg}`, data || '');
  }
}

function info(msg) {
  console.log(`ℹ️  ${msg}`);
}

function warn(msg) {
  console.log(`⚠️  ${msg}`);
}

function error(msg) {
  console.log(`❌ ${msg}`);
}

// ============================================================================
// UTILITIES
// ============================================================================

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeFileSafe(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
  info(`Written: ${path.relative(PROJECT_ROOT, filePath)}`);
}

function listFiles(root, patterns = [], max = 5000) {
  const files = [];
  const queue = [root];
  const exclude = /node_modules|\.git|backups|tmp|archive|\.bak/;

  while (queue.length > 0 && files.length < max) {
    const dir = queue.shift();
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (exclude.test(fullPath)) continue;
        
        if (entry.isDirectory()) {
          queue.push(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (patterns.length === 0 || patterns.some(p => ext === p)) {
            files.push(fullPath);
          }
        }
      }
    } catch (e) {
      // Skip unreadable directories
    }
  }

  return files;
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return null;
  }
}

function grep(patterns, files) {
  const results = [];
  
  for (const file of files) {
    const content = readFileSafe(file);
    if (!content) continue;
    
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          results.push({
            file: path.relative(PROJECT_ROOT, file),
            line: idx + 1,
            text: line.trim(),
            pattern: pattern.source
          });
        }
      }
    });
  }
  
  return results;
}

// ============================================================================
// PARSERS
// ============================================================================

function quickParseCommands(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return null;

  const nameMatch = content.match(/\.setName\(['"]([^'"]+)['"]\)/);
  const descMatch = content.match(/\.setDescription\(['"]([^'"]+)['"]\)/);
  const options = [...content.matchAll(/\.addStringOption|\.addIntegerOption|\.addBooleanOption|\.addUserOption/g)].length;

  return {
    name: nameMatch ? nameMatch[1] : null,
    description: descMatch ? descMatch[1] : null,
    hasOptions: options > 0,
    optionCount: options
  };
}

function quickParseExports(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return [];

  const exports = [];
  const patterns = [
    /module\.exports\s*=\s*(\w+)/,
    /exports\.(\w+)/,
    /export\s+(class|function|const)\s+(\w+)/
  ];

  for (const pattern of patterns) {
    const matches = content.matchAll(new RegExp(pattern, 'g'));
    for (const match of matches) {
      exports.push(match[match.length - 1]);
    }
  }

  return [...new Set(exports)];
}

function parseMigrations(migrationsDir) {
  const migrations = [];
  
  try {
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && !f.includes('.bak'))
      .sort();

    for (const file of files) {
      const content = readFileSafe(path.join(migrationsDir, file));
      if (!content) continue;

      const idMatch = file.match(/^(\d+)/);
      const tables = {
        creates: [...content.matchAll(/CREATE TABLE[^(]*\(?\s*(\w+)/gi)].map(m => m[1]),
        alters: [...content.matchAll(/ALTER TABLE\s+(\w+)/gi)].map(m => m[1]),
        drops: [...content.matchAll(/DROP TABLE\s+(\w+)/gi)].map(m => m[1])
      };

      migrations.push({
        id: idMatch ? parseInt(idMatch[1]) : null,
        file,
        tables
      });
    }

    // Detect gaps
    const ids = migrations.map(m => m.id).filter(id => id !== null).sort((a, b) => a - b);
    const gaps = [];
    for (let i = 0; i < ids.length - 1; i++) {
      if (ids[i + 1] - ids[i] > 1) {
        gaps.push(`${ids[i]} → ${ids[i + 1]}`);
      }
    }

    return { migrations, gaps };
  } catch (e) {
    return { migrations: [], gaps: [] };
  }
}

function envScan(srcFiles) {
  const envKeys = new Set();
  
  for (const file of srcFiles) {
    const content = readFileSafe(file);
    if (!content) continue;
    
    const matches = content.matchAll(/process\.env\.(\w+)/g);
    for (const match of matches) {
      envKeys.add(match[1]);
    }
  }

  // Load ENV_TEMPLATE
  const templatePath = path.join(PROJECT_ROOT, 'ENV_TEMPLATE.txt');
  const templateKeys = new Set();
  const templateContent = readFileSafe(templatePath);
  
  if (templateContent) {
    const lines = templateContent.split('\n');
    for (const line of lines) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
      if (match) templateKeys.add(match[1]);
    }
  }

  // Load .env if exists
  const envPath = path.join(PROJECT_ROOT, '.env');
  const envKeys2 = new Set();
  const envContent = readFileSafe(envPath);
  
  if (envContent) {
    const lines = envContent.split('\n');
    for (const line of lines) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
      if (match) envKeys2.add(match[1]);
    }
  }

  const missing = [...envKeys].filter(k => !templateKeys.has(k) && !envKeys2.has(k));

  return {
    used: [...envKeys],
    inTemplate: [...templateKeys],
    inEnv: [...envKeys2],
    missing
  };
}

// ============================================================================
// FEATURE CLUSTERER
// ============================================================================

class FeatureClusterer {
  constructor({ files, imports, envRefs, migrations, events, jobs, log = false }) {
    this.files = files || [];
    this.imports = imports || [];
    this.envRefs = envRefs || new Map();
    this.migrations = migrations || [];
    this.events = events || [];
    this.jobs = jobs || [];
    this.log = log;
    this.features = new Map();
  }

  cluster() {
    // Group files by feature key
    for (const f of this.files) {
      // Normalize: f can be string or { path, markers, kind }
      const filePath = typeof f === 'string' ? f : (f.path || f.file || f);
      const markers = (typeof f === 'object' && Array.isArray(f.markers)) ? f.markers : [];
      const kind = (typeof f === 'object' && f.kind) ? f.kind : this._kindFromPath(filePath);
      
      const key = this._featureKeyFromPath(filePath);
      if (!key) continue;
      
      const node = this._ensure(key);
      node.files.add(filePath);
      node.kinds.add(kind);
      
      // Store markers per file
      if (markers.length > 0) {
        node.evidence.markers.push(...markers);
      }
    }

    // Attach evidence
    this._attachEvidence();
    
    // Score and status
    this._scoreAll();
    
    // Derive flows
    this._deriveFlows();

    // Return sorted
    return [...this.features.values()].sort((a, b) => b.confidence - a.confidence);
  }

  _ensure(key) {
    if (!this.features.has(key)) {
      this.features.set(key, {
        key,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        files: new Set(),
        kinds: new Set(),
        evidence: {
          commands: [],
          services: [],
          jobs: [],
          events: [],
          tables: [],
          env: [],
          markers: [],
          candidates: []
        },
        confidence: 0,
        status: 'WARN',
        statusReason: '',
        flows: []
      });
    }
    return this.features.get(key);
  }

  _kindFromPath(p) {
    if (p.includes('/commands/')) return 'command';
    if (p.includes('/services/')) return 'service';
    if (p.includes('/jobs/')) return 'job';
    if (p.includes('/events/')) return 'event';
    if (p.includes('/database/migrations/')) return 'migration';
    if (p.includes('/config/')) return 'config';
    return 'other';
  }

  _featureKeyFromPath(p) {
    const segs = p.split(/[/\\]+/);
    
    // Priority 1: Explicit feature folders in commands/services/jobs
    const iCmd = segs.indexOf('commands');
    const iSvc = segs.indexOf('services');
    const iJobs = segs.indexOf('jobs');
    
    if (iCmd >= 0 && segs[iCmd + 1]) {
      return this._normalizeKey(segs[iCmd + 1]);
    }
    
    if (iSvc >= 0 && segs[iSvc + 1]) {
      return this._normalizeKey(segs[iSvc + 1]);
    }
    
    if (iJobs >= 0) {
      const filename = segs[segs.length - 1].replace(/\.(js|mjs|ts)$/, '');
      // duelsFinalizer.js → duels
      const match = filename.match(/^([a-z]+)/i);
      if (match) return this._normalizeKey(match[1]);
    }

    // Priority 2: Migration table stems
    if (p.includes('/migrations/')) {
      const filename = segs[segs.length - 1];
      // 006_add_dueling_system.sql → dueling
      const match = filename.match(/add_([a-z]+)_/i);
      if (match) return this._normalizeKey(match[1]);
      
      // Or first table name hint
      const content = readFileSafe(p);
      if (content) {
        const tableMatch = content.match(/CREATE TABLE[^(]*\(?([a-z_]+)/i);
        if (tableMatch) {
          const tableName = tableMatch[1];
          const stem = tableName.split('_')[0];
          return this._normalizeKey(stem);
        }
      }
    }

    // Priority 3: Filename stem
    const filename = segs[segs.length - 1].replace(/\.(js|mjs|ts|sql)$/, '');
    return this._normalizeKey(filename);
  }

  _normalizeKey(s) {
    if (!s) return null;
    
    const x = s
      .toLowerCase()
      .replace(/\.candidate$/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Skip generic names
    if (!x || ['index', 'util', 'utils', 'handler', 'base'].includes(x)) {
      return null;
    }
    
    return x;
  }

  _attachEvidence() {
    for (const [key, node] of this.features) {
      // Files are already strings in node.files Set
      const fileArray = [...node.files];
      
      // Commands - files in commands/ directory
      node.evidence.commands = fileArray.filter(f => f.includes('commands'));

      // Services - files in services/ directory
      node.evidence.services = fileArray.filter(f => f.includes('services'));

      // Jobs - files in jobs/ directory
      node.evidence.jobs = fileArray.filter(f => f.includes('jobs'));

      // Events - files in events/ directory
      node.evidence.events = fileArray.filter(f => f.includes('events'));

      // Candidates - *.candidate.* files
      node.evidence.candidates = fileArray.filter(f => f.includes('.candidate.'));

      // Tables from migrations - match by feature key or table name
      for (const mig of this.migrations) {
        const tables = [
          ...(mig.tables?.creates || []),
          ...(mig.tables?.alters || [])
        ];
        
        // Match tables that start with feature key or contain it
        const matching = tables.filter(t => {
          const tLower = t.toLowerCase();
          return tLower.startsWith(key) || 
                 tLower.includes(`_${key}_`) || 
                 tLower === key ||
                 tLower.replace(/_/g, '') === key.replace(/-/g, '');
        });
        
        node.evidence.tables.push(...matching);
      }

      // Deduplicate
      node.evidence.tables = [...new Set(node.evidence.tables)];
      node.evidence.markers = [...new Set(node.evidence.markers)];
    }
  }

  _scoreAll() {
    for (const node of this.features.values()) {
      let score = 0;
      
      const hasCmd = node.evidence.commands.length > 0;
      const hasSvc = node.evidence.services.length > 0;
      const hasMig = node.evidence.tables.length > 0;
      const hasEvt = node.evidence.events.length > 0;
      const hasJob = node.evidence.jobs.length > 0;
      const hasStub = node.evidence.markers && node.evidence.markers.some(m => /STUB|DO NOT SHIP/i.test(m));
      const hasTodo = node.evidence.markers && node.evidence.markers.some(m => /TODO/i.test(m));
      
      if (hasCmd) score += 0.4;
      if (hasSvc) score += 0.3;
      if (hasMig) score += 0.2;
      if (hasEvt) score += 0.05;
      if (hasJob) score += 0.05;
      if (hasStub) score -= 0.2;
      if (hasTodo) score -= 0.05;

      node.confidence = Math.max(0, Math.min(1, score));

      // Compute counts for easy reference
      node.counts = {
        commands: node.evidence.commands.length,
        services: node.evidence.services.length,
        jobs: node.evidence.jobs.length,
        events: node.evidence.events.length,
        tables: node.evidence.tables.length,
        env: new Set(node.evidence.env).size,
        candidates: node.evidence.candidates.length,
        markers: node.evidence.markers.length
      };

      // Status rules
      if (hasStub) {
        node.status = 'WARN';
        node.statusReason = 'STUB marker found';
      } else if (hasCmd && hasSvc) {
        node.status = 'PASS';
        node.statusReason = 'Command + Service implemented';
      } else if (hasCmd && !hasSvc) {
        node.status = 'WARN';
        node.statusReason = 'Missing service';
      } else if (!hasCmd && hasSvc) {
        node.status = 'WARN';
        node.statusReason = 'Missing command';
      } else if (hasMig || hasEvt || hasJob) {
        node.status = 'SKIP';
        node.statusReason = 'Infrastructure/backend only';
      } else {
        node.status = 'FAIL';
        node.statusReason = 'No components detected';
      }
    }
  }

  _deriveFlows() {
    for (const node of this.features.values()) {
      const parts = [];
      
      if (node.evidence.commands.length > 0) {
        parts.push(`User → /${node.key}`);
      } else if (node.evidence.services.length > 0) {
        parts.push(`Service-only feature`);
      }
      
      if (node.evidence.services.length > 0) {
        const svcNames = node.evidence.services
          .map(s => path.basename(s, '.js'))
          .slice(0, 2)
          .join(', ');
        const more = node.evidence.services.length > 2 ? '...' : '';
        parts.push(`→ ${node.evidence.services.length} service(s): ${svcNames}${more}`);
      }
      
      if (node.evidence.tables.length > 0) {
        const tables = node.evidence.tables.slice(0, 3).join(', ');
        const more = node.evidence.tables.length > 3 ? '...' : '';
        parts.push(`→ tables: [${tables}${more}]`);
      }
      
      if (node.evidence.events.length > 0) {
        parts.push(`→ ${node.evidence.events.length} event(s)`);
      }
      
      if (node.evidence.jobs.length > 0) {
        const jobNames = node.evidence.jobs.map(j => path.basename(j, '.js')).join(', ');
        parts.push(`→ jobs: ${jobNames}`);
      }

      node.flows = parts.length > 0 ? [parts.join(' ')] : ['No flow inferred'];
      node.primaryFlow = node.flows[0];
    }
  }
}

// ============================================================================
// FEATURE INFERENCE ENGINE
// ============================================================================

function inferFeatures(discovery) {
  const features = new Map();

  // Tokenize and cluster
  function getFeatureKey(filePath) {
    const parts = filePath.split(/[\/\\]/);
    
    // Check for feature folders in commands/services/jobs
    for (let i = 0; i < parts.length; i++) {
      if (['commands', 'services', 'jobs'].includes(parts[i]) && parts[i + 1]) {
        return parts[i + 1].toLowerCase();
      }
    }
    
    // Fallback to filename
    const filename = parts[parts.length - 1].replace(/\.(js|mjs|ts)$/, '');
    return filename.toLowerCase();
  }

  // Seed from commands
  for (const cmd of discovery.commands) {
    const key = getFeatureKey(cmd.file);
    if (!features.has(key)) {
      features.set(key, {
        key,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        commands: [],
        services: [],
        jobs: [],
        migrations: [],
        events: [],
        markers: [],
        envNeeds: [],
        confidence: 0
      });
    }
    
    const feature = features.get(key);
    feature.commands.push(cmd);
    feature.confidence += 0.4;
  }

  // Seed from services
  for (const svc of discovery.services) {
    const key = getFeatureKey(svc.file);
    if (!features.has(key)) {
      features.set(key, {
        key,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        commands: [],
        services: [],
        jobs: [],
        migrations: [],
        events: [],
        markers: [],
        envNeeds: [],
        confidence: 0
      });
    }
    
    const feature = features.get(key);
    feature.services.push(svc);
    feature.confidence += 0.4;
  }

  // Add jobs
  for (const job of discovery.jobs) {
    const key = getFeatureKey(job.file);
    if (features.has(key)) {
      features.get(key).jobs.push(job);
      features.get(key).confidence += 0.1;
    }
  }

  // Add migrations by table name
  for (const mig of discovery.migrationsData.migrations) {
    for (const table of [...mig.tables.creates, ...mig.tables.alters]) {
      const tableKey = table.toLowerCase().split('_')[0];
      if (features.has(tableKey)) {
        features.get(tableKey).migrations.push(mig);
        features.get(tableKey).confidence += 0.2;
      }
    }
  }

  // Add markers
  for (const marker of discovery.markers) {
    const key = getFeatureKey(marker.file);
    if (features.has(key)) {
      features.get(key).markers.push(marker);
      if (marker.text.includes('STUB') || marker.text.includes('DO NOT SHIP')) {
        features.get(key).confidence -= 0.2;
      }
    }
  }

  // Calculate status
  for (const [key, feature] of features) {
    const hasCommand = feature.commands.length > 0;
    const hasService = feature.services.length > 0;
    const hasMigrations = feature.migrations.length > 0;
    const hasStub = feature.markers.some(m => m.text.includes('STUB'));

    if (hasStub) {
      feature.status = 'WARN';
      feature.statusReason = 'STUB marker found';
    } else if (hasCommand && hasService) {
      feature.status = 'PASS';
      feature.statusReason = 'Command + Service implemented';
    } else if (hasCommand || hasService) {
      feature.status = 'WARN';
      feature.statusReason = hasCommand ? 'Missing service' : 'Missing command';
    } else {
      feature.status = 'SKIP';
      feature.statusReason = 'Infrastructure only';
    }

    feature.confidence = Math.max(0, Math.min(1, feature.confidence)).toFixed(2);
  }

  return features;
}

// ============================================================================
// MAIN DISCOVERY
// ============================================================================

async function runDiscovery() {
  console.log('🔍 MEGA DISCOVERY RUNNER\n');
  console.log(`Config: dry=${CONFIG.dry}, json=${CONFIG.json}, log=${CONFIG.log}, maxFiles=${CONFIG.maxFiles}\n`);

  const startTime = Date.now();

  // A. Environment
  info('Loading environment...');
  const envFile = path.join(PROJECT_ROOT, '.env');
  const hasEnv = fs.existsSync(envFile);
  log(`Has .env: ${hasEnv}`);

  // B. File Crawl
  info('Crawling codebase...');
  const srcFiles = listFiles(path.join(PROJECT_ROOT, 'src'), ['.js', '.mjs', '.ts'], CONFIG.maxFiles);
  log(`Found ${srcFiles.length} source files`);

  // C. Static Analysis
  info('Analyzing structure...');

  const discovery = {
    srcFiles: srcFiles.map(f => path.relative(PROJECT_ROOT, f)),
    commands: [],
    services: [],
    jobs: [],
    events: [],
    migrationsData: { migrations: [], gaps: [] },
    env: {},
    markers: []
  };

  // Commands
  const commandFiles = srcFiles.filter(f => f.includes('commands') && !f.endsWith('index.js'));
  for (const file of commandFiles) {
    const parsed = quickParseCommands(file);
    if (parsed && parsed.name) {
      discovery.commands.push({
        file: path.relative(PROJECT_ROOT, file),
        ...parsed
      });
    }
  }
  log(`Found ${discovery.commands.length} commands`);

  // Services
  const serviceFiles = srcFiles.filter(f => f.includes('services') && !f.endsWith('index.js'));
  for (const file of serviceFiles) {
    const exports = quickParseExports(file);
    discovery.services.push({
      file: path.relative(PROJECT_ROOT, file),
      exports
    });
  }
  log(`Found ${discovery.services.length} services`);

  // Jobs
  const jobFiles = srcFiles.filter(f => f.includes('jobs'));
  for (const file of jobFiles) {
    const exports = quickParseExports(file);
    discovery.jobs.push({
      file: path.relative(PROJECT_ROOT, file),
      exports
    });
  }
  log(`Found ${discovery.jobs.length} jobs`);

  // Events
  const eventFiles = srcFiles.filter(f => f.includes('events'));
  for (const file of eventFiles) {
    discovery.events.push({
      file: path.relative(PROJECT_ROOT, file)
    });
  }
  log(`Found ${discovery.events.length} event handlers`);

  // Migrations
  const migrationsDir = path.join(PROJECT_ROOT, 'src/database/migrations');
  if (fs.existsSync(migrationsDir)) {
    discovery.migrationsData = parseMigrations(migrationsDir);
    log(`Found ${discovery.migrationsData.migrations.length} migrations, ${discovery.migrationsData.gaps.length} gaps`);
  }

  // ENV scan
  discovery.env = envScan(srcFiles);
  log(`Found ${discovery.env.used.length} env keys used, ${discovery.env.missing.length} missing from template`);

  // Markers
  const markerPatterns = [
    /TEMP STUB/i,
    /DO NOT SHIP/i,
    /TODO:/i,
    /not implemented/i,
    /\.candidate\./
  ];
  discovery.markers = grep(markerPatterns, srcFiles);
  log(`Found ${discovery.markers.length} markers`);

  // D. Feature Inference
  info('Inferring features...');
  
  // Use enhanced clusterer
  const clusterer = new FeatureClusterer({
    files: discovery.srcFiles.map(f => ({ path: f })),
    imports: [],
    envRefs: new Map(),
    migrations: discovery.migrationsData.migrations.map((m, i) => ({
      ...m,
      rawPath: path.join(PROJECT_ROOT, 'src/database/migrations', m.file)
    })),
    events: discovery.events,
    jobs: discovery.jobs,
    log: CONFIG.log
  });
  
  const features = clusterer.cluster();
  log(`Inferred ${features.length} feature clusters`);

  // E. Generate Report
  info('Generating reports...');
  
  const report = generateMarkdownReport(features, discovery);
  writeFileSafe(path.join(PROJECT_ROOT, 'reports/MEGA_DISCOVERY_REPORT.md'), report);

  if (CONFIG.json) {
    const json = generateJSONReport(features, discovery);
    writeFileSafe(path.join(PROJECT_ROOT, 'reports/MEGA_DISCOVERY_REPORT.json'), JSON.stringify(json, null, 2));
  }

  const csv = generateCSV(features);
  writeFileSafe(path.join(PROJECT_ROOT, 'scripts/dev/mega_matrix.csv'), csv);

  const elapsed = Date.now() - startTime;
  
  // Self-check
  const statusCounts = {};
  for (const feat of features) {
    statusCounts[feat.status] = (statusCounts[feat.status] || 0) + 1;
  }

  console.log(`\n✅ Discovery complete in ${elapsed}ms\n`);
  console.log(`📊 Features Discovered: ${features.length}`);
  console.log(`   ✅ PASS: ${statusCounts.PASS || 0}`);
  console.log(`   ⚠️  WARN: ${statusCounts.WARN || 0}`);
  console.log(`   ❌ FAIL: ${statusCounts.FAIL || 0}`);
  console.log(`   ⏸️  SKIP: ${statusCounts.SKIP || 0}\n`);

  if (features.length === 0) {
    warn('No features inferred. Check _featureKeyFromPath() patterns and source roots.');
  } else {
    console.log('🏆 Top 5 by Confidence:');
    features.slice(0, 5).forEach((f, i) => {
      console.log(`   ${i + 1}. ${f.name} [${f.status}] (${f.confidence})`);
    });
    console.log('');
  }

  console.log('📄 Reports generated:');
  console.log('   - reports/MEGA_DISCOVERY_REPORT.md');
  if (CONFIG.json) console.log('   - reports/MEGA_DISCOVERY_REPORT.json');
  console.log('   - scripts/dev/mega_matrix.csv');
  console.log('\n📚 Usage:');
  console.log('   node scripts/dev/mega_discovery.mjs');
  console.log('   node scripts/dev/mega_discovery.mjs --dry=false --log=true');
}

// ============================================================================
// REPORT GENERATORS
// ============================================================================

function generateMarkdownReport(features, discovery) {
  let md = '# 🔍 MEGA DISCOVERY REPORT\n\n';
  md += `**Generated:** ${new Date().toISOString()}\n`;
  md += `**Files Scanned:** ${discovery.srcFiles.length}\n`;
  md += `**Features Inferred:** ${features.length}\n\n`;
  md += '---\n\n';

  // Executive Summary
  md += '## 1. EXECUTIVE SUMMARY\n\n';
  md += '| Status | Count |\n';
  md += '|--------|-------|\n';
  
  const statusCounts = {};
  for (const feat of features) {
    statusCounts[feat.status] = (statusCounts[feat.status] || 0) + 1;
  }
  
  md += `| ✅ PASS | ${statusCounts.PASS || 0} |\n`;
  md += `| ⚠️ WARN | ${statusCounts.WARN || 0} |\n`;
  md += `| ❌ FAIL | ${statusCounts.FAIL || 0} |\n`;
  md += `| ⏸️ SKIP | ${statusCounts.SKIP || 0} |\n\n`;

  // Auto-Discovered Features
  md += '## 2. AUTO-DISCOVERED FEATURES\n\n';
  md += '| Feature | Status | Conf | Cmds | Svcs | Tables | Events | Jobs |\n';
  md += '|---------|--------|------|------|------|--------|--------|------|\n';
  
  for (const feat of features) {
    md += `| ${feat.name} | ${feat.status} | ${feat.confidence} | ${feat.evidence.commands.length} | ${feat.evidence.services.length} | ${feat.evidence.tables.length} | ${feat.evidence.events.length} | ${feat.evidence.jobs.length} |\n`;
  }
  md += '\n';

  const sorted = features;

  for (const feat of sorted) {
    md += `### ${feat.name} [${feat.status}] (${feat.confidence} confidence)\n\n`;
    md += `**Status:** ${feat.statusReason}\n`;
    md += `**Flow:** ${feat.flows[0] || 'No flow'}\n\n`;
    
    if (feat.evidence.commands.length > 0) {
      md += `**Commands:** ${feat.evidence.commands.length}\n`;
      feat.evidence.commands.forEach(c => md += `  - ${c}\n`);
      md += '\n';
    }
    
    if (feat.evidence.services.length > 0) {
      md += `**Services:** ${feat.evidence.services.length}\n`;
      feat.evidence.services.forEach(s => md += `  - ${s}\n`);
      md += '\n';
    }
    
    if (feat.evidence.tables.length > 0) {
      md += `**Tables:** ${feat.evidence.tables.length}\n`;
      feat.evidence.tables.forEach(t => md += `  - ${t}\n`);
      md += '\n';
    }
    
    if (feat.evidence.jobs.length > 0) {
      md += `**Jobs:** ${feat.evidence.jobs.length}\n`;
      feat.evidence.jobs.forEach(j => md += `  - ${j}\n`);
      md += '\n';
    }
    
    if (feat.evidence.markers.length > 0) {
      md += `**⚠️ Markers:** ${feat.evidence.markers.length}\n`;
      feat.evidence.markers.slice(0, 3).forEach(m => md += `  - ${m}\n`);
      md += '\n';
    }

    md += '---\n\n';
  }

  // Missing/Broken
  md += '## 3. MISSING / BROKEN\n\n';
  const warnings = sorted.filter(f => f.status === 'WARN' || f.status === 'FAIL');
  
  if (warnings.length === 0) {
    md += '✅ No critical issues detected.\n\n';
  } else {
    for (const feat of warnings) {
      md += `### ${feat.name} - ${feat.status}\n`;
      md += `**Reason:** ${feat.statusReason}\n\n`;
    }
  }

  // ENV Diff
  md += '## 4. ENV DIFF\n\n';
  md += `**Keys Used in Code:** ${discovery.env.used.length}\n`;
  md += `**Keys in ENV_TEMPLATE:** ${discovery.env.inTemplate.length}\n`;
  md += `**Keys in .env:** ${discovery.env.inEnv.length}\n\n`;
  
  if (discovery.env.missing.length > 0) {
    md += `**⚠️ Missing from Template (${discovery.env.missing.length}):**\n`;
    discovery.env.missing.forEach(k => md += `- ${k}\n`);
    md += '\n';
  }

  // Migrations
  md += '## 5. MIGRATIONS AUDIT\n\n';
  md += `**Total Migrations:** ${discovery.migrationsData.migrations.length}\n`;
  if (discovery.migrationsData.gaps.length > 0) {
    md += `**⚠️ Gaps:** ${discovery.migrationsData.gaps.join(', ')}\n`;
  } else {
    md += `**✅ No gaps detected**\n`;
  }
  md += '\n';

  // Markers Summary
  md += '## 6. MARKERS SUMMARY\n\n';
  md += `**Total Markers:** ${discovery.markers.length}\n\n`;
  const byType = {};
  for (const m of discovery.markers) {
    const type = m.pattern.includes('STUB') ? 'STUB' :
                 m.pattern.includes('TODO') ? 'TODO' :
                 m.pattern.includes('candidate') ? 'CANDIDATE' :
                 m.pattern.includes('not implemented') ? 'NOT_IMPLEMENTED' : 'OTHER';
    byType[type] = (byType[type] || 0) + 1;
  }
  
  for (const [type, count] of Object.entries(byType)) {
    md += `- ${type}: ${count}\n`;
  }
  md += '\n';

  md += '---\n\n';
  md += `**Report generated in ${Date.now() - discovery.startTime}ms**\n`;

  return md;
}

function generateJSONReport(features, discovery) {
  return {
    timestamp: new Date().toISOString(),
    config: CONFIG,
    summary: {
      filesScanned: discovery.srcFiles.length,
      featuresInferred: features.length,
      commands: discovery.commands.length,
      services: discovery.services.length,
      jobs: discovery.jobs.length,
      migrations: discovery.migrationsData.migrations.length
    },
    features: features.map(f => ({
      ...f,
      files: [...f.files],
      kinds: [...f.kinds]
    })),
    discovery
  };
}

function generateCSV(features) {
  let csv = 'feature,status,confidence,commands,services,tables,events,jobs,markers,env,candidates,primary_flow\n';
  
  for (const feat of features) {
    csv += `"${feat.name}",`;
    csv += `${feat.status},`;
    csv += `${feat.confidence},`;
    csv += `${feat.counts?.commands || feat.evidence.commands.length},`;
    csv += `${feat.counts?.services || feat.evidence.services.length},`;
    csv += `${feat.counts?.tables || feat.evidence.tables.length},`;
    csv += `${feat.counts?.events || feat.evidence.events.length},`;
    csv += `${feat.counts?.jobs || feat.evidence.jobs.length},`;
    csv += `${feat.counts?.markers || feat.evidence.markers.length},`;
    csv += `${feat.counts?.env || 0},`;
    csv += `${feat.counts?.candidates || feat.evidence.candidates.length},`;
    csv += `"${(feat.primaryFlow || feat.flows?.[0] || 'No flow').replace(/"/g, "'")}"\n`;
  }
  
  return csv;
}

// ============================================================================
// RUN
// ============================================================================

runDiscovery().catch(err => {
  error(`Fatal error: ${err.message}`);
  process.exit(1);
});

