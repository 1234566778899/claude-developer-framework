'use strict';
const fs = require('fs');
const path = require('path');
const { color, walk, readJSON, readConfig, VERSION } = require('./util');
const { activeChanges, changeInfo } = require('./changes');

const SECRET_PATTERNS = [
  { id: 'aws-key', re: /AKIA[0-9A-Z]{16}/ },
  { id: 'private-key', re: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
  { id: 'github-token', re: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { id: 'anthropic-key', re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { id: 'openai-key', re: /sk-[A-Za-z0-9]{32,}/ },
  { id: 'azure-conn', re: /AccountKey=[A-Za-z0-9+/=]{40,}/ },
  { id: 'jwt', re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { id: 'password-literal', re: /(password|passwd|pwd|secret|api[_-]?key)\s*[:=]\s*["'][^"'\s]{6,}["']/i },
];

const SCAN_EXT = /\.(js|jsx|ts|tsx|mjs|cjs|py|java|kt|cs|go|rb|php|swift|dart|json|ya?ml|xml|properties|env|config|ini|md|sql|sh|ps1)$/i;
const IGNORE = ['node_modules', '.git', 'dist', 'build', 'bin', 'obj', '.next', 'coverage', 'vendor', '.venv', 'venv', 'archive'];

function runChecks(root) {
  const cfg = readConfig(root);
  const checks = [];
  const add = (area, name, ok, detail = '', level = 'FAIL') => checks.push({ area, name, status: ok ? 'PASS' : level, detail });
  const exists = (p) => fs.existsSync(path.join(root, p));

  // 1. Estructura
  for (const p of ['CLAUDE.md', '.claude/settings.json', '.claude/commands', '.claude/agents', 'specs/current', 'specs/changes', 'docs/def/requisitosnegocio', 'docs/metricas']) {
    add('Estructura', p, exists(p), exists(p) ? '' : 'falta; ejecuta "cdf update"');
  }
  for (const s of cfg.stacks || []) {
    for (const d of (cfg.stackDirs || {})[s] || []) add('Stack', `${s}: ${d}`, exists(d), exists(d) ? '' : 'carpeta del stack no encontrada', 'WARN');
  }

  // 2. Guardrails (hooks + permisos)
  const settings = readJSON(path.join(root, '.claude', 'settings.json'), {});
  const hooksTxt = JSON.stringify(settings.hooks || {});
  add('Guardrails', 'hook PreToolUse guard.js', hooksTxt.includes('guard.js'), 'sin el hook no se bloquean secretos ni comandos destructivos');
  add('Guardrails', 'hook de trazabilidad track.js', hooksTxt.includes('track.js'), 'sin el hook no hay métricas por cambio', 'WARN');
  const deny = (settings.permissions && settings.permissions.deny) || [];
  add('Guardrails', 'permiso deny sobre .env', deny.some((d) => d.includes('.env')), 'agrega Read(./.env*) a permissions.deny');
  const gi = exists('.gitignore') ? fs.readFileSync(path.join(root, '.gitignore'), 'utf8') : '';
  add('Guardrails', '.gitignore excluye .env', /^\.env/m.test(gi), 'agrega .env* a .gitignore');
  for (const c of ['sdd-explore', 'sdd-propose', 'sdd-apply', 'sdd-verify', 'sdd-archive']) {
    add('Comandos IA', `/${c}`, exists(`.claude/commands/${c}.md`), 'ejecuta "cdf update"');
  }

  // 3. Secretos
  const files = walk(root, { ignore: IGNORE }).filter((f) => SCAN_EXT.test(f) && !f.includes(`${path.sep}.cdf${path.sep}`) && fs.statSync(f).size < 2_000_000);
  const leaks = [];
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    for (const p of SECRET_PATTERNS) if (p.re.test(txt)) leaks.push(`${path.relative(root, f)} (${p.id})`);
  }
  add('Seguridad', `escaneo de secretos (${files.length} archivos)`, leaks.length === 0, leaks.slice(0, 10).join(', '));
  const envTracked = walk(root, { ignore: IGNORE }).filter((f) => /^\.env(\.|$)/.test(path.basename(f)) && !/\.example$/.test(f));
  if (envTracked.length) add('Seguridad', 'archivos .env presentes', exists('.gitignore') && /^\.env/m.test(gi), envTracked.map((f) => path.relative(root, f)).join(', '), 'WARN');

  // 4. Cambios activos
  for (const n of activeChanges(root)) {
    const i = changeInfo(root, n);
    const missing = Object.entries(i.artifacts).filter(([, ok]) => !ok).map(([a]) => a);
    add(`Cambio ${n}`, 'artefactos completos', !missing.length, missing.length ? `faltan: ${missing.join(', ')}` : '');
    if (i.tasks.total) add(`Cambio ${n}`, 'tareas completadas', i.tasks.done === i.tasks.total, `${i.tasks.done}/${i.tasks.total}`, 'WARN');
    if (i.verify) add(`Cambio ${n}`, 'verify-report.md', i.verify === 'APROBADO', i.verify);
    for (const rel of i.specs) {
      const txt = fs.readFileSync(path.join(i.dir, rel), 'utf8');
      const reqs = (txt.match(/^###\s+Requ/gim) || []).length;
      const scen = (txt.match(/^####\s+Escenario|^####\s+Scenario/gim) || []).length;
      add(`Cambio ${n}`, `${rel}: escenarios por requisito`, reqs > 0 && scen >= reqs, `${reqs} requisitos / ${scen} escenarios`);
    }
  }

  // 5. Métricas
  add('Métricas', 'registro de eventos .cdf/logs/events.jsonl', exists('.cdf/logs/events.jsonl'), 'se crea al usar los comandos /sdd-* en Claude Code', 'WARN');

  const fails = checks.filter((c) => c.status === 'FAIL').length;
  const warns = checks.filter((c) => c.status === 'WARN').length;
  return { version: VERSION, root, date: new Date().toISOString(), estado: fails ? 'RECHAZADO' : 'APROBADO', fails, warns, checks };
}

function cmdVerify(root, args) {
  const r = runChecks(root);
  fs.mkdirSync(path.join(root, '.cdf', 'logs'), { recursive: true });
  fs.appendFileSync(path.join(root, '.cdf', 'logs', 'events.jsonl'), JSON.stringify({ ts: r.date, type: 'cdf-verify', estado: r.estado, fails: r.fails, warns: r.warns }) + '\n');
  if (args.json) { console.log(JSON.stringify(r, null, 2)); process.exitCode = r.fails ? 1 : 0; return; }
  let area = '';
  for (const c of r.checks) {
    if (c.area !== area) { area = c.area; console.log(color.bold(`\n${area}`)); }
    const tag = c.status === 'PASS' ? color.green('PASS') : c.status === 'WARN' ? color.yellow('WARN') : color.red('FAIL');
    console.log(`  ${tag}  ${c.name}${c.detail && c.status !== 'PASS' ? color.gray(' — ' + c.detail) : ''}`);
  }
  const st = r.estado === 'APROBADO' ? color.green(r.estado) : color.red(r.estado);
  console.log(`\n${color.bold('Estado:')} ${st}   FAILS: ${r.fails}   WARNS: ${r.warns}\n`);
  process.exitCode = r.fails ? 1 : 0;
}

module.exports = { runChecks, cmdVerify, SECRET_PATTERNS };
