# Estado de seguridad

## Alcance

Este archivo reemplaza el antiguo "reporte final" que presentaba la seguridad como cerrada y puntuada de forma definitiva.

Ese framing ya no es valido para este repo.

La aplicacion tiene medidas reales de seguridad implementadas, pero el estado correcto hoy es:

- seguridad en progreso;
- endurecimiento pendiente en RLS y permisos;
- necesidad de auditar acciones administrativas sensibles;
- necesidad de mantener separacion clara entre frontend y operaciones privilegiadas.

## Situacion actual resumida

- Supabase es el backend principal.
- La base usa RLS de forma extendida.
- Existen Edge Functions para operaciones sensibles.
- Siguen existiendo riesgos por politicas demasiado amplias o herencia de decisiones practicas.
- La seguridad debe evaluarse junto con migraciones, permisos y trazabilidad, no solo con chequeos de frontend.

## Riesgos prioritarios

- 0B cerró la exposición de PII de `get_student_signup_status`: la respuesta de compatibilidad devuelve esas columnas en `NULL`, no consulta correos de Auth y las vinculaciones validan DNI + correo confirmado en servidor. La revocación de `anon` quedó preparada en `20260728173000_restrict_student_signup_status.sql`, pero no debe aplicarse hasta publicar el frontend actualizado; mientras tanto todavía permite inferir si un legajo está disponible o vinculado;
- la emisión insegura de magic-links desde FilterCodes fue deshabilitada en producción con `moodle-autologin` v8: la función exige JWT, no usa import map, no genera credenciales, no modifica filas, no registra PII y envía las cuentas existentes al login normal. La identidad federada automática solo debe volver con LTI/SSO firmado;
- el frontend y `launch-scheduler` usan `Programada`, pero el `CHECK` real de `lanzamientos_pps` no admite ese estado;
- el historial local de migraciones tiene drift severo frente al proyecto alojado y no es hoy una reconstrucción confiable;
- funciones `SECURITY DEFINER` expuestas deben auditarse por contrato y grants, aunque varias ya validan `auth.uid()`, `is_admin()` o `is_staff()`;
- la [protección contra contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) de Supabase Auth continúa desactivada. Debe habilitarse manualmente en `Authentication → Providers → Email / Password Security`; requiere plan Pro o superior;
- acciones sensibles iniciadas desde frontend necesitan contratos server-side y trazabilidad consistentes;
- integraciones antiguas o experimentales deben reconciliarse con las funciones efectivamente desplegadas.

## Fuente de verdad

Las prioridades vigentes de seguridad se toman de:

- [docs/internal-professionalization-plan.md](./docs/internal-professionalization-plan.md)
- [docs/architecture-current.md](./docs/architecture-current.md)

## Criterio operativo

No considerar este archivo como certificacion, auditoria externa ni garantia de cierre.

Cada mejora relevante en permisos, migraciones, auditoria o Edge Functions deberia reflejarse aca o en la documentacion tematica correspondiente.
