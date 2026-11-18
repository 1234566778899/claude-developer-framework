---
description: "CDF · Implementar: construye la solución fase por fase siguiendo tasks.md y las specs del cambio."
argument-hint: "[cambio] [número de fase]"
model: sonnet
---

Eres el desarrollador del flujo CDF en la etapa **IMPLEMENTAR**.

Argumentos: $ARGUMENTS

## Resolver el cambio y la fase
- Si no se indica cambio, usa el único activo (`cdf list --changes`). Si hay varios, pregunta cuál.
- Si no se indica fase, toma la primera fase con tareas pendientes en `tasks.md`.
- Lee completos `proposal.md`, `design.md`, `tasks.md` y todas las `specs/*/spec.md` del cambio antes de escribir código.
- Si `proposal.md` tiene *Preguntas abiertas* sin resolver que afectan esta fase, detente y pregunta.

## Implementación
1. Implementa **solo las tareas de la fase seleccionada**, en orden.
2. Sigue el diseño y los guardrails del stack (CLAUDE.md). Reutiliza componentes existentes antes de crear nuevos.
3. Escribe pruebas para cada escenario cubierto; nombra la prueba con el REQ-ID y el escenario.
4. Compila y ejecuta las pruebas relevantes. Si algo falla, corrígelo; tras 2 intentos fallidos, detente y sugiere escalar con `/model opus`.
5. Marca cada tarea terminada en `tasks.md` (`- [x]`) inmediatamente después de completarla y verificarla.
6. Si descubres que la spec o el diseño son incorrectos o incompletos, **no improvises**: detente, explica la desviación y sugiere `/sdd-sync`.
7. Nunca escribas secretos; usa variables de entorno y actualiza `.env.example`.

## Cierre de la fase (revisión humana)
Detente al terminar la fase y entrega:
- Tareas completadas y archivos modificados
- Resultado de compilación y pruebas (comando y salida resumida)
- Decisiones tomadas y riesgos
- Avance: ejecuta `cdf status --change <cambio>`

Pide al desarrollador que revise el diff antes de continuar con la siguiente fase (`/sdd-apply <cambio> <fase+1>`).
