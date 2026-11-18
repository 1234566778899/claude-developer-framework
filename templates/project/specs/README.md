# Convenciones de specs (CDF)

## Cambio: `specs/changes/<cambio>/`

```
<cambio>/
├── proposal.md        Por qué, qué cambia, alcance, impacto, preguntas abiertas
├── design.md          Decisiones técnicas, componentes, contratos, datos, riesgos
├── tasks.md           Checklist por fases; cada tarea referencia REQ-IDs
├── specs/<capacidad>/spec.md   Requisitos delta (ADDED / MODIFIED / REMOVED)
└── verify-report.md   Lo genera /sdd-verify
```

El nombre del cambio va en kebab-case, corto y estable (`customer-management`).

## Formato de `spec.md`

```markdown
# Capacidad: <capacidad>

## ADDED Requirements

### Requirement: REQ-CLI-01 Registrar cliente
El sistema SHALL permitir registrar un cliente con identificación única.
Fuente: DEF §4.2 Reglas de negocio, RN-03

#### Escenario: registro exitoso
- GIVEN un usuario con rol Asesor
- WHEN registra un cliente con cédula válida no existente
- THEN el sistema guarda el cliente y muestra el código generado

#### Escenario: cédula duplicada
- GIVEN un cliente existente con la cédula 0102030405
- WHEN se intenta registrar otro cliente con la misma cédula
- THEN el sistema rechaza el registro con el mensaje "Cliente ya existe"

## MODIFIED Requirements
(requisito completo con su nueva redacción y el ID original)

## REMOVED Requirements
### Requirement: REQ-XXX-NN <nombre>
Motivo: …
```

Reglas:
- Usa SHALL / MUST para comportamiento obligatorio; SHOULD solo si el DEF lo marca como deseable.
- Cada requisito tiene al menos un escenario; los escenarios son verificables con una prueba.
- Cada requisito indica su `Fuente:` en el DEF. Sin fuente → no es un requisito, es una pregunta abierta.

## Formato de `tasks.md`

```markdown
## Fase 1 — Modelo de datos
- [ ] 1.1 Crear entidad Cliente (REQ-CLI-01)
- [ ] 1.2 Migración de base de datos (REQ-CLI-01)

## Fase 2 — API
- [ ] 2.1 POST /clientes con validación de cédula (REQ-CLI-01, REQ-CLI-02)
- [ ] 2.2 Pruebas de los escenarios "registro exitoso" y "cédula duplicada"
```

## Specs vigentes: `specs/current/<capacidad>/spec.md`

Contienen solo requisitos vigentes (sin secciones ADDED/MODIFIED/REMOVED). `/sdd-archive` fusiona los deltas aquí.
