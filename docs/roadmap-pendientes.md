# Roadmap de pendientes — profesionalización interna

Consolidado de todo lo que queda, ordenado por prioridad. Estado al cierre de la
sesión de mejoras internas (app + base + tipos + seguridad + modernización).

El detalle de lo ya hecho está en `internal-professionalization-plan.md`
(secciones 14 en adelante). Estado base verificado: **type-check 0, 218 tests, build OK**.

> **Sesión 8 (calidad, no solo tipos).** Se creó `docs/auditoria-calidad.md` con el
> informe de hallazgos. Hecho en esta sesión:
>
> - 🗑️ **Código muerto eliminado**: `SolicitudesCorreccionManager.tsx` (~644 líneas,
>   duplicado sin imports) y `useCycleReset.ts` (sin uso + bug `gestionStatus`).
> - 🧪 **+12 tests** (206 → 218): `useFinalizacionLogic` (integración con mockDb) y
>   `gestionHelpers` (unitarios puros). Los archivos nuevos están **untracked**: hay que
>   `git add` + commitear (la gestión de git/cutover la lleva el owner / otra sesión).
> - 🔀 Se resolvió un merge con `origin/main` (tomando HEAD, validado como superconjunto).
>
> **Pendiente de calidad (de la auditoría, por prioridad):**
>
> - 🔴 **Más tests de comportamiento**: tabs de `SolicitudesManager`, editores de DB,
>   `useConvocatorias` (inscripción/baja). Es la red de seguridad que falta.
> - 🟠 **Validación con `zod` en el borde de datos** (`lib/db.ts`/`supabaseService`):
>   ataca la raíz del `any` (filas sin validar + acceso por clave dinámica) y evita casts.
> - 🟠 **`eslint --fix` de formato** (~5141 problemas auto-corregibles) en un commit aparte
>   - chequeo de formato en CI. Deja ~1609 warnings reales para tratar caso por caso.
> - 🟢 **Bug menor**: `HomeView` lee `FIELD_HORAS_PRACTICAS` sobre `convocatorias` (campo de
>   `practicas`) → suma 0 siempre. Revisar.
> - 🟢 **Componentes gigantes** con lógica en JSX (`GestionView` 1397, `WhatsAppContactClassifier`
>   1432, `SeguroGenerator` 1103, `Auth` 959): extraer hooks/subcomponentes.

---

## 🔴 P0 — Acciones del owner (bloquean/seguridad, no las puede hacer el agente)

1. **Rotar 3 secretos expuestos** (estuvieron en el repo o en el chat → comprometidos):
   - PAT de Supabase (`sbp_...`) → revocar en https://supabase.com/dashboard/account/tokens
     y actualizar `SUPABASE_ACCESS_TOKEN` en `~/.kiro/settings/mcp.json`.
   - Token de Todoist (estaba hardcodeado en `todoistDirectService.ts`).
   - Token interno de Hermes (estaba hardcodeado en `AdminDashboard.tsx`).
   - Tras rotar: setear los nuevos valores como env vars (`.env` local + secrets de CI/GitHub).
2. **Login del MCP de Aikido** (SAST) → abrir la URL de la región y autorizar; luego el
   agente corre `aikido_full_scan` sobre lo modificado.
3. **(Opcional) Login del MCP de Supabase** vía OAuth, o ya quedó el server por token
   configurado en `mcp.json` (funciona al reconectar).

## 🟠 P1 — Base de datos (vía advisors; aditivo/seguro lo hace el agente)

- **Habilitar `auth_leaked_password_protection`** (HaveIBeenPwned) — toggle de Auth,
  beneficioso, afecta signup/cambio de contraseña. (pendiente: decisión del owner)
- **`multiple_permissive_policies` x21** — consolidar políticas RLS permisivas múltiples
  por rol/acción (perf). Requiere rework + validar flujos por tabla. NO trivial.
- **`unused_index` x11** — evaluar `DROP INDEX` (ahorra costo de escritura). Confirmar
  con métricas de uso real antes de dropear.
