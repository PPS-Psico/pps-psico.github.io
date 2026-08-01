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
- el autologin de Moodle se restauró como compatibilidad transitoria sin LTI/SSO: `moodle-autologin` exige JWT y origen web permitido, solo admite cuentas ya vinculadas con rol de alumno, correo Auth confirmado y coincidencia estricta de correo, DNI, nombre y apellido, y emite un token de un solo uso sin modificar filas. FilterCodes continúa sin firma criptográfica, por lo que permanece un riesgo residual de suplantación con PII completa; debe reemplazarse por identidad federada si Moodle habilita esa posibilidad;
- el contrato `Programada` quedó soportado por la migración productiva `20260728183153_support_programmed_launches.sql` y por `launch-scheduler` v31;
- el historial de migraciones está reconciliado en 116/116 versiones al 01/08/2026; `supabase migration list --linked` confirma paridad de timestamps y las versiones `20260730120000`, `20260731120000`, `20260801135043` y `20260801135057` fueron recuperadas literalmente del ledger productivo;
- la reconciliación de Edge Functions fue desplegada mediante PR #5 y los crons v15/v31 ejecutaron correctamente sin `BOOT_ERROR`;
- las credenciales Hermes y Todoist que estuvieron versionadas deben considerarse comprometidas y rotarse; sus valores no deben volver a almacenarse en el repositorio;
- funciones `SECURITY DEFINER` expuestas deben auditarse por contrato y grants, aunque varias ya validan `auth.uid()`, `is_admin()` o `is_staff()`;
- la [protección contra contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) de Supabase Auth continúa desactivada. Debe habilitarse manualmente en `Authentication → Providers → Email / Password Security`; requiere plan Pro o superior;
- la auditoría npm del 01/08/2026 eliminó la dependencia directa `xlsx` sin uso y aplicó todas las correcciones no disruptivas. Permanecen cuatro avisos transitivos sin solución compatible: React Router en modo RSC (la app se publica como SPA estática y no usa RSC) y `uuid` vía `exceljs`; no se aplicó `npm audit fix --force` porque propone downgrades incompatibles;
- acciones sensibles iniciadas desde frontend necesitan contratos server-side y trazabilidad consistentes;
- las políticas de `storage.objects` limitan los documentos estudiantiles por carpeta/owner y el cierre expand/contract de Storage quedó completado: el frontend con URLs firmadas fue publicado y validado antes de aplicar la migración productiva `20260729182222_make_student_documents_private.sql`; `documentos_estudiantes` y `documentos_finalizacion` están privados y los objetos conservaron sus paths;
- integraciones antiguas o experimentales deben reconciliarse con las funciones efectivamente desplegadas.

## Fuente de verdad

Las prioridades vigentes de seguridad se toman de:

- [docs/internal-professionalization-plan.md](./docs/internal-professionalization-plan.md)
- [docs/architecture-current.md](./docs/architecture-current.md)

## Criterio operativo

No considerar este archivo como certificacion, auditoria externa ni garantia de cierre.

Cada mejora relevante en permisos, migraciones, auditoria o Edge Functions deberia reflejarse aca o en la documentacion tematica correspondiente.
