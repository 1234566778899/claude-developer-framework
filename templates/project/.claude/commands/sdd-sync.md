---
description: "CDF · Sincronizar: alinea proposal/design/tasks/specs del cambio con desviaciones aprobadas durante la implementación."
argument-hint: "[cambio] [descripción de la desviación]"
allowed-tools: Read, Grep, Glob, Bash(cdf:*), Bash(git diff:*), Bash(git log:*), Write(specs/changes/**), Edit(specs/changes/**)
model: sonnet
---

Etapa **SYNC** del flujo CDF. Argumentos: $ARGUMENTS

1. Resuelve el cambio activo (o el indicado).
2. Compara los artefactos del cambio con el código actual (`git diff`) y con la desviación descrita.
3. Clasifica cada diferencia:
   - **Técnica** (diseño, tareas): actualiza `design.md` / `tasks.md`.
   - **Funcional** (comportamiento, reglas): requiere respaldo en el DEF o aprobación explícita del PO. Si no la hay, NO modifiques la spec: regístrala en *Preguntas abiertas* de `proposal.md` y detente.
4. Mantén IDs de requisito estables; agrega `Cambio: <motivo> (<fecha>)` bajo cada requisito modificado.
5. No modifiques código en esta etapa.

Cierra con una tabla: artefacto | cambio realizado | motivo | aprobado por.
