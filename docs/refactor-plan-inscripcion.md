# Plan de Refactor: Flujo de Inscripcion y Convocatorias

## Estado Actual

### Hallazgos del analisis

1. **2 contextos muertos**: `useStudentPanelContext.tsx` y `StudentAcademicContext.tsx` tienen 0 imports. Son versiones obsoletas de `StudentPanelContext.tsx`. Tambien `StudentDataContext.tsx` es dependencia muerta del academico.
2. **Props drilling**: `StudentDashboard` recibe ~15 props del contexto y las pasa a `HomeView` y `ConvocatoriasList`.
3. **Logica duplicada**: La determinacion de `isCompleted` se calcula igual en `HomeView.tsx` y `ConvocatoriasList.tsx` (copiar/pegar).
4. **Tipado debil**: Uso masivo de `as any` en RPCs de Supabase.
5. **Card monolitica**: `ConvocatoriaCardPremium` tiene 830+ lineas con logica de botones, render expandido/colapsado, timeline, compromisos.
6. **Set mezclado**: `completedLanzamientoIds` contiene tanto IDs como nombres normalizados.
7. **Sin tests**: El flujo de inscripcion no tiene cobertura de tests.

### Arquitectura actual (simplificada)

```
ADMIN (gestion directa)          STUDENT (via contexto)
========================         ========================
SeleccionadorConvocatorias       StudentPanelProvider
EditorPracticas                       |
FinalizacionReview                    v
SolicitudesManager              StudentDashboard
(query DB directamente)              |        \
                                      v         v
ADMIN (como estudiante)          HomeView   ConvocatoriasList
========================              |              |
JefeView ─┐                           v              v
DirectivoView ─┤─ StudentPanelProvider  ConvocatoriaCardPremium
AdminTestingView ─┘   |
App/AdminStudentWrapper┘
```

---

## Fases de Implementacion

---

### FASE 1: Limpieza de codigo muerto

**Riesgo: BAJO** | **Archivos: 3** | **Sin cambios funcionales**

#### Paso 1.1: Eliminar contextos muertos

Borrar estos archivos (cero imports en todo el codebase):

- `src/hooks/useStudentPanelContext.tsx`
- `src/contexts/StudentAcademicContext.tsx`
- `src/contexts/StudentDataContext.tsx` (solo consumido por StudentAcademicContext)

#### Paso 1.2: Limpiar .gitignore

Sacar entradas especificas de `.env.gratis`, `.env.prueba`, `.env.final` que ya fueron borradas.
Confirmar que `.env.example` tiene la documentacion correcta.

#### Verificacion

- `npx tsc --noEmit` sin errores
- `npm run build` exitoso
- Test manual: login, inscripcion, admin viendo estudiante

---

### FASE 2: Extraer hook de estado de inscripcion

**Riesgo: BAJO** | **Archivos: 4** | **Sin cambios funcionales**

#### Paso 2.1: Crear `src/hooks/useEnrollmentStatus.ts`

Centralizar la logica que esta duplicada entre `HomeView` y `ConvocatoriasList`:

```typescript
// Recibe: lanzamiento, completedLanzamientoIds, completedOrientationsByInstitution
// Retorna: { isCompleted, completedOrientaciones, allOrientationsCompleted }
```

La logica a extraer es la que agregamos en el commit anterior:

- Normalizar nombre de institucion ( groupName antes del " - " )
- Buscar orientaciones completadas en el Map
- Determinar si bloquear por multi-orientacion o single-orientacion
- Retornar lista de orientaciones completadas

#### Paso 2.2: Reemplazar en HomeView

En `renderCard()`, reemplazar las ~25 lineas de calculo con:

```typescript
const { isCompleted, completedOrientaciones } = useEnrollmentStatus(
  lanzamiento,
  completedLanzamientoIds,
  completedOrientationsByInstitution
);
```

#### Paso 2.3: Reemplazar en ConvocatoriasList

Misma logica, misma llamada. Unificar el calculo.

#### Paso 2.4: Separar IDs y nombres en dataLinker

En `dataLinker.ts`, separar el Set en dos:

```typescript
const completedLanzamientoIds = new Set<string>(); // solo IDs reales
const completedLanzamientoNames = new Set<string>(); // solo nombres normalizados
```

Actualizar `useEnrollmentStatus` para usar ambos Sets.

