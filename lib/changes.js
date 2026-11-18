'use strict';
const fs = require('fs');
const path = require('path');
const { color, listDirs, walk, bar, table, today } = require('./util');

const ARTIFACTS = ['proposal.md', 'design.md', 'tasks.md'];

function paths(root) {
  return {
    current: path.join(root, 'specs', 'current'),
    changes: path.join(root, 'specs', 'changes'),
    archive: path.join(root, 'specs', 'changes', 'archive'),
    events: path.join(root, '.cdf', 'logs', 'events.jsonl'),
  };
}

function activeChanges(root) {
  return listDirs(paths(root).changes).filter((d) => d !== 'archive');
}
function archivedChanges(root) {
  return listDirs(paths(root).archive);
}

function taskProgress(tasksFile) {
  if (!fs.existsSync(tasksFile)) return { done: 0, total: 0, pct: 0 };
  const txt = fs.readFileSync(tasksFile, 'utf8');
  const total = (txt.match(/^\s*[-*] \[[ xX]\]/gm) || []).length;
  const done = (txt.match(/^\s*[-*] \[[xX]\]/gm) || []).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

function verifyResult(dir) {
  const f = path.join(dir, 'verify-report.md');
  if (!fs.existsSync(f)) return null;
  const txt = fs.readFileSync(f, 'utf8');
  if (/Estado:\s*\**\s*APROBADO/i.test(txt)) return 'APROBADO';
  if (/Estado:\s*\**\s*RECHAZADO/i.test(txt)) return 'RECHAZADO';
  return 'DESCONOCIDO';
}

function changeInfo(root, name, archived = false) {
  const dir = archived ? path.join(paths(root).archive, name) : path.join(paths(root).changes, name);
  const artifacts = {};
  for (const a of ARTIFACTS) artifacts[a] = fs.existsSync(path.join(dir, a));
  const specFiles = walk(path.join(dir, 'specs')).filter((f) => f.endsWith('spec.md'));
  artifacts['specs/*/spec.md'] = specFiles.length > 0;
  const tasks = taskProgress(path.join(dir, 'tasks.md'));
  const verify = verifyResult(dir);
  let phase;
  if (archived) phase = 'COMPLETE';
  else if (!artifacts['proposal.md']) phase = 'EXPLORE';
  else if (!Object.values(artifacts).every(Boolean)) phase = 'PROPOSE (incompleto)';
  else if (tasks.done === 0) phase = 'PROPOSED';
  else if (tasks.done < tasks.total) phase = 'APPLY';
  else if (verify === 'APROBADO') phase = 'VERIFIED';
  else if (verify === 'RECHAZADO') phase = 'VERIFY (FAILS)';
  else phase = 'IMPLEMENTED';
  return { name, dir, artifacts, specs: specFiles.map((f) => path.relative(dir, f)), tasks, verify, phase, archived };
}

const phaseColor = (p) =>
  p === 'COMPLETE' || p === 'VERIFIED' ? color.green(p)
    : p.includes('FAILS') || p.includes('incompleto') ? color.red(p)
      : p === 'APPLY' || p === 'IMPLEMENTED' ? color.yellow(p) : color.cyan(p);

function cmdList(root, args) {
  const p = paths(root);
  if (args.specs || (!args.changes && !args.specs)) {
    const specs = listDirs(p.current);
    console.log(color.bold(`\nSpecs vigentes (${specs.length}) — specs/current/`));
    if (!specs.length) console.log(color.gray('  (ninguna todavía; se crean al archivar el primer cambio)'));
    for (const s of specs) {
      const f = path.join(p.current, s, 'spec.md');
      const reqs = fs.existsSync(f) ? (fs.readFileSync(f, 'utf8').match(/^###\s+Requ/gim) || []).length : 0;
      console.log(`  • ${s} ${color.gray(`(${reqs} requisitos)`)}`);
    }
  }
  if (args.changes || (!args.changes && !args.specs)) {
    const act = activeChanges(root);
    const arc = archivedChanges(root);
    console.log(color.bold(`\nCambios activos (${act.length})`));
    for (const n of act) {
      const i = changeInfo(root, n);
      console.log(`  • ${n.padEnd(32)} ${phaseColor(i.phase).padEnd(20)} tareas ${i.tasks.done}/${i.tasks.total}`);
    }
    console.log(color.bold(`\nCambios completados (${arc.length})`));
    for (const n of arc) console.log(`  ✔ ${color.gray(n)}`);
    console.log('');
  }
}

function resolveChange(root, name) {
  const act = activeChanges(root);
  if (!name) {
    if (act.length === 1) return act[0];
    console.error(color.red(`✖ Indica el cambio. Activos: ${act.join(', ') || '(ninguno)'}`));
    process.exit(1);
  }
  if (!act.includes(name)) {
    console.error(color.red(`✖ El cambio "${name}" no está activo. Activos: ${act.join(', ') || '(ninguno)'}`));
    process.exit(1);
  }
  return name;
}

function cmdShow(root, args) {
  const name = resolveChange(root, args._[1]);
  const i = changeInfo(root, name);
  console.log(color.bold(`\nCambio: ${name}`) + `   fase: ${phaseColor(i.phase)}`);
  console.log(color.gray(path.relative(root, i.dir)));
  for (const [a, ok] of Object.entries(i.artifacts)) console.log(`  ${ok ? color.green('✔') : color.red('✖')} ${a}`);
  for (const s of i.specs) console.log(color.gray(`      └ ${s}`));
  const prop = path.join(i.dir, 'proposal.md');
  if (fs.existsSync(prop)) {
    const txt = fs.readFileSync(prop, 'utf8');
    const why = txt.match(/##\s*(Por qué|Why|Motivación)[^\n]*\n([\s\S]*?)(\n##|$)/i);
    if (why) console.log('\n' + color.bold('Por qué: ') + why[2].trim().split('\n').slice(0, 6).join('\n'));
    const open = txt.match(/##\s*Preguntas abiertas[^\n]*\n([\s\S]*?)(\n##|$)/i);
    if (open && open[1].trim() && !/ninguna/i.test(open[1])) console.log('\n' + color.yellow('Preguntas abiertas:\n') + open[1].trim());
  }
  console.log('');
}

function cmdStatus(root, args) {
  const name = resolveChange(root, args.change || args._[1]);
  const i = changeInfo(root, name);
  if (args.json) return console.log(JSON.stringify(i, null, 2));
  console.log(`\n${color.bold(name)}  ${phaseColor(i.phase)}`);
  console.log(`  Tareas      ${bar(i.tasks.pct)} ${i.tasks.done}/${i.tasks.total} (${i.tasks.pct}%)`);
  console.log(`  Verificación ${i.verify ? (i.verify === 'APROBADO' ? color.green(i.verify) : color.red(i.verify)) : color.gray('pendiente')}`);
  const tasksFile = path.join(i.dir, 'tasks.md');
  if (fs.existsSync(tasksFile)) {
    const pending = fs.readFileSync(tasksFile, 'utf8').split('\n').filter((l) => /^\s*[-*] \[ \]/.test(l)).slice(0, 8);
    if (pending.length) {
      console.log(color.bold('\n  Próximas tareas:'));
      pending.forEach((l) => console.log('   ' + l.trim()));
    }
  }
  console.log('');
}

function cmdView(root) {
  const act = activeChanges(root);
  const arc = archivedChanges(root);
  const specs = listDirs(paths(root).current);
  console.log(color.bold('\n╔══════════════════════════════════════════════╗'));
  console.log(color.bold('║   CDF · Dashboard de specs y cambios         ║'));
  console.log(color.bold('╚══════════════════════════════════════════════╝'));
  console.log(`  Specs vigentes: ${color.cyan(specs.length)}   Cambios activos: ${color.yellow(act.length)}   Completados: ${color.green(arc.length)}\n`);
  if (act.length) {
    const flow = ['EXPLORE', 'PROPOSED', 'APPLY', 'IMPLEMENTED', 'VERIFIED'];
    table(
      act.map((n) => {
        const i = changeInfo(root, n);
        const idx = flow.findIndex((f) => i.phase.startsWith(f.split(' ')[0]));
        const steps = ['propose', 'apply', 'verify', 'archive'].map((s, k) => (k < Math.max(idx, 0) ? color.green('●') : color.gray('○'))).join(' ');
        return [n, phaseColor(i.phase), steps, `${bar(i.tasks.pct, 12)} ${i.tasks.done}/${i.tasks.total}`, i.verify || '-'];
      }),
      ['Cambio', 'Fase', 'P A V Ar', 'Tareas', 'Verify'],
    );
  } else console.log(color.gray('  No hay cambios activos. Inicia uno con /sdd-propose <nombre> en Claude Code.'));
  console.log('');
}

function cmdArchive(root, args) {
  const name = resolveChange(root, args._[1]);
  const i = changeInfo(root, name);
  const problems = [];
  if (i.tasks.total === 0 || i.tasks.done < i.tasks.total) problems.push(`tareas incompletas (${i.tasks.done}/${i.tasks.total})`);
  if (i.verify !== 'APROBADO') problems.push(`verificación no aprobada (${i.verify || 'sin verify-report.md'})`);
  if (problems.length && !args.force) {
    console.error(color.red(`✖ No se puede archivar "${name}": ${problems.join('; ')}.`));
    console.error(color.gray('  Ejecuta /sdd-verify en Claude Code y "cdf verify". Usa --force solo con aprobación explícita del líder técnico.'));
    process.exit(1);
  }
  const p = paths(root);
  // Las specs delta deben haberse fusionado en specs/current por /sdd-archive; si una capacidad no existe, se copia.
  for (const rel of i.specs) {
    const cap = rel.split(/[\\/]/)[1];
    const target = path.join(p.current, cap, 'spec.md');
    if (!fs.existsSync(target)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(i.dir, rel), target);
      console.log(color.green(`  + specs/current/${cap}/spec.md (nueva capacidad)`));
    }
  }
  const dest = path.join(p.archive, `${today()}-${name}`);
  fs.mkdirSync(p.archive, { recursive: true });
  fs.renameSync(i.dir, dest);
  fs.mkdirSync(path.dirname(p.events), { recursive: true });
  fs.appendFileSync(p.events, JSON.stringify({ ts: new Date().toISOString(), type: 'archive', change: name, forced: !!args.force }) + '\n');
  console.log(color.green(`✔ Cambio "${name}" archivado en ${path.relative(root, dest)}`));
}

module.exports = { paths, activeChanges, archivedChanges, changeInfo, cmdList, cmdShow, cmdStatus, cmdView, cmdArchive };
