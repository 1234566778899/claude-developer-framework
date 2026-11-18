# {{PROJECT}} — Instrucciones para Claude Code

Este repositorio usa **CDF (Claude Developer Framework) {{VERSION}}**: desarrollo guiado por especificaciones (SDD).

## Reglas no negociables

1. **La spec es la fuente de verdad.** El código demuestra que el comportamiento especificado fue implementado. No implementes comportamiento que no esté en una spec aprobada.
2. **No inventes reglas de negocio.** El DEF (`docs/def/requisitosnegocio/requerimientos.md`) lo definen QA Funcional y el Product Owner. Si falta información, regístrala como *Pregunta abierta* y detente; nunca completes vacíos por interpretación propia.
3. **Ningún cambio sin cambio activo.** Todo código en `src/` pertenece a un cambio en `specs/changes/<nombre>/`. El hook `guard.js` bloquea ediciones en `src/` si no existe uno.
4. **Revisión humana obligatoria.** Al terminar cada fase de tareas, detente y resume lo hecho para que el desarrollador (orquestador) lo revise.
5. **Seguridad.** Nunca escribas secretos, credenciales ni datos personales reales en código, specs, pruebas o logs. Usa variables de entorno y `.env.example`.
6. **Trazabilidad.** Cada requisito tiene un ID (`REQ-<CAP>-NN`) que referencia la sección del DEF; cada tarea y cada prueba referencia el ID del requisito que cubre.

## Flujo de trabajo

| Etapa | Comando en Claude Code | Resultado |
|---|---|---|
| Explorar (opcional) | `/sdd-explore <tema>` | `specs/explorations/<fecha>-<tema>.md` |
| Proponer | `/sdd-propose <cambio>` | `proposal.md`, `design.md`, `tasks.md`, `specs/<capacidad>/spec.md` |
| Implementar | `/sdd-apply [cambio] [fase]` | Código + pruebas, `tasks.md` marcado |
| Ajustar specs | `/sdd-sync [cambio]` | Artefactos alineados con desviaciones aprobadas |
| Validar | `/sdd-verify [cambio]` | `verify-report.md` con `Estado: APROBADO` |
| Archivar | `/sdd-archive [cambio]` | Specs fusionadas en `specs/current/`, cambio en `archive/` |

Comandos de terminal útiles: `cdf view`, `cdf status --change <c>`, `cdf verify`, `cdf usage`.
Convenciones de formato de specs: @specs/README.md

## Estructura

- `docs/def/requisitosnegocio/` — DEF original (.docx) y `requerimientos.md`
- `docs/def/diagramas/`, `docs/def/manuales/`, `docs/metricas/`
- `specs/current/` — specs vigentes (comportamiento actual del sistema)
- `specs/changes/<cambio>/` — cambios activos; `specs/changes/archive/` — historial
- `src/` — código por stack; `tests/` — pruebas