#### Verificacion

- `npx tsc --noEmit` sin errores
- Test manual: verificar que una PPS completada sigue mostrando "YA REALIZADA"
- Test manual: multi-orientacion sigue permitiendo parcial

---

### FASE 3: Reducir props drilling

**Riesgo: MEDIO** | **Archivos: 3-5** | **Sin cambios funcionales**

#### Contexto

Actualmente `StudentDashboard` recibe todo del contexto y pasa ~15 props a `HomeView`.
La idea es que `HomeView` consuma el contexto directamente via hook.

#### Paso 3.1: Modificar HomeView para usar el hook

En vez de recibir `completedLanzamientoIds`, `completedOrientationsByInstitution`, `enrollmentMap`, `compromisoMap`, `informeTasks`, `criterios`, `institutionAddressMap`, `institutionLogoMap` como props, obtenerlos de `useStudentPanel()`.

Mantener como props solo lo que `HomeView` necesita de su parent:

- `lanzamientos` (filtrados)
- `onInscribir`, `onCancelarInscripcion` (callbacks de mutacion)
- `isCancelandoInscripcion` (estado de mutacion)
- `student` (para el header)
- `onNavigate` (navegacion entre tabs)
- `onOpenFinalization` (abrir modal)
- `onAcceptCompromiso` (callback de compromiso)

#### Paso 3.2: Actualizar StudentDashboard

Sacar los props que HomeView ahora obtiene del contexto. Solo pasar los callbacks.

#### Paso 3.3: Actualizar ConvocatoriasList

Mismo patron: que consuma del contexto en vez de recibir todo por props.

#### Precauciones

- El admin ve el estudiante via `StudentPanelProvider` wrapping `StudentDashboard`. El provider ya tiene el legajo del estudiante. Los hooks leen del provider, no del usuario logueado. Esto funciona correctamente.
- Verificar que `isAdminViewing` no se pierde al mover props.
- Los componentes admin que usan `ConvocatoriaCardPremium` como preview NO usan estos contexts, asi que no se ven afectados.

#### Verificacion

- `npx tsc --noEmit` sin errores
- Test: admin (Jefe/Directivo) viendo perfil de estudiante funciona
- Test: estudiante normal viendo sus convocatorias funciona
- Test: AdminTester en modo simulacion funciona

---

### FASE 4: Dividir ConvocatoriaCardPremium

**Riesgo: MEDIO** | **Archivos: 5-6 nuevos, 1 modificado** | **Sin cambios funcionales**

#### Paso 4.1: Extraer logica de botones a `useCardButtonLogic.ts`

El metodo `getButtonConfig()` (~100 lineas) es logica pura que retorna `{ text, icon, classes, disabled, onClick }`. Extraer como hook:

```typescript
function useCardButtonLogic(props: {
  isCompleted;
  completedOrientaciones;
  estadoInscripcion;
  status;
  compromisoEstado;
  onInscribirse;
  onCancelarInscripcion;
  onVerConvocados;
  onConfirmCompromiso;
}): ButtonConfig;
```

#### Paso 4.2: Extraer seccion expandida a `CardExpandedView.tsx`

El render cuando `isExpanded === true` (actividades, timeline, horarios, archivos, etc.) es un bloque grande que se puede aislar.

#### Paso 4.3: Extraer tags de orientacion a `OrientacionTags.tsx`

Componente reutilizable que muestra los tags con el estado de completado. Ya tiene la logica de `completedSet`.

#### Paso 4.4: ConvocatoriaCardPremium queda como orquestador

La card principal pasa a ser ~100-150 lineas que compone los subcomponentes.

#### Precauciones

- **Admin preview**: `LanzadorConvocatorias` y `PreviewModal` usan la card con datos mock. Al dividir, asegurarse que los subcomponentes acepten props opcionales (sin `estadoInscripcion`, sin `completedOrientaciones`, etc.)
- **DesignSystemView**: Usa la card con datos de ejemplo. Debe seguir funcionando.
- Los tests existentes de la card (si los hay) deben adaptarse.

#### Verificacion

- `npx tsc --noEmit` sin errores
- Test: preview de card en Lanzador funciona correctamente
- Test: estudiante ve la card con todos los estados (inscripto, seleccionado, completada)
- Test: tags de orientacion muestran checkmark correcto

---

### FASE 5: Mejorar tipado de RPCs

