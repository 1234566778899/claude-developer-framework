#!/usr/bin/env node
/**
 * CDF · Trazabilidad (hooks UserPromptSubmit y PostToolUse de Claude Code)
 * Registra en .cdf/logs/events.jsonl:
 *  - cada invocación /sdd-<fase> <cambio> → relaciona la sesión con el cambio (métricas por cambio)
 *  - cada archivo modificado por Claude → evidencia de qué se tocó en qué sesión
 * Nunca bloquea: ante cualquier error termina con exit 0.
 */
'use strict';
const fs = require('fs');
const path = require('path');

try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const logFile = path.join(root, '.cdf', 'logs', 'events.jsonl');
  const stateFile = path.join(root, '.cdf', 'logs', 'state.json');
  const ts = new Date().toISOString();
  const session = input.session_id;
  let state = {};
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { /* vacío */ }
  const events = [];

  if (input.hook_event_name === 'UserPromptSubmit') {
    const m = String(input.prompt || '').trim().match(/^\/sdd-(explore|propose|apply|sync|verify|archive)\b\s*([a-z0-9][a-z0-9-]*)?/);
    if (m) {
      const phase = m[1];
      let change = m[2];
      if (!change) {
        // Sin argumento: usa el único cambio activo o el último usado en la sesión
        try {
          const dir = path.join(root, 'specs', 'changes');
          const active = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'archive').map((d) => d.name);
          change = active.length === 1 ? active[0] : (state.sessions || {})[session];
        } catch { change = (state.sessions || {})[session]; }
      }
      if (phase === 'explore' && !change) change = null;
      events.push({ ts, type: 'sdd-command', phase, change: change || null, session });
      if (change) { state.sessions = { ...(state.sessions || {}), [session]: change }; state.lastChange = change; }
    }
  } else if (input.hook_event_name === 'PostToolUse') {
    const file = input.tool_input?.file_path;
    if (file) {
      const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');
      events.push({ ts, type: 'file-change', tool: input.tool_name, file: rel, change: (state.sessions || {})[session] || null, session });
    }
  }

  if (events.length) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, events.map((e) => JSON.stringify(e)).join('\n') + '\n');
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  }
} catch { /* no interrumpir la sesión */ }
process.exit(0);
