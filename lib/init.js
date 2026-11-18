'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const { color, TEMPLATES, VERSION, copyDir, readJSON, writeJSON, readConfig, writeConfig, findRoot } = require('./util');
const { DEFAULT_MODELS, applyModels } = require('./models');

const STACKS = {
  web: { label: 'Web (frontend + backend)', dirs: ['src/frontend', 'src/backend', 'tests'] },
  mobile: { label: 'Mobile', dirs: ['src/mobile', 'tests'] },
  integration: { label: 'Integración (APIs, colas, ETL)', dirs: ['src/integration', 'tests'] },
};
const OWNED = ['.claude/commands', '.claude/agents', '.claude/hooks', 'specs/README.md'];
const GITIGNORE = ['.env', '.env.*', '!.env.example', '.cdf/logs/', '.claude/settings.local.json', 'node_modules/'];

async function ask(question, options) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(color.bold(question));
  options.forEach((o, i) => console.log(`  ${i + 1}) ${o.label}`));
  const ans = await new Promise((r) => rl.question('Selecciona (ej. 1 o 1,3): ', r));
  rl.close();
  return ans.split(',').map((x) => options[Number(x.trim()) - 1]).filter(Boolean).map((o) => o.value);
}

function mergeSettings(root) {
  const file = path.join(root, '.claude', 'settings.json');
  const tpl = readJSON(path.join(TEMPLATES, 'project', '.claude', 'settings.json'));
  const cur = readJSON(file, {});
  const merged = { ...tpl, ...cur, permissions: { ...(tpl.permissions || {}), ...(cur.permissions || {}) }, hooks: { ...(cur.hooks || {}) } };
  for (const k of ['allow', 'deny', 'ask']) {
    const set = new Set([...(tpl.permissions?.[k] || []), ...(cur.permissions?.[k] || [])]);
    if (set.size) merged.permissions[k] = [...set];
  }
  for (const [event, entries] of Object.entries(tpl.hooks || {})) {
    const list = (merged.hooks[event] ||= []);
    for (const entry of entries) {
      const cmd = entry.hooks[0].command;
      if (!JSON.stringify(list).includes(cmd.split('/').pop())) list.push(entry);
    }
  }
  writeJSON(file, merged);
}

function mergeGitignore(root) {
  const f = path.join(root, '.gitignore');
  const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const missing = GITIGNORE.filter((l) => !cur.split(/\r?\n/).includes(l));
  if (missing.length) fs.writeFileSync(f, cur + (cur && !cur.endsWith('\n') ? '\n' : '') + `# CDF\n${missing.join('\n')}\n`);
}

function installStacks(root, stacks, log) {
  for (const s of stacks) {
    for (const d of STACKS[s].dirs) {
      fs.mkdirSync(path.join(root, d), { recursive: true });
      const keep = path.join(root, d, '.gitkeep');
      if (fs.readdirSync(path.join(root, d)).length === 0) fs.writeFileSync(keep, '');
    }
    const rules = path.join(TEMPLATES, 'stacks', `${s}.md`);
    const dst = path.join(root, '.claude', 'rules', `cdf-stack-${s}.md`);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(rules, dst);
    log(dst, 'create');
  }
  // Importa las reglas del stack en CLAUDE.md (bloque gestionado)
  const claudeMd = path.join(root, 'CLAUDE.md');
  let txt = fs.readFileSync(claudeMd, 'utf8');
  const block = `<!-- cdf:stacks -->\n${stacks.map((s) => `@.claude/rules/cdf-stack-${s}.md`).join('\n')}\n<!-- /cdf:stacks -->`;
  txt = /<!-- cdf:stacks -->[\s\S]*?<!-- \/cdf:stacks -->/.test(txt) ? txt.replace(/<!-- cdf:stacks -->[\s\S]*?<!-- \/cdf:stacks -->/, block) : `${txt.trimEnd()}\n\n## Guardrails del stack\n${block}\n`;
  fs.writeFileSync(claudeMd, txt);
}

