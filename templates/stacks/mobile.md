# Guardrails · Stack Mobile

Aplican a `src/mobile`.

- **G-MOB-01** Separar UI, estado y acceso a datos (p. ej. MVVM / Clean Architecture).
- **G-MOB-02** Almacenamiento seguro (Keychain / Keystore) para tokens; nunca en preferencias planas.
- **G-MOB-03** Comunicación solo por HTTPS; considerar certificate pinning en flujos sensibles.
- **G-MOB-04** Manejo explícito de modo sin conexión, reintentos y tiempos de espera.
- **G-MOB-05** Permisos del dispositivo solicitados en contexto y justificados en la spec.
- **G-MOB-06** Accesibilidad: tamaños dinámicos de fuente, lectores de pantalla, áreas táctiles mínimas.
- **G-MOB-07** Sin datos personales en logs ni en reportes de errores.
- **G-MOB-08** Pruebas unitarias de lógica de presentación y pruebas de UI para los escenarios principales.
