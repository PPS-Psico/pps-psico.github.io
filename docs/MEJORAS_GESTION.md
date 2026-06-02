# Mejoras para la sección de Gestión (Admin)

> Auditoría y roadmap para `src/views/admin/GestionView.tsx` y sus sub-componentes
> (`gestion/` y `components/admin/gestion/`). Estado: **borrador iterativo**.

---

## ✅ Implementado

### 1. Panel derecho (Ficha) expandible/colapsable con auto-ajuste

**Problema**: la ficha estaba hardcodeada a 380px. En `calendario` se desperdicia
espacio, en `mails` (MailPanel) se quiere más ancho para leer y redactar.

**Solución**:

- 3 tamaños discretos: `collapsed` (48px) · `normal` (380px) · `expanded` (560px).
- Auto-ajuste por modo + contenido:
  - `calendario` → `collapsed` por default
  - `contactos` → `collapsed` (se oculta via CSS)
  - `mails` con selección (mail / solicitud / institución) → `expanded` automático
  - `mails` sin selección → `normal` (muestra el empty state "Elegí una acción" en la barra derecha)
  - `bandeja` / `instituciones` → `normal`
- Override manual con un segmented control en el header de la ficha.
- Memoria por modo en `localStorage["gv3-ficha-size"]` (un `Record<ViewMode, FichaSize>`).
- Transición CSS suave al cambiar tamaño (no salto brusco).
- Atajo de teclado: `[` colapsa, `]` normaliza, `Shift+]` expande.
- En `Hoy` (`mails`), la barra derecha "respira": arranca en `normal` con el
  empty state, se expande a `expanded` al tocar una tarjeta y vuelve a `normal`
  al deseleccionar — el empty state reaparece en la barra.

**Archivos tocados**:

- `src/constants/uiConstants.ts` — keys centralizadas.
- `src/hooks/useFichaSize.ts` — hook nuevo.
- `src/views/admin/gestion/FichaSizeToggle.tsx` — componente nuevo.
- `src/views/admin/gestion/Ficha.tsx` — toggle integrado.
- `src/components/admin/gestion/MailPanel.tsx` — toggle integrado.
- `src/components/admin/gestion/InstitucionActionPanel.tsx` — toggle integrado.
- `src/components/admin/gestion/SolicitudActionPanel.tsx` — toggle integrado.
- `src/views/admin/GestionView.tsx` — integración + atajos + CSS.

---

## 🎨 Propuestas visuales / UX (pendientes)

| #   | Mejora                                                                                                        | Impacto | Esfuerzo |
| --- | ------------------------------------------------------------------------------------------------------------- | ------- | -------- |
| V1  | Unificar padding del centro: `Bandeja`/`InstitucionesView` arrancan al borde, `CalendarView` tiene `32px`.    | Bajo    | XS       |
| V2  | Dar mini-header con título + total + acciones a `Bandeja` e `InstitucionesView` (paridad con `CalendarView`). | Medio   | S        |
| V3  | Toggle "Hoy con Hermes / Todos los correos" plano → segmented control con contador.                           | Bajo    | XS       |
| V4  | Acciones hover de `InstitucionesView` siempre visibles (paridad con `MailsView`).                             | Medio   | XS       |
| V5  | Empty state del panel derecho en `mails`: agregar 3-4 quick actions (CTA, no solo texto).                     | Bajo    | S        |
| V6  | Contador del rail con dot pulsante cuando hay items nuevos.                                                   | Bajo    | S        |
| V7  | Atajos de teclado globales: `J/K` navegar, `1-5` cambiar de tab, `Cmd/Ctrl+K` búsqueda global.                | Alto    | M        |
| V8  | `CalendarView`: agregar toggle "Mes / Semana / Agenda".                                                       | Alto    | M        |
| V9  | Reorganizar rail: [Brand] → [Search] → [Tabs] → [Categorías] → [Footer].                                      | Medio   | S        |
| V10 | Skeleton consistente en el centro durante refetch (no solo en mount).                                         | Bajo    | S        |

