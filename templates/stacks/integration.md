# Guardrails · Stack Integración

Aplican a `src/integration` (APIs, colas, ETL, conectores).

- **G-INT-01** Contratos versionados (OpenAPI / AsyncAPI / esquemas) antes de implementar; viven junto al código.
- **G-INT-02** Idempotencia en consumidores y endpoints de escritura (clave de idempotencia o deduplicación).
- **G-INT-03** Reintentos con backoff exponencial, timeouts y circuit breaker hacia sistemas externos.
- **G-INT-04** Cola de mensajes fallidos (DLQ) y procedimiento de reproceso documentado.
- **G-INT-05** Mapeos de datos explícitos y probados; validar esquema de entrada y salida.
- **G-INT-06** Trazabilidad extremo a extremo con correlationId propagado en encabezados/mensajes.
- **G-INT-07** Credenciales en un gestor de secretos o variables de entorno; nunca en código ni en archivos de mapeo.
- **G-INT-08** Pruebas de contrato y pruebas de integración con dobles de los sistemas externos.
