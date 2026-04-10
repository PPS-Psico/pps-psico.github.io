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

- politicas RLS demasiado amplias en tablas de negocio;
- permisos abiertos o ambiguos en tablas auxiliares;
- acciones sensibles iniciadas desde frontend sin suficiente control server-side;
- deuda documental que puede inducir malas decisiones operativas;
- integraciones antiguas o experimentales con secretos hardcodeados.

## Fuente de verdad

Las prioridades vigentes de seguridad se toman de:

- [docs/internal-professionalization-plan.md](./docs/internal-professionalization-plan.md)
- [docs/architecture-current.md](./docs/architecture-current.md)

## Criterio operativo

No considerar este archivo como certificacion, auditoria externa ni garantia de cierre.

Cada mejora relevante en permisos, migraciones, auditoria o Edge Functions deberia reflejarse aca o en la documentacion tematica correspondiente.
