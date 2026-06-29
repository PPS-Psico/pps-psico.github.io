# Auditoría de calidad — `consulta-pps-uflo`

Informe de hallazgos tras la profesionalización de tipos (sesiones 1-7). El objetivo
ahora es pasar de "callar al linter" a **mejorar la calidad de fondo**: red de tests,
validación en el borde de datos, eliminación de código muerto y bugs latentes.

Estado base: `type-check` 0, 206 tests, `build` OK. `any` 665 → ~194.

Leyenda de prioridad: 🔴 alta · 🟠 media · 🟢 baja.

---

## 1. Código muerto (borrar reduce superficie y confusión)

- 🔴 **`src/components/admin/SolicitudesCorreccionManager.tsx` (~644 líneas) no se importa
  en ningún lado.** Es una versión vieja/duplicada de `solicitudes/CorreccionesTab.tsx`
  (que sí se usa desde `SolicitudesManager`). Mantenerlo confunde y duplica lógica de
  aprobación/rechazo de solicitudes. **Acción:** borrar (verificando que no haya import
  dinámico ni ruta).
- 🟠 **`src/hooks/useCycleReset.ts` no se usa.** Ningún componente llama `useCycleReset`.
  Además contiene un bug latente (ver §2). **Acción:** borrar o reconectar si la
  funcionalidad de "reset de ciclo" es deseada.

## 2. Bugs latentes detectados

- 🟠 **`useCycleReset` compara `l.gestionStatus`** pero el campo real es `estado_gestion`
  (así lo arma `useOperationalData`). La condición nunca matchea → el prompt de reset por
  lanzamientos jamás se dispararía. (Moot mientras el hook esté sin usar, pero quedaría
  como trampa si se reconecta.)
- 🟢 **`HomeView` lee `FIELD_HORAS_PRACTICAS` sobre registros de `convocatorias`** (campo
  que vive en `practicas`). Devuelve `undefined`→`0` siempre; el cálculo de horas de esa
  sección queda en 0. Revisar si debería leer de prácticas.
- 🟢 Varios `catch` originales descartaban el error (`catch (e) {}`) o asumían `e.message`
  sin verificar. Ya migrados a `getErrorMessage` en los archivos tocados; quedan algunos
  en componentes no visitados.

## 3. Tests — el mayor riesgo abierto 🔴

- Hoy: **18 suites / 206 tests**, casi todo en `utils/`, `services/` y 3 integraciones
  (`StudentView`, `AdminView`, `Seleccionador`).
- **Sin cobertura de comportamiento**: `SolicitudesManager` (y sus tabs Ingreso/Egreso/
  Correcciones), los editores de DB (`EditorPracticas/Instituciones/Convocatorias/
Estudiantes`), `ConvocatoriaManager`, `SeguroGenerator`, `PenalizationManager`.
- Esos son justo los componentes que más refactoricé: hoy solo los valida `tsc` + `build`,
  no hay nada que detecte una regresión de lógica.
- **Plan** (incremental, por valor):
  1. Mutaciones de React Query con `mockDb` (patrón ya usado en `Seleccionador.integration`).
  2. Tabs de `SolicitudesManager` (filtrado, transición de estados, conteos).
  3. Editores: alta/edición/borrado optimista + rollback de la cache.

## 4. Causa raíz del `any`: falta validación en el borde 🟠

- El patrón repetido `as Record<string, unknown>` + `as string` **calla al linter pero no
  agrega seguridad** (el cast re-introduce la laxitud).
- La raíz: las filas de Supabase entran sin validar y se accede por clave dinámica
  (`row[FIELD_*]`). Tipos laxos como `MetricRow { [key:string]: any }` y
  `StudentInfo { [key:string]: unknown }` propagan eso.
- **Propuesta de fondo:** validar/parsear en `lib/db.ts` o `services/supabaseService.ts`
  con `zod` (ya es dependencia del proyecto, se usa en `EnrollmentForm`). Con un parse por
  tabla, todo lo de abajo queda tipado de verdad y desaparecen docenas de casts.

## 5. Linter — deuda de formato vs deuda real 🟠

- `eslint src/**` reporta ~6750 problemas: **~5141 son auto-corregibles** (formato/estilo,
  `--fix`) y **~1609 warnings** reales (`no-explicit-any` restante, `exhaustive-deps`,
  `no-unused-vars`).
- **Acciones:**
  - Correr `eslint --fix` (o `prettier --write`) una vez y commitear el formato → baja de
    ~6750 a ~1609 de un saque, sin riesgo.
  - Agregar el chequeo de formato a CI para que no vuelva a crecer.
  - Tratar `exhaustive-deps` y `no-unused-vars` caso por caso (pueden esconder bugs).

## 6. Arquitectura / mantenibilidad 🟢

- Componentes gigantes con lógica de negocio en el JSX:
  `GestionView` (1397), `WhatsAppContactClassifier` (1432), `SeguroGenerator` (1103),
  `Auth` (959), `stepViews` (1066). Candidatos a extraer hooks/subcomponentes (ya se hizo
  con `SolicitudesManager` y `LanzadorView`).
- Duplicación: `fetchAllSolicitudesModificacion/NuevaPPS` se consumen desde `CorreccionesTab`
  y desde el muerto `SolicitudesCorreccionManager`.
- Features incompletas marcadas con TODO real: `useTodoistIntegration` (creación de tareas
  Todoist sin implementar, depende del MCP).

## 7. Seguridad (de sesiones previas, sin cerrar) 🔴

- 3 secretos a rotar (PAT Supabase, Todoist, Hermes) — acción del owner.
- `auth_leaked_password_protection` (HaveIBeenPwned) — toggle de Auth pendiente de decisión.
- Detalle en `roadmap-pendientes.md` (P0/P1).

---

## Orden de ataque sugerido

1. **Borrar código muerto** (`SolicitudesCorreccionManager`, `useCycleReset`) — barato,
   reduce ruido y "deshace" parte del trabajo de tipado que fue sobre código inerte.
2. **`eslint --fix` de formato** + chequeo en CI — gran caída de ruido, riesgo nulo.
3. **Tests** sobre `SolicitudesManager` tabs y un editor — red de seguridad real.
4. **Validación zod en el borde** — ataca la raíz del `any` y evita que vuelva.
5. Continuar `any` solo en lo que aporte (servicios/hooks), no perseguir el contador a 0.
