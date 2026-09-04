# Piloto Vitest — 2026-09-03

## Resultado

Piloto **cerrado sin adopción**. Las cinco suites conservaron paridad total (5/5 archivos y 29/29 tests), pero la mejora de tiempo no alcanzó el gate de 30 %. Jest continúa como único runner del proyecto y la configuración/dependencias temporales de Vitest fueron retiradas.

Se probó Vitest 4.1.11 porque mantiene compatibilidad con Node 20 y Vite 7. La configuración siguió las guías oficiales de [migración desde Jest](https://vitest.dev/guide/migration) y [APIs globales](https://vitest.dev/config/globals).

## Muestra

| Categoría            | Suite existente                     |
| -------------------- | ----------------------------------- |
| Función pura         | `scheduleUtils.test.ts`             |
| Hook                 | `useSortablePracticas.test.tsx`     |
| Componente           | `ProgressBar.test.tsx`              |
| Integración de vista | `AdminView.integration.test.tsx`    |
| Mocks de Supabase    | `useAuthLogic.localSession.test.ts` |

No se copiaron, omitieron ni relajaron assertions. La capa piloto resolvía temporalmente imports de `@jest/globals`, el global `jest`, jsdom y el setup existente.

## Mediciones de pared

Cada corrida inicia un proceso nuevo. En las corridas frías se limpió primero la caché propia del runner.

| Runner        |  Fría 1 |  Fría 2 |  Fría 3 | Mediana fría | Caliente 1 | Caliente 2 | Caliente 3 | Mediana caliente |
| ------------- | ------: | ------: | ------: | -----------: | ---------: | ---------: | ---------: | ---------------: |
| Jest 29.7     | 28,13 s | 11,18 s | 11,57 s |      11,57 s |    10,14 s |    10,42 s |    10,37 s |          10,37 s |
| Vitest 4.1.11 |  8,77 s |  8,03 s |  8,96 s |       8,77 s |     8,46 s |     8,86 s |     8,59 s |           8,59 s |

- mejora mediana fría: 24,2 %;
- mejora mediana caliente: 17,2 %;
- umbral requerido: 30 %.

No hizo falta medir watch para tomar la decisión: ambas medianas principales ya incumplen el gate. Una reevaluación futura debería comenzar por optimizar el setup global de Jest o seleccionar un conjunto más amplio antes de reinstalar otro runner.