**Riesgo: BAJO-MEDIO** | **Archivos: 3-5** | **Sin cambios funcionales**

#### Paso 5.1: Generar tipos de Supabase

```bash
npx supabase gen types typescript --project-id qxnxtnhtbpsgzprqtrjl > src/types/supabase.ts
```

Ya existe `src/types/supabase.ts` pero puede estar desactualizado. Regenerar.

#### Paso 5.2: Tipar los RPCs custom

Las funciones que no estan en el schema autogenerado (`verify_student_identity`, `reset_student_password_verified`, `get_student_email_by_legajo`, etc.) necesitan tipos manuales.

Crear `src/types/rpc-types.ts` con las firmas de cada RPC.

#### Paso 5.3: Reemplazar `as any` en useAuthLogic.ts

El archivo tiene ~15 usos de `as any` en llamadas RPC. Reemplazar con los tipos definidos.

#### Paso 5.4: Reemplazar `as any` en useConvocatorias.ts

Similar, tipar las llamadas a `supabase.rpc()` y `supabase.from()`.

#### Precauciones

- Supabase v2 ya tipa `supabase.from()` automaticamente con los tipos generados. Solo los RPCs custom necesitan tipado manual.
- Si se regeneran los tipos y hay breaking changes, puede romper. Hacer diff antes de commit.
- El tipado de RPCs es incremental: se puede hacer uno por uno.

#### Verificacion

- `npx tsc --noEmit` sin errores (deberia atrapar mas errores de tipos ahora)
- Test: flujo de login funciona (los RPCs tipados responden igual)

---

### FASE 6: Validacion backend de "ya realizada"

**Riesgo: MEDIO-ALTO** | **Archivos: 1 migration + 1 hook** | **Cambio funcional**

#### Contexto

Actualmente la validacion "ya realizaste esta PPS" es solo frontend. Un usuario con la anon key puede inscribirse via API directamente. La RLS actual verifica que el estudiante sea el dueno del registro, pero no verifica que no haya completado ya esa PPS.

#### Paso 6.1: Crear RPC `can_enroll_in_launch`

```sql
CREATE OR REPLACE FUNCTION public.can_enroll_in_launch(
  p_student_id uuid,
  p_lanzamiento_id uuid
)
RETURNS jsonb
-- Retorna { allowed: true/false, reason: "..." }
-- Verifica: estudiante activo, tiene DNI, no finalizo TODAS las orientaciones del lanzamiento
```

La funcion hace la misma logica que `dataLinker.ts` pero en Postgres:

- Busca practicas finalizadas del estudiante vinculadas al lanzamiento (por ID)
- Busca practicas finalizadas del estudiante vinculadas por nombre de institucion
- Si el lanzamiento tiene 1 orientacion y ya la hizo -> bloquear
- Si tiene 2+ orientaciones y todas completadas -> bloquear
- Si tiene 2+ y faltan -> permitir

#### Paso 6.2: Llamar el RPC antes de inscribir

En `useConvocatorias.ts`, antes de crear la inscripcion, llamar `can_enroll_in_launch`. Si `allowed === false`, lanzar error con el `reason`.

Mantener la validacion frontend como optimistica (UI rapida), pero agregar la validacion backend como seguridad.

#### Paso 6.3: Aplicar migration

```sql
-- Migration: add_can_enroll_in_launch_rpc.sql
```

#### Precauciones

- **No romper el flujo existente**: El RPC es una verificacion adicional, no reemplaza la UI.
- **Performance**: El RPC hace queries a practicas + lanzamientos. Con indices adecuados deberia ser rapido.
- **Admin**: El admin puede forzar inscripciones. El RPC debe permitirlo si el caller es admin o service_role.

#### Verificacion

- Test: estudiante no puede inscribirse via API a PPS ya realizada
- Test: estudiante SI puede inscribirse a PPS con orientacion diferente de la misma institucion
- Test: admin puede forzar inscripcion (saltar validacion)
- `supabase_get_advisors` para verificar que no hay issues de seguridad

---

### FASE 7: Tests del flujo de inscripcion

**Riesgo: BAJO** | **Archivos: nuevos** | **Sin cambios funcionales**

#### Paso 7.1: Tests unitarios de dataLinker

