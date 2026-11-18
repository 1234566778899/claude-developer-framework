# CDF · Claude Developer Framework — Guía de uso

Desarrollo High Code asistido por IA con **Claude Code**, basado en especificaciones (SDD), con guardrails, ruteo de modelos, métricas y trazabilidad. Es el equivalente del BDF (que usa GitHub Copilot + OpenSpec), construido sobre capacidades nativas de Claude Code.

| BDF (Copilot) | CDF (Claude Code) | Cómo se implementa |
|---|---|---|
| `bit` CLI | `cdf` CLI | Node.js sin dependencias (`bin/cdf.js`) |
| `/opsx:explore … archive` | `/sdd-explore … /sdd-archive` | Slash commands en `.claude/commands/` |
| Guardrails corporativos | Hooks + permisos | `.claude/hooks/guard.js` (PreToolUse) bloquea secretos, `.env`, comandos destructivos y código en `src/` sin cambio activo |
| Instrucciones del proyecto | `CLAUDE.md` + reglas por stack | `.claude/rules/cdf-stack-*.md` importadas con `@` |
| Tabla de ruteo de modelos | `model:` en cada comando | `cdf models` / `cdf models set apply opus` |
| Selección automática (próxima versión) | Ya incluida | Cada `/sdd-*` corre con su modelo; escalamiento con `/model` |
| `bit usage` / `bit report` | `cdf usage` / `cdf report` | Lee los transcripts locales de Claude Code + eventos del hook `track.js` |
| Verificación de spec | `/sdd-verify` + subagente `spec-verifier` | Revisor con contexto independiente que no escribió el código |
| `openspec/` | `specs/current`, `specs/changes`, `specs/changes/archive` | Mismo modelo de deltas ADDED/MODIFIED/REMOVED |

## 1. Instalación

Requisitos: Node.js 18+, Git, PowerShell y **Claude Code** (`npm install -g @anthropic-ai/claude-code`) con una cuenta corporativa activa.

```powershell
Unblock-File .\install-cdf.ps1
powershell -ExecutionPolicy Bypass -File .\install-cdf.ps1
```

Verificar en una terminal nueva:

```powershell
cdf --version
cdf doctor
```

Alternativa: `npm install -g .` desde la carpeta del framework.

## 2. Setup inicial del proyecto

```powershell
git clone <repositorio>; cd <repositorio>
cdf init                      # pregunta el stack: web, mobile, integration, todas
cdf init --stack web,integration   # sin preguntas
cdf verify                    # Estado: APROBADO y FAILS: 0
```

Estructura generada:

```
<proyecto>/
├── CLAUDE.md                     reglas del proyecto (se cargan en cada sesión)
├── .claude/
│   ├── settings.json             hooks y permisos (deny sobre .env, llaves)
│   ├── commands/sdd-*.md         flujo SDD con su modelo asignado
│   ├── agents/                   spec-verifier, codebase-explorer
│   ├── hooks/guard.js, track.js  guardrails y trazabilidad
│   └── rules/cdf-stack-*.md      guardrails del stack (G-WEB-BE-01…)
├── .cdf/config.json              stacks, guardrails, tabla de modelos, tarifas
├── docs/def/{requisitosnegocio,diagramas,manuales}, docs/metricas
├── specs/{current, changes/archive, explorations}, specs/README.md
└── src/…, tests/
```

## 3. Flujo del desarrollador (orquestador)

```
DEF aprobado → convert → completeness → /sdd-explore (opc.) → /sdd-propose → revisar
→ /sdd-apply (por fases, con revisión humana) → /sdd-verify + cdf verify → /sdd-archive → cdf report
```

1. **Ubicar el DEF** aprobado en `docs/def/requisitosnegocio/DEF-<Nombre>.docx`.
2. **Convertir**: `cdf convert docs/def/requisitosnegocio/DEF-GestionClientes.docx -o docs/def/requisitosnegocio/requerimientos.md`. Compara con el Word y corrige solo errores de conversión.
3. **Completitud**: `cdf completeness docs/def/requisitosnegocio/requerimientos.md`. Si el estado es INSUFICIENTE, el DEF regresa a QA Funcional / PO. `/sdd-propose` también lo comprueba y se niega a continuar.
4. **Explorar** (opcional), dentro de `claude`: `/sdd-explore gestión de clientes` (puedes pegar imágenes de pantallas o diagramas).
5. **Proponer**: `/sdd-propose customer-management` → `proposal.md`, `design.md`, `tasks.md`, `specs/<capacidad>/spec.md`. En otra terminal: `cdf show customer-management`, `cdf view`.
6. **Implementar**: `/sdd-apply customer-management` ejecuta una fase, marca `tasks.md` y se detiene para revisión. Continúa con `/sdd-apply customer-management 2`. Si la spec resulta incorrecta: `/sdd-sync`.
7. **Validar**: `/sdd-verify` genera `verify-report.md` (trazabilidad REQ → código → prueba) y `cdf verify` revisa controles transversales. Corrige los FAILS y repite.
8. **Archivar**: `/sdd-archive` fusiona las specs en `specs/current/` y ejecuta `cdf archive`, que solo archiva con tareas completas y verificación APROBADA.
9. **Métricas**: `cdf report` (se guarda en `docs/metricas/`) y `cdf usage --change customer-management`.

