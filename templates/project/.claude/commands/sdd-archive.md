---
description: "CDF · Archivar: fusiona las specs delta en specs/current y mueve el cambio al historial."
argument-hint: "[cambio]"
allowed-tools: Read, Grep, Glob, Bash(cdf:*), Write(specs/**), Edit(specs/**)
model: haiku
---

Etapa **ARCHIVAR** del flujo CDF. Argumentos: $ARGUMENTS

## Precondiciones (detente si no se cumplen)
- `cdf status --change <cambio>` muestra todas las tareas completas.
- `specs/changes/<cambio>/verify-report.md` contiene `Estado: APROBADO`.

## Fusión de specs
Para cada `specs/changes/<cambio>/specs/<capacidad>/spec.md`:
- Si `specs/current/<capacidad>/spec.md` no existe: créalo con los requisitos de **ADDED** (sin el encabezado "ADDED Requirements"), bajo `# Capacidad: <capacidad>` y `## Requirements`.
- Si existe: agrega los ADDED, reemplaza completos los MODIFIED (mismo REQ-ID) y elimina los REMOVED.
- Conserva IDs, fuentes y escenarios. Agrega al final de la spec vigente una línea en `## Historial`: `- <AAAA-MM-DD> <cambio>`.
- Si un MODIFIED/REMOVED no existe en la spec vigente, detente y repórtalo (conflicto) — sugiere escalar con `/model sonnet`.

## Cierre
1. Ejecuta `cdf archive <cambio>`.
2. Ejecuta `cdf list` y `cdf report`.
3. Resume: capacidades actualizadas, requisitos añadidos/modificados/eliminados, ruta del archivo histórico.
