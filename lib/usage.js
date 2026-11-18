'use strict';
/**
 * Métricas de consumo y tiempo a partir de:
 *  - Transcripts locales de Claude Code: ~/.claude/projects/<ruta-codificada>/*.jsonl
 *  - Eventos del proyecto: .cdf/logs/events.jsonl (escritos por el hook track.js)
 * Los precios NO se codifican: se leen de .cdf/config.json → pricing (USD por millón de tokens).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { color, table, readConfig, today } = require('./util');

function transcriptDir(root) {
  const base = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(base, 'projects', path.resolve(root).replace(/[^a-zA-Z0-9]/g, '-'));
}

function readEvents(root) {
  const f = path.join(root, '.cdf', 'logs', 'events.jsonl');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

/** Devuelve mensajes del asistente (deduplicados por message.id) con sesión, modelo, tokens y timestamp. */
function readUsage(root) {
  const dir = transcriptDir(root);
  if (!fs.existsSync(dir)) return { dir, messages: [], sessions: {} };
  const seen = new Set();
  const messages = [];
  const sessions = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
    for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      if (!line) continue;
      let e; try { e = JSON.parse(line); } catch { continue; }
      const sid = e.sessionId || f.replace('.jsonl', '');
      if (e.timestamp) {
        const s = (sessions[sid] ||= { id: sid, start: e.timestamp, end: e.timestamp, prompts: 0, timestamps: [] });
        if (e.timestamp < s.start) s.start = e.timestamp;
        if (e.timestamp > s.end) s.end = e.timestamp;
        s.timestamps.push(e.timestamp);
        if (e.type === 'user' && typeof e.message?.content === 'string') s.prompts++;
      }
      const u = e.message?.usage;
      if (e.type !== 'assistant' || !u || e.message.model === '<synthetic>') continue;
      const key = e.message.id ? `${e.message.id}:${e.requestId || ''}` : `${sid}:${e.uuid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      messages.push({
        session: sid, ts: e.timestamp, model: e.message.model || 'desconocido', sidechain: !!e.isSidechain,
        input: u.input_tokens || 0, output: u.output_tokens || 0,
        cacheWrite: u.cache_creation_input_tokens || 0, cacheRead: u.cache_read_input_tokens || 0,
      });
    }
  }
  return { dir, messages, sessions };
}

/** Tiempo activo: suma intervalos entre eventos consecutivos menores al umbral de inactividad. */
function activeMinutes(timestamps, idleMin = 10) {
  const t = timestamps.map((x) => Date.parse(x)).filter(Boolean).sort((a, b) => a - b);
  let ms = 0;
  for (let i = 1; i < t.length; i++) { const d = t[i] - t[i - 1]; if (d < idleMin * 60000) ms += d; }
  return Math.round(ms / 60000);
}

function priceFor(pricing, model) {
  if (!pricing) return null;
  const key = Object.keys(pricing).find((k) => model.includes(k));
  return key ? pricing[key] : null;
}
function cost(m, p) {
  if (!p) return null;
  return (m.input * (p.input || 0) + m.output * (p.output || 0) + m.cacheWrite * (p.cacheWrite || 0) + m.cacheRead * (p.cacheRead || 0)) / 1e6;
}

/** Asigna cada sesión al cambio en curso según los eventos /sdd-* registrados por el hook. */
function sessionChangeMap(events) {
  const map = {};
  for (const e of events) if (e.type === 'sdd-command' && e.session && e.change) (map[e.session] ||= new Set()).add(e.change);
  return map;
}

function aggregate(msgs, keyFn, pricing) {
  const g = {};
  for (const m of msgs) {
    const k = keyFn(m);
    const a = (g[k] ||= { key: k, calls: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0, priced: true });
    a.calls++; a.input += m.input; a.output += m.output; a.cacheWrite += m.cacheWrite; a.cacheRead += m.cacheRead;
    const c = cost(m, priceFor(pricing, m.model));
    if (c === null) a.priced = false; else a.cost += c;
  }
  return Object.values(g).sort((a, b) => b.output - a.output);
}

const fmt = (n) => n.toLocaleString('es-EC');
const money = (a) => (a.priced ? `USD ${a.cost.toFixed(2)}` : color.gray('sin tarifa'));

function filterMsgs(root, args) {
  const { messages, sessions, dir } = readUsage(root);
  const events = readEvents(root);
  const map = sessionChangeMap(events);
  let msgs = messages;
  if (args.change) msgs = msgs.filter((m) => map[m.session]?.has(args.change));
  if (args.since) msgs = msgs.filter((m) => m.ts >= args.since);
  return { msgs, sessions, events, map, dir };
}

function cmdUsage(root, args) {
  const cfg = readConfig(root);
  const { msgs, map, dir } = filterMsgs(root, args);
  if (!msgs.length) {
    console.log(color.yellow(`Sin datos de consumo${args.change ? ` para "${args.change}"` : ''}.`));
    console.log(color.gray(`  Se leen transcripts de: ${dir}`));
    return;
  }
  const byModel = aggregate(msgs, (m) => m.model, cfg.pricing);
  const byChange = aggregate(msgs, (m) => [...(map[m.session] || ['(sin cambio)'])].join(', '), cfg.pricing);
  const total = aggregate(msgs, () => 'TOTAL', cfg.pricing)[0];
  if (args.json) return console.log(JSON.stringify({ total, byModel, byChange }, null, 2));
  console.log(color.bold(`\nConsumo de IA ${args.change ? `· cambio ${args.change}` : '· proyecto'}`));
  const row = (a) => [a.key, fmt(a.calls), fmt(a.input), fmt(a.output), fmt(a.cacheWrite), fmt(a.cacheRead), money(a)];
  const heads = ['', 'Llamadas', 'Entrada', 'Salida', 'Caché (escr.)', 'Caché (lect.)', 'Costo'];
  console.log(color.bold('\nPor modelo')); table(byModel.map(row), ['Modelo', ...heads.slice(1)]);
  if (!args.change) { console.log(color.bold('\nPor cambio')); table(byChange.map(row), ['Cambio', ...heads.slice(1)]); }
  console.log(color.bold('\n') ); table([row(total)], heads);
  if (!total.priced) console.log(color.gray('\n  Para calcular costos, registra las tarifas oficiales vigentes en .cdf/config.json → "pricing" (USD por millón de tokens).'));
  console.log('');
}

function cmdReport(root, args) {
  const cfg = readConfig(root);
  const { msgs, sessions, events, map } = filterMsgs(root, args);
  const idle = cfg.metrics?.idleMinutes || 10;
  // Tiempo por cambio y fase a partir de eventos
  const changes = {};
  for (const e of events.filter((x) => x.type === 'sdd-command' && x.change)) {
    const c = (changes[e.change] ||= { change: e.change, phases: {}, first: e.ts, last: e.ts, sessions: new Set() });
    (c.phases[e.phase] ||= []).push(e.ts);
    if (e.ts < c.first) c.first = e.ts;
    if (e.ts > c.last) c.last = e.ts;
    if (e.session) c.sessions.add(e.session);
  }
  for (const e of events.filter((x) => x.type === 'archive')) if (changes[e.change]) changes[e.change].archived = e.ts;
  const rows = Object.values(changes).map((c) => {
    const ts = [...c.sessions].flatMap((s) => sessions[s]?.timestamps || []);
    const tok = aggregate(msgs.filter((m) => map[m.session]?.has(c.change)), () => 'x', cfg.pricing)[0];
    return {
      cambio: c.change, fases: Object.keys(c.phases).join(' → '), inicio: c.first.slice(0, 16).replace('T', ' '),
      archivado: c.archived ? c.archived.slice(0, 10) : '-', sesiones: c.sessions.size, minutosActivos: activeMinutes(ts, idle),
      tokensSalida: tok?.output || 0, tokensEntrada: (tok?.input || 0) + (tok?.cacheRead || 0) + (tok?.cacheWrite || 0),
      costoUSD: tok?.priced ? Number(tok.cost.toFixed(2)) : null,
    };
  });
  const allTs = Object.values(sessions).flatMap((s) => s.timestamps);
  const report = {
    generado: new Date().toISOString(), proyecto: path.basename(root), umbralInactividadMin: idle,
    sesiones: Object.keys(sessions).length, minutosActivosTotales: activeMinutes(allTs, idle), cambios: rows,
    nota: 'Minutos activos = suma de intervalos entre eventos menores al umbral de inactividad. No equivale automáticamente a tiempo productivo.',
  };
  const out = path.join(root, 'docs', 'metricas', `reporte-${today()}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  if (args.json) return console.log(JSON.stringify(report, null, 2));
  console.log(color.bold(`\nReporte de tiempos · ${report.proyecto}`));
  console.log(`  Sesiones de Claude Code: ${report.sesiones}   Minutos activos: ${report.minutosActivosTotales} (umbral ${idle} min)`);
  if (rows.length) {
    console.log('');
    table(rows.map((r) => [r.cambio, r.fases, r.inicio, r.archivado, r.sesiones, r.minutosActivos, fmt(r.tokensSalida), r.costoUSD ?? '-']),
      ['Cambio', 'Fases', 'Inicio', 'Archivado', 'Sesiones', 'Min. activos', 'Tokens salida', 'USD']);
  } else console.log(color.gray('  Aún no hay eventos /sdd-* registrados.'));
  console.log(color.gray(`\n  ${report.nota}`));
  console.log(color.green(`  ✔ Guardado en ${path.relative(root, out)}\n`));
}

module.exports = { cmdUsage, cmdReport, readUsage, transcriptDir };
