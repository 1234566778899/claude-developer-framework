#!/usr/bin/env node
/**
 * CDF · Guardrails (hook PreToolUse de Claude Code)
 * Bloquea (exit 2) escrituras de secretos, archivos sensibles, código sin cambio activo
 * y comandos destructivos. El mensaje en stderr se devuelve a Claude para que corrija.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SECRET_PATTERNS = [
  ['clave AWS', /AKIA[0-9A-Z]{16}/],
  ['llave privada', /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/],
  ['token GitHub', /gh[pousr]_[A-Za-z0-9]{36,}/],
  ['API key Anthropic', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['API key', /sk-[A-Za-z0-9]{32,}/],
  ['cadena de conexión Azure', /AccountKey=[A-Za-z0-9+/=]{40,}/],
  ['JWT', /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['contraseña literal', /(password|passwd|pwd|secret|api[_-]?key)\s*[:=]\s*["'][^"'\s$]{6,}["']/i],
];

const DESTRUCTIVE = [
  ['rm -rf sobre raíz, home o comodín', /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\b[^|;&]*\s(\/|~|\*|\.|\.\.)(\s|$)/],
  ['git push --force', /\bgit\s+push\b.*(\s--force(?!-with-lease)|\s-f\b)/],
  ['git reset --hard', /\bgit\s+reset\s+--hard\b/],
  ['git clean -fd', /\bgit\s+clean\s+-[a-z]*f[a-z]*d/],
  ['borrado recursivo en PowerShell', /Remove-Item\b.*-Recurse\b.*\s(\\|\/|~|C:\\?|\*)(\s|$)/i],
  ['DROP DATABASE/TABLE', /\bDROP\s+(DATABASE|TABLE|SCHEMA)\b/i],
  ['lectura de .env', /\b(cat|type|more|less|head|tail|Get-Content|gc)\b[^|;&]*\.env(?!\.example)\b/i],
];

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function block(msg) {
  process.stderr.write(`[CDF guardrail] ${msg}\n`);
  log({ type: 'guardrail-block', msg });
  process.exit(2);
}

let ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
function log(e) {
  try {
    const f = path.join(ROOT, '.cdf', 'logs', 'events.jsonl');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.appendFileSync(f, JSON.stringify({ ts: new Date().toISOString(), session: INPUT.session_id, ...e }) + '\n');
  } catch { /* nunca romper la sesión por el log */ }
}

let INPUT = {};
try { INPUT = JSON.parse(readStdin() || '{}'); } catch { process.exit(0); }
ROOT = process.env.CLAUDE_PROJECT_DIR || INPUT.cwd || ROOT;

let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(path.join(ROOT, '.cdf', 'config.json'), 'utf8')); } catch { /* sin config: defaults */ }
const g = { requireActiveChangeForSrc: true, srcDirs: ['src'], blockDestructiveBash: true, blockSecrets: true, ...(cfg.guardrails || {}) };

const tool = INPUT.tool_name;
const ti = INPUT.tool_input || {};

if (tool === 'Bash') {
  const cmd = String(ti.command || '');
  if (g.blockDestructiveBash) {
    for (const [name, re] of DESTRUCTIVE) if (re.test(cmd)) block(`Comando bloqueado (${name}). Si es imprescindible, pide al desarrollador que lo ejecute manualmente.`);
  }
  process.exit(0);
}

const file = ti.file_path || ti.notebook_path;
if (!file) process.exit(0);
const abs = path.resolve(ROOT, file);
const rel = path.relative(ROOT, abs).split(path.sep).join('/');
const base = path.basename(abs);

// 1. Archivos sensibles
if (/^\.env(\..+)?$/.test(base) && !/\.example$/.test(base)) block(`No se permite escribir ${rel}. Usa .env.example con valores de ejemplo.`);
if (/\.(pem|key|pfx|p12)$/i.test(base) || /^id_(rsa|ed25519)/.test(base)) block(`No se permite escribir material criptográfico (${rel}).`);

// 2. Historial inmutable
if (rel.startsWith('specs/changes/archive/')) block('Los cambios archivados son inmutables. Crea un cambio nuevo con /sdd-propose.');

// 3. Secretos en el contenido
if (g.blockSecrets) {
  const content = [ti.content, ti.new_string, ti.new_source, ...(Array.isArray(ti.edits) ? ti.edits.map((e) => e.new_string) : [])].filter(Boolean).join('\n');
  for (const [name, re] of SECRET_PATTERNS) if (re.test(content)) block(`El contenido para ${rel} parece contener un secreto (${name}). Usa variables de entorno y documenta la variable en .env.example.`);
}

// 4. Código solo con cambio activo
if (g.requireActiveChangeForSrc && g.srcDirs.some((d) => rel === d || rel.startsWith(d.replace(/\/$/, '') + '/'))) {
  const changesDir = path.join(ROOT, 'specs', 'changes');
  let active = [];
  try {
    active = fs.readdirSync(changesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== 'archive' && fs.existsSync(path.join(changesDir, d.name, 'tasks.md')))
      .map((d) => d.name);
  } catch { /* sin carpeta */ }
  if (!active.length) block(`No hay un cambio activo con tasks.md. Antes de modificar ${rel}, crea uno con /sdd-propose <nombre> y que el desarrollador lo revise.`);
}

process.exit(0);