---

## ⚙️ Propuestas de funcionalidad (pendientes)

| #   | Mejora                                                                                                             | Impacto | Esfuerzo |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------- | -------- |
| F1  | Búsqueda global `Cmd/Ctrl+K` en Gestión (ya existe `AdminSearch` en Taller) — instituciones + mails + solicitudes. | Alto    | M        |
| F2  | Filtros guardados (reutilizar combinaciones frecuentes).                                                           | Medio   | M        |
| F3  | Acciones masivas: seleccionar varias instituciones y enviar mismo WA o cambiar estado.                             | Medio   | L        |
| F4  | `MailPanel`: mostrar mini-resumen de la cuenta institucional arriba (evita saltar a otra vista).                   | Medio   | S        |
| F5  | `Ficha` con TOC lateral y scroll-spy (9 secciones, scrollea mucho).                                                | Medio   | M        |
| F6  | `CalendarView`: poder crear recordatorios personales con color custom.                                             | Bajo    | M        |
| F7  | Atajo `[` / `Cmd+B` para colapsar el rail (ya hay toggle, falta shortcut).                                         | Bajo    | XS       |
| F8  | `Bandeja`: toggle "densa / expandida" (lista compacta vs card con detalle).                                        | Medio   | S        |
| F9  | "Replanificar día" y "Preparar borradores": modal de "esto tarda ~30s" antes de invocar.                           | Bajo    | XS       |
| F10 | Compartir deep-link a institución/ficha desde la UI.                                                               | Bajo    | S        |

---

## 🏗️ Propuestas internas / arquitectura (pendientes)

| #   | Mejora                                                                                                              | Impacto | Esfuerzo |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------- | -------- |
| I1  | `GestionView.tsx` (1353 líneas) → dividir en custom hooks: `useGestionModals`, `useMailUndo`, `useGestionDeepLink`. | Alto    | L        |
| I2  | 4 `Suspense fallback` con `Loader` inline → extraer a `<FichaFallback>`.                                            | Bajo    | XS       |
| I3  | CSS scoped (243 líneas inyectadas en runtime) → migrar a archivo `.css` real con PostCSS.                           | Bajo    | M        |
| I4  | LocalStorage keys centralizadas en `uiConstants.ts`.                                                                | Bajo    | XS       |
| I5  | Tooltips del toggle rail/ficha con ARIA labels y descripciones para screen readers.                                 | Bajo    | S        |
| I6  | Hooks `useGestionConvocatorias` y `useInstitucionContexto` → centralizar fetch en `services/`.                      | Medio   | M        |
| I7  | Tests para `buildItems`, `buildInstitutions`, `dbToUiState` (donde más bugs aparecen).                              | Alto    | M        |
| I8  | `lastHistoryContactTs` separa I/O de lógica.                                                                        | Bajo    | XS       |
| I9  | `BandejaCard` extraído para memo + `<BandejaCardSkeleton>`.                                                         | Bajo    | S        |

---

## 📌 Notas de implementación

- Stack: React 18 + CSS scoped inyectado (`injectScopedStyles`) + `framer-motion`
  disponible (no usado todavía en Gestión, queda libre para futuras animaciones).
- No se usan librerías de drag/resize todavía — para la primera versión alcanza
  con los 3 tamaños discretos. Si más adelante hace falta un drag handle, sumar
  `react-resizable-panels` (~6KB) o un custom de ~30 líneas.
- El toggle del panel derecho es **opcional**: si el usuario no lo toca, todo
  sigue funcionando como antes, solo que con el auto-ajuste activo.
- Toda elección del usuario se persiste por modo. Si quiere resetear: borrar
  `gv3-ficha-size` de `localStorage` o agregar un botón "Restablecer" en
  el toggle.
