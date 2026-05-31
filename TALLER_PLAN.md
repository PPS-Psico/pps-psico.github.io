# Rediseño "Taller" (ex Herramientas) — plan de ejecución

Fuente verificada en código (no asumido):

- Tokens y utilidades globales: `src/index.css` (--paper/--ink/--accent/--warn/--ok/--ai + .serif/.eyebrow/.mono/.meta/.btn/.dot/.field).
- Shell de referencia: `src/components/admin/AdminDashboard.tsx` (maxWidth 1040, Hanken Grotesk).
- Componentes reutilizados (props/datos verificados):
  - AdminSearch(onStudentSelect, isTestingMode) → db.estudiantes.getPage
  - DatabaseEditor(isTestingMode)
  - ConvenioGenerator(isTestingMode) → Gemini + storage documentos_convenios
  - SeguroGenerator(showModal, isTestingMode) → db.convocatorias/lanzamientos/instituciones
  - PenalizationManager(isTestingMode) → fetchAllData(penalizaciones/estudiantes/lanzamientos)
  - EmailAutomationManager() → supabase email_templates + functions
  - NuevosConvenios(isTestingMode) → instituciones.convenio_nuevo
  - BackupManager() → edge functions list-backups/automated-backup/restore-backup
  - PersonalizationPanel() → AdminPreferencesContext
  - RecordEditModal + schema.estudiantes (alta rápida)
- showModal: useModal().showModal (mismo patrón que LanzadorView).

## Arquitectura nueva

Landing "Taller" (portada editorial) → workspace enfocado por herramienta (breadcrumb + volver).

4 familias:

1. Personas y datos: Buscar alumno · Editor DB [avanzado]
2. Convenios y documentos: Generador de convenios · Generador de seguros · Convenios nuevos
3. Disciplina: Penalizaciones
4. Sistema y ajustes: Automatizaciones · Backups [avanzado] · Personalización

Zona "Avanzado" con guarda de confirmación: Editor DB + Backups.

## Reubicaciones acordadas (para no duplicar)

- Reportes → Métricas (subtab nuevo). Gating: preferences.showReports.
- Contactos WhatsApp → Gestión (supervisión de Hermes). [seguimiento]

## Gating por AdminPreferences (respetado)

- Generador de convenios: showAgreementGenerator
- Convenios nuevos: showNewAgreements
- Penalizaciones: showPenalizations
- Automatizaciones: showAutomation
- Backups: showBackups
- Reportes (en Métricas): showReports
- Buscar alumno, Editor DB, Generador de seguros, Personalización: siempre

## Estado

- [x] TallerView.tsx (landing + workspace + guardas + badges)
- [x] Routing: App.tsx + AdminView.tsx (label "Taller")
- [x] Reportes → subtab en MetricsView
- [ ] Contactos → Gestión (seguimiento)
- [x] Verificar build/typecheck
  - Falta `src/services/hermesPlan.ts` (HermesFlow lo importaba): creado con
    getPlanDelDia / regenerarPlanDelDia + tipos AccionDia/AccionTipo.
  - `tsc --noEmit` limpio · `vite build` OK.
