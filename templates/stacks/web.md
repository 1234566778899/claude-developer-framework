# Guardrails · Stack Web

Aplican a `src/frontend` y `src/backend`. El ID del guardrail se cita en revisiones y métricas.

## Backend
- **G-WEB-BE-01** Arquitectura en capas: controlador → servicio → repositorio. Sin lógica de negocio en controladores.
- **G-WEB-BE-02** Validar toda entrada en el borde (DTO/esquema). Nunca confiar en datos del cliente.
- **G-WEB-BE-03** Consultas parametrizadas u ORM. Prohibido concatenar SQL.
- **G-WEB-BE-04** Errores con formato uniforme (código, mensaje, traceId). No exponer stack traces.
- **G-WEB-BE-05** Autenticación y autorización explícitas por endpoint; principio de mínimo privilegio.
- **G-WEB-BE-06** Logs estructurados sin datos personales ni secretos; incluir correlationId.
- **G-WEB-BE-07** Configuración por variables de entorno; documentar cada variable en `.env.example`.
- **G-WEB-BE-08** Pruebas unitarias de servicios y pruebas de integración de endpoints por escenario de la spec.

## Frontend
- **G-WEB-FE-01** Componentes pequeños y reutilizables; estado local salvo necesidad compartida.
- **G-WEB-FE-02** Accesibilidad: etiquetas en formularios, contraste suficiente, navegación por teclado.
- **G-WEB-FE-03** Validación en cliente como ayuda; la autoritativa es la del backend.
- **G-WEB-FE-04** Sin secretos ni llaves en el bundle. Las URLs de API se configuran por entorno.
- **G-WEB-FE-05** Estados de carga, vacío y error en cada vista que consume datos.
- **G-WEB-FE-06** Pruebas de componentes para los escenarios de la spec que tengan interfaz.
