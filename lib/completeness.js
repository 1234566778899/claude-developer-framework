'use strict';
const fs = require('fs');
const path = require('path');
const { color, normalize, findRoot, readConfig } = require('./util');

// Secciones mínimas del DEF. Se puede sobrescribir en .cdf/config.json → completeness.sections
const DEFAULT_SECTIONS = [
  { id: 'objetivo', label: 'Objetivo', synonyms: ['objetivo', 'proposito', 'objetivos'] },
  { id: 'alcance', label: 'Alcance', synonyms: ['alcance', 'scope', 'fuera de alcance'] },
  { id: 'actores', label: 'Actores / usuarios', synonyms: ['actores', 'usuarios', 'roles', 'perfiles'], optional: true },
  { id: 'reglas', label: 'Reglas de negocio', synonyms: ['reglas de negocio', 'reglas', 'politicas'] },
  { id: 'flujos', label: 'Flujos / casos de uso', synonyms: ['flujo', 'flujos', 'casos de uso', 'proceso', 'historias de usuario'] },
  { id: 'restricciones', label: 'Restricciones', synonyms: ['restricciones', 'limitaciones', 'supuestos', 'requisitos no funcionales'] },
  { id: 'excepciones', label: 'Excepciones / errores', synonyms: ['excepciones', 'flujos alternos', 'errores', 'manejo de errores'] },
  { id: 'criterios', label: 'Criterios de aceptación', synonyms: ['criterios de aceptacion', 'aceptacion', 'acceptance criteria'] },
];

const VAGUE = [/\bTBD\b/i, /\bpor definir\b/i, /\bpendiente\b/i, /\bpor confirmar\b/i, /\?\?/, /\bxxx\b/i, /\betc\.?\s*$/im, /\bTODO\b/];

function analyze(file, sections) {
  const md = fs.readFileSync(file, 'utf8');
  const lines = md.split('\n');
  const heads = [];
  lines.forEach((l, i) => {
    const m = l.match(/^(#{1,6})\s+(.*)$/) || l.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (m) heads.push({ line: i, text: normalize((m[2] || m[1]).replace(/^[\d.\s]+/, '')) });
  });
  const findings = [];
  const found = {};
  for (const s of sections) {
    const h = heads.find((x) => s.synonyms.some((syn) => x.text.includes(normalize(syn))));
    if (!h) {
      if (!s.optional) findings.push({ level: 'FAIL', section: s.label, msg: 'Sección no encontrada' });
      else findings.push({ level: 'WARN', section: s.label, msg: 'Sección opcional no encontrada' });
      continue;
    }
    const next = heads.find((x) => x.line > h.line);
    const body = lines.slice(h.line + 1, next ? next.line : lines.length).join('\n').trim();
    found[s.id] = body;
    if (body.replace(/[\s|\-*#]/g, '').length < 40) findings.push({ level: 'FAIL', section: s.label, msg: `Contenido insuficiente (línea ${h.line + 1})` });
  }
  if (found.criterios !== undefined) {
    const items = (found.criterios.match(/^\s*([-*]|\d+[.)])\s+/gm) || []).length + (found.criterios.match(/^\|/gm) || []).length;
    if (items < 2) findings.push({ level: 'WARN', section: 'Criterios de aceptación', msg: 'Se esperan criterios enumerados y verificables (lista o tabla)' });
  }
  lines.forEach((l, i) => {
    for (const re of VAGUE) {
      if (re.test(l)) { findings.push({ level: 'WARN', section: `línea ${i + 1}`, msg: `Texto ambiguo o pendiente: "${l.trim().slice(0, 80)}"` }); break; }
    }
  });
  const fails = findings.filter((f) => f.level === 'FAIL').length;
  const required = sections.filter((s) => !s.optional).length;
  const covered = sections.filter((s) => !s.optional && found[s.id] !== undefined).length;
  return { file, fails, warns: findings.length - fails, score: Math.round((covered / required) * 100), status: fails ? 'INSUFICIENTE' : 'SUFICIENTE', findings };
}

function cmdCompleteness(root, args) {
  const files = args._.slice(1);
  if (!files.length) { console.error(color.red('Uso: cdf completeness <requerimientos.md> [...] [--json]')); process.exit(1); }
  const r = findRoot();
  const sections = (r && readConfig(r).completeness?.sections) || DEFAULT_SECTIONS;
  const results = files.map((f) => {
    if (!fs.existsSync(f)) { console.error(color.red(`✖ No existe: ${f}`)); process.exit(1); }
    return analyze(path.resolve(f), sections);
  });
  if (args.json) console.log(JSON.stringify(results, null, 2));
  else {
    for (const res of results) {
      console.log(color.bold(`\nCompletitud: ${path.relative(process.cwd(), res.file)}`));
      for (const f of res.findings) {
        const tag = f.level === 'FAIL' ? color.red('FAIL') : color.yellow('WARN');
        console.log(`  ${tag}  ${f.section.padEnd(26)} ${f.msg}`);
      }
      if (!res.findings.length) console.log(color.green('  Sin hallazgos.'));
      const st = res.status === 'SUFICIENTE' ? color.green(res.status) : color.red(res.status);
      console.log(`\n  Cobertura de secciones: ${res.score}%   FAILS: ${res.fails}   WARNS: ${res.warns}   Estado: ${st}`);
      if (res.fails) console.log(color.gray('  → Devuelve los vacíos a QA Funcional / Product Owner. No ejecutes /sdd-propose hasta corregirlos.'));
    }
    console.log('');
  }
  if (results.some((r2) => r2.fails)) process.exitCode = 1;
}

module.exports = { analyze, cmdCompleteness, DEFAULT_SECTIONS };
