# Scripts del repositorio

## Proposito

Este directorio queda reservado para utilidades alineadas con la arquitectura actual del proyecto.

## Criterio actual

- backend principal: Supabase;
- operaciones sensibles: migraciones SQL, Edge Functions y herramientas administrativas integradas;
- este directorio no deberia volver a alojar scripts de migracion o reparacion ligados a Airtable.

## Scripts que siguen teniendo sentido hoy

- `prepare-deploy.js`
- `generate-vapid-keys.js`
- scripts de backup o restore manual si se usan con criterio operativo y validacion previa
- utilidades locales puntuales que trabajen sobre Supabase o sobre artefactos del build actual

## Regla de mantenimiento

Antes de agregar un script nuevo:

1. confirmar que no corresponde mejor a `supabase/migrations` o a una Edge Function;
2. evitar dependencias de sistemas legacy;
3. documentar brevemente su proposito y entorno esperado.