**Regla:** la spec define el comportamiento esperado; el código demuestra que se implementó. Ninguna salida de IA se usa sin revisión humana.

## 4. Guardrails activos

| Control | Dónde | Efecto |
|---|---|---|
| Código sin cambio activo | `guard.js` | Bloquea escrituras en `src/` si no hay un cambio con `tasks.md` |
| Secretos en contenido | `guard.js` | Bloquea claves AWS, llaves privadas, tokens de GitHub/Anthropic, JWT y contraseñas literales |
| Archivos sensibles | `guard.js` + `permissions.deny` | No se lee ni escribe `.env`, `*.pem`, `*.key` |
| Comandos destructivos | `guard.js` | `rm -rf /`, `git push --force`, `git reset --hard`, `git clean -fd`, `DROP TABLE` |
| Historial inmutable | `guard.js` | No se editan cambios archivados |
| Herramientas por etapa | `allowed-tools` de cada comando | Explore/Propose/Sync solo escriben en `specs/` |

Se configuran en `.cdf/config.json → guardrails`.

## 5. Ruteo de modelos

```powershell
cdf models                       # ver la tabla
cdf models set apply opus        # cambiar el modelo de una etapa (reescribe el comando)
cdf models reset                 # volver a los valores por defecto
```

| Etapa | Principal | Escalamiento | Cuándo escalar |
|---|---|---|---|
| explore | sonnet | opus | Código legado extenso, varias integraciones, imágenes complejas |
| propose | opus | – | – |
| apply | sonnet | opus | Pruebas que fallan tras 2 intentos, refactor transversal |
| sync | sonnet | opus | La desviación afecta varias capacidades |
| verify | opus | – | – |
| archive | haiku | sonnet | Conflictos al fusionar MODIFIED/REMOVED |

Para escalar en una sesión: `/model opus`, y `/model default` para volver. La tabla es propiedad de Arquitectura/VMO: se publica actualizando `.cdf/config.json → models` y se aplica con `cdf models apply`.

## 6. Métricas y consumo

- `cdf usage` muestra tokens por modelo y por cambio, leyendo `~/.claude/projects/<proyecto>/*.jsonl`.
- `cdf report` muestra fases, sesiones y minutos activos por cambio, y lo guarda en `docs/metricas/reporte-<fecha>.json`.
- **Costos:** no hay precios codificados. Registra las tarifas oficiales vigentes (USD por millón de tokens) en `.cdf/config.json`:

```json
"pricing": {
  "opus":   { "input": 0, "output": 0, "cacheWrite": 0, "cacheRead": 0 },
  "sonnet": { "input": 0, "output": 0, "cacheWrite": 0, "cacheRead": 0 },
  "haiku":  { "input": 0, "output": 0, "cacheWrite": 0, "cacheRead": 0 }
}
```

- Los minutos activos suman intervalos con menos de 10 minutos de inactividad (`metrics.idleMinutes`). No equivalen automáticamente a tiempo productivo.
- Con un plan de suscripción (Claude Team/Enterprise) el costo real es el del asiento; los tokens sirven para comparar consumo entre cambios.

## 7. Catálogo de comandos

**Terminal (`cdf`)**: `--version`, `--help`, `doctor`, `stacks list|show <s>`, `init [--stack] [--force]`, `update [--force]`, `verify [--json]`, `convert <docx> -o <md> [--force] [--json]`, `completeness <md…> [--json]`, `list [--specs|--changes]`, `show <c>`, `status --change <c> [--json]`, `view`, `archive <c> [--force]`, `usage [--change] [--since] [--json]`, `report [--json]`, `models [set|apply|reset]`.

**Claude Code (chat)**: `/sdd-explore`, `/sdd-propose <c>`, `/sdd-apply [c] [fase]`, `/sdd-sync`, `/sdd-verify`, `/sdd-archive`.

Los comandos `cdf` se ejecutan en la terminal desde la raíz del proyecto; los `/sdd-*`, en el chat de Claude Code. No son intercambiables. Después de actualizar el CLI, ejecuta `cdf update` para regenerar comandos, agentes y hooks sin tocar tu `CLAUDE.md`.