- **Revisar grants de RPCs `SECURITY DEFINER` ejecutables por anon/authenticated** (x71)
  — mayormente intencional (son las RPCs de la app), pero conviene auditar cuáles
  podrían restringirse.
- **`extension_in_public` x2** y **`public_bucket_allows_listing` x1** — revisar caso por caso
  (mover extensiones a schema propio es riesgoso; el bucket público puede ser intencional).

## 🟡 P2 — Reducción de `any` (incremental)

Patrones y enfoque (guiado por el warning `@typescript-eslint/no-explicit-any` ya activo):

- **`catch (e: any)`** → `catch (e)` + `getErrorMessage(e)`
  (util en `src/utils/getErrorMessage.ts`).
- **`useState<any>`** → tipar el estado real por componente
  (patrón `ToastState`, `EditingState`, filas tipadas por tabla).
- **`as any` / `: any`** en componentes grandes — trabajo por sitio con QA manual.
- Reusar el patrón "tipar el contrato" (`DashboardData`/`MetricRow`, `RtRow`,
  `EnrollmentFormData`, `FinalizacionRequest`) donde aplique.

Prioridad: servicios/hooks/contextos antes que componentes de presentación.

### Progreso de `any` (conteo `\bany\b`, excluye tests)

- Sesión 1 (capa de datos + monolitos + RPC): 665 → ~520.
- Sesión 2 (lógica): hooks (`useAuthLogic`, `useConvocatorias`, `useFinalizacionLogic`,
  `useSeleccionadorLogic`, `useOperationalData`, `useSmartAnalysis`, `useCycleReset`,
  `useExecutiveReportData`), servicios (`metricsLists`, `correccionService`,
  `convocatoriasService`, `todoistDirectService`), contextos (`ModalContext`,
  `ErrorContext`, `AuthContext`). 584 → 473.
- Sesión 3 (componentes grandes): `EditorPracticas`, `EditorInstituciones`,
  `EditorConvocatorias`, `SolicitudesManager`, `EditorEstudiantes`, `ConvocatoriaManager`,
  `SeguroGenerator`, `RecordEditModal`, `WhatsAppContactClassifier` y `mockDb` tipados
  (filas renderables, mutaciones, cache de React Query, modales, objetos agregados).
  `Toast` ahora soporta el tono `info`. `RecordEditModal` pasó a `record: Record<string, unknown>`
  con helper `toInputValue` para los inputs. `mockDb.data` quedó tipado como
  `Record<string, Record<string, unknown>[]>`. Tipos nuevos: `GestionItem`, `ConvAgg`.
  473 → 308. **Pendiente**: `HomeView`, `PenalizationManager`, `FinalizacionReview`,
  `SolicitudNuevaPPSModal`, `StudentDiagnostics`, `gestionHelpers`, `fcm`, `OrphanFixer`,
  y componentes de estudiante varios.
- Sesión 4: `fcm` (tipado `FirebaseApp`/`Messaging` + guards de null, RPCs sin cast),
  `PenalizationManager`, `FinalizacionReview` (reusa `FinalizacionRequest` exportado),
  `gestionHelpers` (tipo `EnrichedLaunch`). 308 → 276.
- Sesión 5: `IngresoTab`, `StudentDiagnostics`, `HomeView`, `SolicitudNuevaPPSModal`
  (tipos `LanzamientoLite`/`DiagnosticsResult`, callbacks de mock como
  `Record<string, unknown>`, `catch` → `getErrorMessage`). 276 → 239.
- Sesión 6: `formatters` (helpers `str/val/input` → `unknown`), `schemaMapping`,
  `CorreccionesTab` (tipo `CorreccionItem`), `OrphanFixer`. 239 → 218.
