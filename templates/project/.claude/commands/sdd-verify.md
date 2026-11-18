---
description: "CDF · Validar: contrasta la implementación con las specs del cambio y genera verify-report.md (APROBADO/RECHAZADO)."
argument-hint: "[cambio]"
allowed-tools: Read, Grep, Glob, Task, Agent, Bash, Write(specs/changes/**)
model: opus
---

Etapa **VALIDAR** del flujo CDF. Argumentos: $ARGUMENTS

Objetivo: comprobar con evidencia que la implementación cumple la especificación. **No corrijas código en esta etapa**; reporta hallazgos.

## Pasos
1. Resuelve el cambio activo (o el indicado) y lee todos sus artefactos.
2. Ejecuta la compilación y la suite de pruebas del proyecto. Registra comandos y resultados.
3. Lanza el subagente `spec-verifier` (contexto independiente, no escribió el código) pasándole la ruta del cambio, para que trace cada requisito y escenario a código y pruebas.
4. Revisa además: tareas sin marcar, código en `src/` sin REQ asociado (alcance no especificado), manejo de errores, validación de entradas, secretos y datos sensibles, logs.
5. Ejecuta `cdf verify` e incorpora sus FAILS.

## Salida: `specs/changes/<cambio>/verify-report.md`

```markdown
# Verificación · <cambio> · <AAAA-MM-DD>

## Trazabilidad
| REQ-ID | Escenario | Implementación (archivo:línea) | Prueba | Resultado |
|---|---|---|---|---|

## Pruebas ejecutadas
<comando> → <resumen de resultados>

## Hallazgos
| # | Severidad (FAIL/WARN) | Descripción | Archivo | Recomendación |
|---|---|---|---|---|

## Controles transversales (cdf verify)
<estado, FAILS, WARNS>

Estado: APROBADO | RECHAZADO
FAILS: <n>
```

Reglas para el estado: es **RECHAZADO** si algún escenario no tiene implementación o prueba que pase, si las pruebas fallan, si `cdf verify` reporta FAILS o si hay tareas pendientes. Solo en otro caso es **APROBADO**.

Cierra indicando: si está RECHAZADO, qué corregir (con `/sdd-apply`) y volver a verificar; si está APROBADO, el siguiente paso `/sdd-archive <cambio>`.
