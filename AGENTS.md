# AGENTS.md - Guia para desarrollo con IA

Este archivo documenta convenciones, flujos de trabajo y decisiones arquitectonicas para que cualquier IA (o desarrollador) pueda trabajar eficientemente en este proyecto.

## Proyecto

**Mi Panel Academico** - Sistema de gestion de Practicas Profesionales Supervisadas (PPS) para la Licenciatura en Psicologia de UFLO.

- **Stack**: React 18 + TypeScript + Vite + Supabase + TailwindCSS
- **Hosting**: GitHub Pages (build estatico)
- **DB**: Supabase (Postgres) con RLS
- **Auth**: Supabase Auth con roles (estudiante, admin, directivo, jefe)
- **Notificaciones**: Firebase Cloud Messaging + OneSignal
- **Project ID**: `qxnxtnhtbpsgzprqtrjl`

## Comandos

```bash
npm run dev          # Desarrollo local
npm run build        # Build produccion
npm run type-check   # Verificar tipos TypeScript (CORRER DESPUES DE CAMBIOS)
npm run lint         # ESLint
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier
npm run gen-types    # Regenerar tipos TypeScript desde la DB de Supabase
```

## Flujo de trabajo critico

### Tipos de Supabase (MUY IMPORTANTE)

Los tipos TypeScript de la DB estan en `src/types/supabase.ts`. **No editar a mano.**

Despues de CUALQUIER cambio en la base de datos (migracion, nueva tabla, nuevo campo, nueva RPC):

```bash
npm run gen-types
```

Esto conecta a Supabase, lee el schema actual, y regenera el archivo completo. Despues verificar con `npm run type-check`.

### Migraciones de DB

Se aplican directamente en Supabase via MCP tools:

```
supabase_apply_migration(project_id, name, query)
```

**Despues de cada migracion**: correr `npm run gen-types` y verificar que compile.

### Edge Functions

En `supabase/functions/`. Deploy con:

```bash
npx supabase functions deploy <nombre> --project-ref qxnxtnhtbpsgzprqtrjl
```

**Importante**: NO usar `deno.json` con imports JSR en las Edge Functions. Causa BOOT_ERROR. Usar imports directos de esm.sh:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

### Cron jobs (pg_cron)

Los cron jobs se configuran via migraciones SQL. Invocan Edge Functions usando `net.http_post` de pg_net. El anon key se pasa directo en el SQL del cron.

## Arquitectura

### Estructura de directorios

```
src/
  components/
    admin/         # Vista admin (seleccionador, tablas)
    student/       # Vista estudiante (HomeView, CompromisoPPSModal)
    ui/            # Componentes UI genericos
  contexts/        # React Contexts (Auth, Modal, StudentPanel)
  constants/       # Constantes y campos de DB (dbConstants.ts)
  hooks/           # Custom hooks (useSeleccionadorLogic, useConvocatorias, etc.)
  services/        # Capa de datos (dataService.ts, supabaseService.ts)
  types/           # Tipos TypeScript (supabase.ts = autogenerado, types.ts = app)
  utils/           # Utilidades (formatters, scheduleUtils, emailService)
  views/           # Paginas principales (StudentView, AdminView, etc.)
  lib/             # DB wrapper (db.ts), supabase client
supabase/
  functions/       # Edge Functions (Deno)
  migrations/      # SQL migrations (referencia local, se aplican via MCP)
```

### Convenciones

- **Campos de DB**: Se accede via constantes en `dbConstants.ts` (ej: `FIELD_HORARIO_ASIGNADO_CONVOCATORIAS`). No hardcodear nombres de columnas.
- **Capa de datos**: `db.tableName.getAll/update/create` para la mayoria de operaciones. `supabase.from()` directo solo cuando el wrapper no alcanza.
- **RLS**: Las tablas tienen Row Level Security. El estudiante solo ve sus propios datos. Para cross-user queries usar RPCs con `SECURITY DEFINER`.
- **Emails**: Templates en `src/utils/emailService.ts` con sistema de bloques `[[button|text|url]]` y variables `{{nombre}}`.
- **Commits**: Se usa commitlint con formato convencional (`feat:`, `fix:`, `chore:`). Husky + lint-staged corre ESLint y Prettier en pre-commit.

### Roles y vistas

| Ruta         | Vista         | Descripcion                                    |
| ------------ | ------------- | ---------------------------------------------- |
| `/admin`     | AdminView     | Panel coordinador (seleccion de estudiantes)   |
| `/student`   | StudentView   | Panel estudiante (inscripcion, consentimiento) |
| `/directivo` | DirectivoView | Vista directivo                                |
| `/jefe`      | JefeView      | Vista jefe de carrera                          |

### Seleccionador (flujo principal)

1. Admin abre mesa de seleccion para un lanzamiento
2. Ve inscriptos con sus horarios elegidos
3. Puede eliminar horarios individuales de un estudiante (si eligio varios) antes de seleccionarlo
4. Selecciona estudiantes → se crea registro en `practicas` + se envia email
5. Cierra la mesa → se envian emails masivos a seleccionados y no seleccionados

### Consentimiento digital (flujo automatico)

1. Estudiante seleccionado → `selected_at` se registra en `convocatorias`
2. A las 12hs sin aceptar → Edge Function envia email recordatorio
3. A las 24hs sin aceptar → baja automatica + email al estudiante + email al coordinador
4. Cron: pg_cron cada 10 min → Edge Function `check-consentimiento-pendientes`

## Errores conocidos y soluciones

| Problema                                  | Solucion                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| Edge Function BOOT_ERROR 503              | Quitar deno.json, usar imports esm.sh directos                                          |
| "Could not embed" en supabase-js          | Dos FKs entre las mismas tablas. Usar querys separadas en vez de embed.                 |
| Estudiante no ve nombres de otros         | RLS de estudiantes solo permite perfil propio. Usar RPC `get_seleccionados_for_launch`. |
| `now() - interval` en supabase-js filters | No funciona. Calcular fechas en JS y pasar ISO strings.                                 |

## Antes de commitear

1. `npm run type-check` - debe pasar sin errores
2. Husky corre lint-staged automaticamente (ESLint + Prettier)
3. No pushear sin que type-check pase
