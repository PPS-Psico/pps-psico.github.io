# Fase 0 — Baseline técnico

Fecha de verificación: 2026-07-28.
Proyecto Supabase: `qxnxtnhtbpsgzprqtrjl`.

## Objetivo

Establecer una fuente de verdad reproducible antes del rediseño general. Esta fase no cambia la experiencia funcional salvo para cerrar defectos o riesgos críticos.

## Baseline verificado

- `npm run type-check`: correcto.
- `npm run build`: correcto; 2.871 módulos y aproximadamente 3m26s.
- CSS principal: 420,73 kB; existen chunks mayores a 500 kB.
- ESLint inicial: 2.050 errores; 2.047 correspondían al tipo autogenerado y tres a código editable.
- ESLint después de 0A: 0 errores y 512 advertencias clasificables.
- Jest mostró todas las suites ejecutadas como correctas, pero la corrida completa excedió 240 segundos.
- RLS está activo en las tablas públicas inspeccionadas.
- El historial local y remoto de migraciones presenta drift severo.
- Las Edge Functions locales y desplegadas no coinciden completamente.

## Riesgos bloqueantes

1. ~~La RPC anónima `get_student_signup_status` devuelve datos personales.~~ Cerrado en 0B: conserva temporalmente una respuesta de compatibilidad, pero todas las columnas de PII son `NULL` y ya no consulta `auth.users` por correo.
2. `Programada` se usa en frontend y scheduler, pero no está admitido por el `CHECK` de DB.
3. Las migraciones no permiten reconstruir con confianza el estado alojado.
4. Hay seis pares de foreign keys duplicadas.

## Fase 0B — Alta segura

- La consulta pública dejó de devolver nombre, DNI, correo, teléfono, UUID y estado.
- El registro manual ya no precarga PII: solicita los datos y los valida al vincular la cuenta autenticada.
- `register_new_student` exige coincidencia de DNI y correo confirmado con la fila precargada; no permite sobrescribir esa identidad.
- `register_campus_student` resuelve INSERT o vinculación en una transacción y aplica la misma coincidencia estricta cuando el legajo ya existe.
- Residual temporal: el preflight de compatibilidad aún diferencia `not_found`, `linked` y `available` para no romper la versión estática ya publicada. El frontend nuevo no lo consume; la revocación quedó preparada en `20260728173000_restrict_student_signup_status.sql`, pero solo debe aplicarse después de desplegar esa versión.
- Cerrado en producción: `moodle-autologin` v8 quedó desplegada con `verify_jwt: true`, sin import map ni `deno.json`. Ya no emite magic-links, OTP ni sesiones, no modifica filas y solo devuelve una razón sin PII. Los smoke tests de `not_registered`, `no_account` y `manual_login` respondieron HTTP 200.
- FilterCodes solo decide entre alta guiada y login normal. LTI/SSO firmado sigue siendo necesario para recuperar un ingreso federado automático confiable.
- Pendiente de configuración: activar **Prevent use of leaked passwords** en Supabase Dashboard (`Authentication → Providers → Email / Password Security`). Requiere plan Pro o superior y no está expuesto por las herramientas MCP actuales.

## Orden de ejecución

- [x] 0A. Crear baseline y recuperar un gate de lint útil.
- [x] 0B. Rediseñar y endurecer el alta de estudiante sin exponer PII.
- [ ] 0C. Unificar el contrato de publicación programada.
- [ ] 0D. Reconciliar Edge Functions locales y desplegadas.
- [ ] 0E. Reparar historial de migraciones en un entorno controlado.
- [ ] 0F. Capturar baseline visual de rutas, roles y viewports.

## Reglas de seguridad

- No reparar el historial directamente sobre producción sin backup y rama de desarrollo.
- No modificar la firma de una RPC pública sin revisar todos sus consumidores.
- Aplicar cambios de DB por migración, regenerar `src/types/supabase.ts` y correr type-check.
- Actualizar este documento cuando cierre cada bloque.
