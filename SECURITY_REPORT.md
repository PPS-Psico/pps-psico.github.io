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

- 0B cerró la exposición de PII de `get_student_signup_status`: la respuesta de compatibilidad no devuelve PII, las vinculaciones validan identidad en servidor y la migración productiva `20260728180058_restrict_student_signup_status.sql` revocó la ejecución pública; solo `service_role` conserva acceso;
- la emisión insegura de magic-links desde FilterCodes fue deshabilitada en producción con `moodle-autologin` v9: la función exige JWT, no genera credenciales, no modifica filas y envía las cuentas existentes al login normal. La identidad federada automática solo debe volver con LTI/SSO firmado;
- el contrato `Programada` quedó soportado por la migración productiva `20260728183153_support_programmed_launches.sql` y por `launch-scheduler` v31;
- el historial local de migraciones mantiene drift semántico frente al proyecto alojado: 111 versiones remotas y 83 migraciones locales canónicas al 28/07/2026; la reparación seguirá siendo incremental y sin `db push` sobre producción;
- la reconciliación de Edge Functions fue desplegada mediante PR #5 y los crons v15/v31 ejecutaron correctamente sin `BOOT_ERROR`;
- las credenciales Hermes y Todoist que estuvieron versionadas deben considerarse comprometidas y rotarse; sus valores no deben volver a almacenarse en el repositorio;
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