- Sesión 7: `NotificationContext` (forEach de Realtime/queries inferidos, `created_at`
  nullable saneado), `ProximosFinalizarPanel` (maps tipados con `typeof data[number]`),
  `ProfileView` (prop `updateInternalNotes` tipada, RPCs FCM sin cast),
  `SolicitudesCorreccionManager` (tipo `SolicitudCorreccion`). 218 → 194. **Pendiente**:
  `AtlasProfileView`/`MobileProfileView`, `SolicitudesView`, `RecordatoriosView`,
  `LaunchForm`, `DataIntegrityTool`, `BackupManager`, `NuevosConvenios`,
  `EmailAutomationManager`, `BulkEditModal`, `ConvocatoriaStatusManager`,
  `AdminActionCenter`, `PanelHermesIngreso`, `HermesSolicitudesEditorial`,
  y `supabaseService` (3 `as any` intencionales).

Notas de método para componentes JSX:

- Las filas que se renderizan en JSX deben mantener tipos **renderables** (string/number/null),
  no `unknown` (rompe `ReactNode`). Usar el tipo de dominio (`Practica`, `Institucion`).
- Mocks de modo testing: castear el `Promise.resolve(...)` al tipo de dominio para que
  `mutationFn` unifique `TData` y React Query infiera bien el `context` de `onMutate`.
- `db.X.update/create` esperan `Insert`/`Update`: castear con
  `Parameters<typeof db.X.update>[1]` en vez de `any`.

## 🟢 P3 — Arquitectura / refactor (mantenibilidad)

- **`lanzador/stepViews.tsx` (~1100 líneas)** — dividir las 5 vistas restantes en archivos
  por vista (Borrador/Seleccion/Seguro/Activa/Archivada). ConfirmacionView ya está aparte.
- **Componentes admin grandes restantes** (`GestionView` ~1400, `WhatsAppContactClassifier`
  ~1400, `SeguroGenerator` ~1100, `ConvocatoriaManager` ~840) — extraer subcomponentes/hooks.
- **`dataService`/orquestación** — ya se redujo; seguir moviendo lógica de negocio fuera de JSX.

## 🔵 P4 — Tests (red de seguridad)

- Tests de integración del **flujo Lanzador** (hoy: `lanzadorState`, `aseguramientoService`,
  `buildSidebarEntries`, `shared` puros; falta render del orquestador / mutaciones de estado).
- Tests de los **componentes grandes** antes de seguir refactorizándolos
  (SolicitudesManager tabs, GestionView).
- Subir gradualmente reglas ESLint de `warn` a `error` a medida que baja la deuda
  (empezando por `no-unused-vars` y `exhaustive-deps`).

## ⚪ P5 — Performance / moderno (oportunidades restantes)

- **Code-splitting**: hecho (bundle principal 938→294 KB). Posible siguiente:
  prefetch de chunks por rol al loguear.
- **`exceljs` (940 KB)**: ya es import dinámico; evaluar alternativa más liviana para export
  si el peso del chunk molesta en conexiones lentas.
- Revisar `web-vitals` ya integrado y publicar métricas a GA4/Sentry si interesa.

---

## Hecho en esta sesión (resumen)

- Tooling de calidad real (ESLint con reglas activas), tsconfig ES2022.
- Capa de datos tipada; eliminados los `any` estructurales y **todos** los `supabase.rpc as any`
  (destapando y corrigiendo bugs latentes: args de RPC, null/undefined, `.status` muerto).
- 2 monolitos (~3.700 + ~3.400 líneas) descompuestos en módulos cohesivos.
- Red de tests 206 (incl. `solicitudesService`, `buildSidebarEntries`, helpers del Lanzador).
- Tipos de Supabase sincronizados con el schema vivo; migración de prod pendiente aplicada.
- 2 secretos hardcodeados removidos (Todoist, Hermes).
- Base pulida vía advisors: `search_path` en 8 funciones SECURITY DEFINER, 5 índices de FK;
  RLS verificado en las 27 tablas de `public`.
- Code-splitting del bundle (−68% en el chunk principal).
- Util de errores centralizado; lazy-load del visor de PDF; payloads de Realtime tipados.
- `any`: 665 → ~194 (capa de datos, lógica y componentes grandes de admin).
