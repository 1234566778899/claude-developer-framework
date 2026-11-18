'use strict';
const fs = require('fs');
const path = require('path');
const { color, table, readConfig, writeConfig } = require('./util');

// Tabla de ruteo por defecto (editable en .cdf/config.json → models, gobernada por Arquitectura).
const DEFAULT_MODELS = {
  explore: { command: 'sdd-explore', model: 'sonnet', escalation: 'opus', when: 'Código legado extenso, varias integraciones o análisis de imágenes/diagramas complejos' },
  propose: { command: 'sdd-propose', model: 'opus', escalation: null, when: 'Ya usa el modelo de mayor capacidad' },
  apply: { command: 'sdd-apply', model: 'sonnet', escalation: 'opus', when: 'Pruebas que fallan tras 2 intentos, refactor transversal o concurrencia' },
  sync: { command: 'sdd-sync', model: 'sonnet', escalation: 'opus', when: 'La desviación cambia reglas o contratos de varias capacidades' },
  verify: { command: 'sdd-verify', model: 'opus', escalation: null, when: 'Ya usa el modelo de mayor capacidad' },
  archive: { command: 'sdd-archive', model: 'haiku', escalation: 'sonnet', when: 'Fusión de specs con conflictos entre requisitos MODIFIED/REMOVED' },
};
const VALID = ['opus', 'sonnet', 'haiku', 'inherit'];

function setFrontmatterModel(file, model) {
  if (!fs.existsSync(file)) return false;
  let txt = fs.readFileSync(file, 'utf8');
  const fm = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return false;
  let body = fm[1];
  if (model === 'inherit') body = body.replace(/^model:.*\r?\n?/m, '');
  else if (/^model:/m.test(body)) body = body.replace(/^model:.*$/m, `model: ${model}`);
  else body += `\nmodel: ${model}`;
  txt = txt.replace(fm[0], `---\n${body.trim()}\n---`);
  fs.writeFileSync(file, txt);
  return true;
}

function applyModels(root, models) {
  for (const [, m] of Object.entries(models)) {
    setFrontmatterModel(path.join(root, '.claude', 'commands', `${m.command}.md`), m.model);
  }
}

function cmdModels(root, args) {
  const cfg = readConfig(root);
  cfg.models ||= DEFAULT_MODELS;
  const sub = args._[1];
  if (sub === 'set') {
    const [stage, model] = args._.slice(2);
    if (!cfg.models[stage] || !VALID.includes(model)) {
      console.error(color.red(`Uso: cdf models set <${Object.keys(cfg.models).join('|')}> <${VALID.join('|')}>`));
      process.exit(1);
    }
    cfg.models[stage].model = model;
    writeConfig(root, cfg);
    applyModels(root, cfg.models);
    console.log(color.green(`✔ ${stage} → ${model} (actualizado .claude/commands/${cfg.models[stage].command}.md)`));
    return;
  }
  if (sub === 'apply' || sub === 'reset') {
    if (sub === 'reset') cfg.models = DEFAULT_MODELS;
    writeConfig(root, cfg);
    applyModels(root, cfg.models);
    console.log(color.green('✔ Tabla de ruteo aplicada a los comandos /sdd-*'));
    return;
  }
  if (args.json) return console.log(JSON.stringify(cfg.models, null, 2));
  console.log(color.bold('\nTabla de ruteo de modelos (Claude Code)\n'));
  table(Object.entries(cfg.models).map(([s, m]) => [s, `/${m.command}`, color.cyan(m.model), m.escalation || '-', m.when]),
    ['Etapa', 'Comando', 'Principal', 'Escalamiento', 'Cuándo escalar']);
  console.log(color.gray('\n  Escalar en caliente dentro de Claude Code: /model <modelo>, luego /model default para volver.'));
  console.log(color.gray('  Cambiar la tabla: cdf models set <etapa> <opus|sonnet|haiku|inherit>\n'));
}

module.exports = { cmdModels, applyModels, DEFAULT_MODELS };