async function cmdInit(_root, args) {
  const root = process.cwd();
  const existing = findRoot(root);
  if (existing && existing !== root) console.log(color.yellow(`⚠ Ya existe un proyecto CDF en ${existing}; se inicializará uno nuevo en ${root}.`));
  if (existing === root && !args.force) {
    console.error(color.red('✖ Este proyecto ya está inicializado. Usa "cdf update" para regenerar artefactos o "cdf init --force".'));
    process.exit(1);
  }
  let stacks = args.stack ? String(args.stack).split(',') : null;
  if (!stacks && process.stdin.isTTY) stacks = await ask('¿Qué stack se construirá?', [...Object.entries(STACKS).map(([v, s]) => ({ value: v, label: s.label })), { value: 'all', label: 'Todas' }]);
  if (!stacks || !stacks.length) stacks = ['web'];
  if (stacks.includes('all')) stacks = Object.keys(STACKS);
  const bad = stacks.filter((s) => !STACKS[s]);
  if (bad.length) { console.error(color.red(`✖ Stack no soportado: ${bad.join(', ')}. Opciones: ${Object.keys(STACKS).join(', ')}, all`)); process.exit(1); }

  console.log(color.bold(`\nInicializando CDF ${VERSION} en ${root}`));
  const counts = { create: 0, update: 0, skip: 0 };
  const log = (f, a) => { counts[a]++; if (a !== 'skip' && args.verbose) console.log(color.gray(`  ${a} ${path.relative(root, f)}`)); };
  copyDir(path.join(TEMPLATES, 'project'), root, { overwrite: args.force ? 'always' : 'never', vars: { PROJECT: path.basename(root), VERSION }, onFile: log });
  mergeSettings(root);
  mergeGitignore(root);
  installStacks(root, stacks, log);

  const cfg = {
    framework: 'claude-developer-framework', version: VERSION, project: path.basename(root), createdAt: new Date().toISOString(),
    stacks, stackDirs: Object.fromEntries(stacks.map((s) => [s, STACKS[s].dirs])),
    defPath: 'docs/def/requisitosnegocio/requerimientos.md',
    guardrails: { requireActiveChangeForSrc: true, srcDirs: ['src'], blockDestructiveBash: true, blockSecrets: true },
    models: DEFAULT_MODELS,
    pricing: null,
    metrics: { idleMinutes: 10 },
  };
  writeConfig(root, cfg);
  applyModels(root, cfg.models);
  fs.mkdirSync(path.join(root, '.cdf', 'logs'), { recursive: true });

  if (!fs.existsSync(path.join(root, '.git'))) {
    try { execSync('git init -q', { cwd: root, stdio: 'ignore' }); console.log(color.gray('  git init')); } catch { /* sin git */ }
  }
  console.log(color.green(`✔ ${counts.create} archivos creados, ${counts.update} actualizados, ${counts.skip} conservados.`));
  console.log(`  Stacks: ${stacks.join(', ')}`);
  console.log(color.bold('\nSiguientes pasos:'));
  console.log('  1. cdf verify                 → validar el setup');
  console.log('  2. Copia el DEF aprobado a docs/def/requisitosnegocio/');
  console.log('  3. cdf convert <DEF.docx> -o docs/def/requisitosnegocio/requerimientos.md');
  console.log('  4. cdf completeness docs/def/requisitosnegocio/requerimientos.md');
  console.log('  5. claude  → /sdd-explore (opcional) → /sdd-propose <nombre-del-cambio>\n');
}

function cmdUpdate(root, args) {
  const cfg = readConfig(root);
  const counts = { create: 0, update: 0, skip: 0 };
  const log = (f, a) => counts[a]++;
  for (const rel of OWNED) {
    const src = path.join(TEMPLATES, 'project', rel);
    const dst = path.join(root, rel);
    if (fs.statSync(src).isDirectory()) copyDir(src, dst, { overwrite: 'always', vars: { PROJECT: cfg.project, VERSION }, onFile: log });
    else { fs.copyFileSync(src, dst); counts.update++; }
  }
  if (args.force) copyDir(path.join(TEMPLATES, 'project'), root, { overwrite: 'always', vars: { PROJECT: cfg.project, VERSION }, onFile: log });
  else copyDir(path.join(TEMPLATES, 'project'), root, { overwrite: 'never', vars: { PROJECT: cfg.project, VERSION }, onFile: log });
  mergeSettings(root);
  mergeGitignore(root);
  installStacks(root, cfg.stacks || ['web'], log);
  cfg.version = VERSION;
  cfg.models ||= DEFAULT_MODELS;
  writeConfig(root, cfg);
  applyModels(root, cfg.models);
  console.log(color.green(`✔ Proyecto actualizado a CDF ${VERSION}: ${counts.create} creados, ${counts.update} regenerados.`));
  if (!args.force) console.log(color.gray('  CLAUDE.md y tus archivos propios se conservaron. Usa --force para regenerarlos.'));
}

function cmdDoctor() {
  const checks = [
    ['node', 'node --version', '>= 18'],
    ['git', 'git --version'],
    ['claude', 'claude --version', 'Claude Code CLI: npm i -g @anthropic-ai/claude-code'],
  ];
  let ok = true;
  console.log(color.bold(`\nCDF ${VERSION} · diagnóstico\n`));
  for (const [name, cmd, hint] of checks) {
    try {
      const v = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n')[0];
      console.log(`  ${color.green('✔')} ${name.padEnd(8)} ${v}`);
    } catch {
      ok = false;
      console.log(`  ${color.red('✖')} ${name.padEnd(8)} no encontrado ${hint ? color.gray('— ' + hint) : ''}`);
    }
  }
  const root = findRoot();
  console.log(`  ${root ? color.green('✔') : color.yellow('•')} proyecto  ${root || 'no estás dentro de un proyecto CDF'}`);
  if (root) {
    const cfg = readConfig(root);
    if (cfg.version !== VERSION) console.log(color.yellow(`  ⚠ El proyecto usa CDF ${cfg.version}; el CLI es ${VERSION}. Ejecuta "cdf update".`));
  }
  console.log('');
  if (!ok) process.exitCode = 1;
}

function cmdStacks(_root, args) {
  const sub = args._[1];
  if (sub === 'show') {
    const s = args._[2];
    if (!STACKS[s]) { console.error(color.red(`Stacks: ${Object.keys(STACKS).join(', ')}`)); process.exit(1); }
    console.log(color.bold(`\n${STACKS[s].label}`) + color.gray(`  carpetas: ${STACKS[s].dirs.join(', ')}\n`));
    console.log(fs.readFileSync(path.join(TEMPLATES, 'stacks', `${s}.md`), 'utf8'));
    return;
  }
  console.log(color.bold('\nStacks soportados'));
  for (const [k, s] of Object.entries(STACKS)) console.log(`  • ${k.padEnd(12)} ${s.label}`);
  console.log('');
}

module.exports = { cmdInit, cmdUpdate, cmdDoctor, cmdStacks, STACKS };