```typescript
// src/utils/__tests__/dataLinker.test.ts
// - Practica finalizada con ID -> bloquea por ID
// - Practica finalizada sin ID -> bloquea por nombre
// - Practica no finalizada -> no bloquea
// - Multi-orientacion: 1 de 2 completada -> no bloquea
// - Multi-orientacion: 2 de 2 completadas -> bloquea
// - Multi-orientacion: 0 de 2 completadas -> no bloquea
```

#### Paso 7.2: Tests unitarios de useEnrollmentStatus

```typescript
// src/hooks/__tests__/useEnrollmentStatus.test.ts
// - Lanzamiento single-orientacion completado -> isCompleted=true
// - Lanzamiento multi-orientacion parcial -> isCompleted=false
// - Lanzamiento multi-orientacion completo -> isCompleted=true
// - Sin practicas -> isCompleted=false
```

#### Paso 7.3: Tests unitarios de useCardButtonLogic

```typescript
// src/components/__tests__/useCardButtonLogic.test.ts
// - isCompleted -> "YA REALIZADA" disabled
// - estadoInscripcion="inscripto" -> "INSCRIPTO" con cancelar
// - estadoInscripcion="seleccionado" -> "SELECCIONADO"
// - estadoInscripcion=null + status="abierta" -> "INSCRIBIRSE"
// - status="cerrada" -> "Ver Seleccionados"
```

#### Paso 7.4: Test de integracion del enrollment flow

Mock de `supabase.rpc` y `supabase.from` para simular:

- Inscripcion exitosa
- Inscripcion duplicada (error)
- Estudiante sin DNI (error)
- Cancelacion de inscripcion

#### Verificacion

- `npm run test` pasa todos los tests nuevos
- Coverage del flujo de inscripcion > 80%

---

## Orden de ejecucion y dependencias

```
FASE 1 (limpieza)
  |
  v
FASE 2 (hook unificado) ──> FASE 7 (tests unitarios)
  |
  v
FASE 3 (props drilling)
  |
  v
FASE 4 (dividir card) ──> FASE 5 (tipado RPCs)
                              |
                              v
                         FASE 6 (validacion backend)
```

- **Fases 1-3**: Se pueden hacer en una sola sesion, son seguras y se retroalimentan.
- **Fase 4**: Requiere mas atencion por los componentes admin que usan la card como preview.
- **Fase 5**: Independiente, se puede hacer en paralelo con 3 o 4.
- **Fase 6**: Depende de que los tipos RPC esten listos (fase 5).
- **Fase 7**: Se puede ir haciendo en paralelo con cada fase.

## Impacto en componentes admin

| Componente Admin           | Fases afectadas             | Cambios necesarios                                |
| -------------------------- | --------------------------- | ------------------------------------------------- |
| LanzadorConvocatorias      | Fase 4 (card preview)       | Importar subcomponentes nuevos, mismos props mock |
| PreviewModal               | Fase 4 (card preview)       | Igual que arriba                                  |
| SeleccionadorConvocatorias | Ninguno                     | No usa StudentPanelContext                        |
| EditorPracticas            | Ninguno                     | No usa StudentPanelContext                        |
| FinalizacionReview         | Ninguno                     | No usa StudentPanelContext                        |
| SolicitudesManager         | Ninguno                     | No usa StudentPanelContext                        |
| AdminDashboard/Metrics     | Ninguno                     | No usa StudentPanelContext                        |
| JefeView/DirectivoView     | Fase 3 (si cambia interfaz) | Ya usan StudentPanelProvider, no cambia           |
| AdminTestingView           | Fase 3 (si cambia interfaz) | Igual que arriba                                  |
| DesignSystemView           | Fase 4 (card preview)       | Importar subcomponentes nuevos                    |

## Estimacion de esfuerzo

| Fase                       | Tiempo estimado | Dificultad  |
| -------------------------- | --------------- | ----------- |
| Fase 1: Limpieza           | 15 min          | Trivial     |
| Fase 2: Hook unificado     | 45 min          | Facil       |
| Fase 3: Props drilling     | 1 hr            | Media       |
| Fase 4: Dividir card       | 1.5 hr          | Media       |
| Fase 5: Tipado RPCs        | 1 hr            | Facil-Media |
| Fase 6: Validacion backend | 1.5 hr          | Media-Alta  |
| Fase 7: Tests              | 2 hr            | Media       |
| **Total**                  | **~8 hr**       |             |
