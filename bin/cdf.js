#!/usr/bin/env node
'use strict';
const { VERSION, color, parseArgs, requireRoot } = require('../lib/util');
const init = require('../lib/init');
const changes = require('../lib/changes');
const { cmdConvert } = require('../lib/docx');
const { cmdCompleteness } = require('../lib/completeness');
const { cmdVerify } = require('../lib/verify');
const { cmdUsage, cmdReport } = require('../lib/usage');
const { cmdModels } = require('../lib/models');

const HELP = `
${color.bold(`CDF · Claude Developer Framework ${VERSION}`)}
Desarrollo guiado por especificaciones (SDD) con Claude Code.

${color.bold('Instalación y diagnóstico')}
  cdf --version | --help
  cdf doctor                         Verifica node, git y Claude Code
  cdf stacks list | show <stack>     Stacks soportados (web, mobile, integration)
  cdf update [--force]               Regenera comandos, agentes y hooks del proyecto

${color.bold('Proyecto')}
  cdf init [--stack web,mobile,integration|all] [--force]
  cdf verify [--json]                Controles transversales → Estado: APROBADO/RECHAZADO

${color.bold('DEF (requerimientos)')}
  cdf convert <DEF.docx> -o <requerimientos.md> [--force] [--json]
  cdf completeness <archivo.md> [...] [--json]

${color.bold('Specs y cambios')}
  cdf list [--specs | --changes]
  cdf show <cambio>
  cdf status [--change <cambio>] [--json]
  cdf view                           Dashboard en terminal
  cdf archive <cambio> [--force]     Mueve el cambio a specs/changes/archive

${color.bold('Métricas y modelos')}
  cdf usage [--change <cambio>] [--since AAAA-MM-DD] [--json]
  cdf report [--change <cambio>] [--json]
  cdf models [set <etapa> <modelo> | apply | reset]

${color.bold('En Claude Code (chat)')}
  /sdd-explore  /sdd-propose <cambio>  /sdd-apply  /sdd-sync  /sdd-verify  /sdd-archive
`;

const COMMANDS = {
  init: [init.cmdInit, false], update: [init.cmdUpdate, true], doctor: [init.cmdDoctor, false], stacks: [init.cmdStacks, false],
  verify: [cmdVerify, true], convert: [cmdConvert, false], completeness: [cmdCompleteness, false],
  list: [changes.cmdList, true], show: [changes.cmdShow, true], status: [changes.cmdStatus, true], view: [changes.cmdView, true],
  archive: [changes.cmdArchive, true], usage: [cmdUsage, true], report: [cmdReport, true], models: [cmdModels, true],
};

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.version || args.v) return console.log(VERSION);
  const cmd = args._[0];
  if (!cmd || args.help || args.h || cmd === 'help') return console.log(HELP);
  const entry = COMMANDS[cmd];
  if (!entry) { console.error(color.red(`Comando desconocido: ${cmd}`)); console.log(HELP); process.exit(1); }
  const [fn, needsRoot] = entry;
  try {
    await fn(needsRoot ? requireRoot() : null, args);
  } catch (e) {
    console.error(color.red(`✖ ${e.message}`));
    if (process.env.CDF_DEBUG) console.error(e.stack);
    process.exit(1);
  }
})();
