'use strict';
const fs = require('fs');
const path = require('path');

const VERSION = require('../package.json').version;
const TEMPLATES = path.join(__dirname, '..', 'templates');

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const color = {
  bold: c(1), dim: c(2), red: c(31), green: c(32), yellow: c(33), blue: c(34), cyan: c(36), gray: c(90),
};

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) args[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('-')) args[k] = argv[++i];
      else args[k] = true;
    } else if (a.startsWith('-') && a.length === 2) {
      const k = a.slice(1);
      if (argv[i + 1] && !argv[i + 1].startsWith('-')) args[k] = argv[++i];
      else args[k] = true;
    } else args._.push(a);
  }
  return args;
}

/** Sube por los directorios hasta encontrar .cdf/config.json */
function findRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(dir, '.cdf', 'config.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function requireRoot() {
  const root = findRoot();
  if (!root) {
    console.error(color.red('✖ No se encontró un proyecto CDF (falta .cdf/config.json). Ejecuta "cdf init" en la raíz del proyecto.'));
    process.exit(1);
  }
  return root;
}

function readJSON(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function readConfig(root) { return readJSON(path.join(root, '.cdf', 'config.json'), {}); }
function writeConfig(root, cfg) { writeJSON(path.join(root, '.cdf', 'config.json'), cfg); }

/** Copia recursiva. overwrite: 'always' | 'never' */
function copyDir(src, dst, { overwrite = 'never', vars = {}, onFile } = {}) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name === '_gitignore' ? '.gitignore' : entry.name);
    if (entry.isDirectory()) copyDir(s, d, { overwrite, vars, onFile });
    else {
      const exists = fs.existsSync(d);
      if (exists && overwrite === 'never') { onFile && onFile(d, 'skip'); continue; }
      let content = fs.readFileSync(s);
      if (/\.(md|json|js|txt|ps1)$/.test(entry.name)) {
        let txt = content.toString('utf8');
        for (const [k, v] of Object.entries(vars)) txt = txt.split(`{{${k}}}`).join(v);
        content = txt;
      }
      fs.writeFileSync(d, content);
      onFile && onFile(d, exists ? 'update' : 'create');
    }
  }
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

function walk(dir, { ignore = [] } = {}, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignore.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, { ignore }, out);
    else out.push(p);
  }
  return out;
}

function today() { return new Date().toISOString().slice(0, 10); }

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function bar(pct, width = 20) {
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function table(rows, headers) {
  const all = [headers, ...rows].map((r) => r.map((x) => String(x ?? '')));
  // eslint-disable-next-line no-control-regex
  const vis = (s) => s.replace(/\x1b\[[0-9;]*m/g, '').length;
  const widths = headers.map((_, i) => Math.max(...all.map((r) => vis(r[i]))));
  const line = (r) => r.map((x, i) => x + ' '.repeat(widths[i] - vis(x))).join('  ');
  console.log(color.bold(line(all[0])));
  console.log(color.gray(widths.map((w) => '─'.repeat(w)).join('  ')));
  for (const r of all.slice(1)) console.log(line(r));
}

module.exports = {
  VERSION, TEMPLATES, color, parseArgs, findRoot, requireRoot, readJSON, writeJSON, readConfig, writeConfig,
  copyDir, listDirs, walk, today, normalize, bar, table,
};
