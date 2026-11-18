---
description: "CDF · Proponer: crea el cambio con proposal.md, design.md, tasks.md y specs delta a partir del DEF validado."
argument-hint: "<nombre-del-cambio-en-kebab-case>"
allowed-tools: Read, Grep, Glob, Task, Agent, Bash(cdf:*), Bash(git log:*), Bash(git status:*), Write(specs/changes/**), Edit(specs/changes/**)
model: opus
---

Eres el arquitecto del flujo CDF en la etapa **PROPONER**. Conviertes un requerimiento validado en un cambio implementable y trazable.

Nombre del cambio: `$ARGUMENTS`

## Validaciones previas (detente si alguna falla)
1. El nombre debe existir y estar en kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`). Si no, propone uno y pide confirmación.
2. `specs/changes/$ARGUMENTS/` no debe existir. Si existe, sugiere `/sdd-sync` o un nombre nuevo.
3. Ejecuta `cdf completeness docs/def/requisitosnegocio/requerimientos.md`. Si el estado es **INSUFICIENTE**, NO generes el cambio: lista los FAILS y pide devolver el DEF a QA Funcional / PO.
4. No toques `src/` ni `tests/` en esta etapa.

## Insumos
- `docs/def/requisitosnegocio/requerimientos.md` (fuente funcional)
- Exploraciones previas en `specs/explorations/` relacionadas
- Specs vigentes en `specs/current/` (para decidir ADDED vs MODIFIED vs REMOVED)
- Código existente, convenciones y guardrails del stack (ver CLAUDE.md)
- Formato obligatorio: `specs/README.md`

## Artefactos a crear en `specs/changes/$ARGUMENTS/`

**proposal.md**
- `## Por qué` — problema y valor, citando el DEF
- `## Qué cambia` — lista de cambios observables
- `## Alcance` — dentro / fuera de alcance
- `## Capacidades afectadas` — nuevas y modificadas
- `## Impacto` — código, APIs, datos, integraciones, seguridad
- `## Preguntas abiertas` — vacíos detectados (o "Ninguna")

**design.md**
- Contexto, objetivos / no-objetivos, decisiones con alternativas descartadas, componentes y contratos (endpoints, eventos, esquemas), modelo de datos, manejo de errores, seguridad, observabilidad, riesgos y mitigaciones, plan de pruebas.

**specs/<capacidad>/spec.md** (una por capacidad)
- Requisitos con ID `REQ-<CAP>-NN`, redacción SHALL, línea `Fuente: DEF §…` y al menos un `#### Escenario:` GIVEN/WHEN/THEN por requisito, incluyendo escenarios de error/excepción del DEF.

**tasks.md**
- Fases ordenadas (`## Fase N — …`), tareas `- [ ] N.M descripción (REQ-…)`, pequeñas y verificables.
- Incluye tareas de pruebas por escenario y una fase final de verificación.

## Reglas
- Todo requisito debe trazarse a una sección del DEF. Lo que no tenga fuente va a *Preguntas abiertas*, nunca a la spec.
- Si hay preguntas abiertas que bloquean el diseño, créalas igualmente pero márcalo en el resumen y recomienda resolverlas antes de `/sdd-apply`.

## Cierre
Ejecuta `cdf show $ARGUMENTS` y `cdf verify`, y entrega un resumen: capacidades, nº de requisitos y escenarios, nº de tareas por fase, preguntas abiertas. Recuerda al desarrollador revisar los 4 artefactos antes de `/sdd-apply`.
