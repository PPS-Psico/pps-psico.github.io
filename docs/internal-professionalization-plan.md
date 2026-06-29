# Plan maestro de mejora interna para Mi Panel Académico

## Propósito del documento

Este documento existe para ordenar la evolución interna de **Mi Panel Académico** y servir como fuente de verdad de trabajo para futuras sesiones de desarrollo asistido por IA.

El foco de este plan **no** es todavía la venta institucional ni el empaquetado comercial. El foco es mejorar la aplicación para el trabajo real diario: hacerla más robusta, más mantenible, más segura a nivel operativo y más profesional en su funcionamiento interno.

La premisa de este plan es simple:

- la aplicación ya resuelve procesos reales y valiosos de PPS;
- no se propone reescribir todo desde cero;
- sí se propone endurecer arquitectura, datos, seguridad y panel admin para poder seguir agregando funcionalidades sin que el sistema se vuelva cada vez más frágil.

Este documento debe leerse como un **documento vivo**. No es un informe cerrado. Su utilidad está en concentrar contexto técnico, hallazgos, decisiones y prioridades para que futuras sesiones no tengan que redescubrir el sistema desde cero.

---

## 1. Estado actual del sistema

### 1.1 Qué resuelve hoy

Mi Panel Académico ya cubre una parte sustancial del trabajo operativo de PPS. Hoy el sistema resuelve, con distintos niveles de madurez, estos flujos:

- autenticación de estudiantes;
- visualización del panel personal;
- seguimiento de horas y progreso;
- publicación de convocatorias y postulación;
- selección de alumnos por parte del admin;
- gestión de prácticas activas;
- finalización de PPS y entrega de informes;
- revisión/corrección administrativa;
- generación de datos para seguros;
- notificaciones y automatizaciones;
- nuevo flujo de compromiso digital previo al inicio.

Esto es importante dejarlo escrito porque cambia la naturaleza del trabajo técnico: el problema principal ya no es “construir algo que funcione”, sino **hacer que algo que ya funciona mejor, escale mejor y se rompa menos**.

### 1.2 Stack actual real

Estado tecnológico confirmado al momento de redactar este plan:

- frontend: React;
- bundler/dev server: Vite;
- lenguaje: TypeScript;
- estilos: Tailwind CSS;
- estado async y caching: React Query;
- backend principal: Supabase;
- server-side y automatizaciones sensibles: Supabase Edge Functions;
- base real de trabajo: proyecto Supabase `qxnxtnhtbpsgzprqtrjl`.

También es importante dejar asentado que parte de la documentación heredada del repositorio todavía arrastra referencias a Airtable. Eso ya **no representa** la arquitectura real del sistema y debe tratarse como deuda documental.

### 1.3 Estado técnico observado

Diagnóstico técnico sintético:

- el sistema tiene valor funcional alto y cubre procesos reales;
- la principal deuda está en mantenibilidad, seguridad operativa y orden del dominio;
- hay mezcla de UI, acceso a datos y reglas de negocio en módulos críticos;
- el panel admin es potente, pero todavía demasiado acoplado;
- la base usa RLS de forma extendida, pero con políticas que en varios casos son demasiado amplias;
- la disciplina de migraciones existe, pero no está completamente normalizada;
- el `type-check` puede quedar limpio y debe sostenerse como estándar mínimo.

En otras palabras: la app ya no está “verde”, pero tampoco está todavía en un punto de madurez técnica homogéneo. Conviven sectores fuertes con sectores que crecieron por acumulación de soluciones prácticas.

---

## 2. Hallazgos técnicos concretos ya confirmados

Esta sección es clave para evitar que otra sesión de IA tenga que reexplorar el proyecto desde cero.

### 2.1 Hallazgos del repo

Se observaron estos hechos concretos:

- [README.md](C:/Users/Blas_/Downloads/Mi%20Panel%20Antigravity/consulta-pps-uflo/README.md) está desactualizado respecto del backend real; todavía habla en parte desde una lógica anterior y no refleja el uso actual de Supabase como backend principal.
- [SECURITY_REPORT.md](C:/Users/Blas_/Downloads/Mi%20Panel%20Antigravity/consulta-pps-uflo/SECURITY_REPORT.md) no debe tomarse como fotografía actual del estado de seguridad sin revisión adicional.
- Existen componentes grandes y con lógica mezclada, especialmente:
  - [SeleccionadorConvocatorias.tsx](C:/Users/Blas_/Downloads/Mi%20Panel%20Antigravity/consulta-pps-uflo/src/components/admin/SeleccionadorConvocatorias.tsx)
  - [LanzadorConvocatorias.tsx](C:/Users/Blas_/Downloads/Mi%20Panel%20Antigravity/consulta-pps-uflo/src/components/admin/LanzadorConvocatorias.tsx)
  - [dataService.ts](C:/Users/Blas_/Downloads/Mi%20Panel%20Antigravity/consulta-pps-uflo/src/services/dataService.ts)
- La app ya tiene documentación útil en `docs/`, pero todavía fragmentada y no consolidada como arquitectura interna del sistema.

### 2.2 Hallazgos de base reales

Se confirmó acceso real a la base del proyecto Supabase `qxnxtnhtbpsgzprqtrjl`.

Se verificó existencia de estas tablas principales en `public`:

- `estudiantes`
- `convocatorias`
- `lanzamientos_pps`
- `practicas`
- `penalizaciones`
- `finalizacion_pps`
- `instituciones`
- `solicitudes_pps`
- `solicitudes_nueva_pps`
- `solicitudes_modificacion_pps`
- `email_templates`
- `fcm_tokens`
- `reminders`
- `compromisos_pps`

Además:

- `compromisos_pps` ya fue creada y registrada en `supabase_migrations.schema_migrations`;
- la mayoría de las tablas públicas tienen RLS activo;
- `debug_logs` aparece sin RLS y debe revisarse como riesgo;
- existen políticas muy amplias, incluyendo casos de `ALL` y también `UPDATE/DELETE` abiertos para `authenticated` o `public` en tablas de negocio sensibles.

Conclusión práctica: la base **ya tiene** una estructura seria y no parte de cero, pero necesita endurecimiento y normalización de permisos para considerarse profesional a nivel operativo.

### 2.3 Hallazgos de Edge Functions

Se verificó presencia de estas Edge Functions:

- `automated-backup`
- `generate-content`
- `health-check`
- `launch-scheduler`
- `list-backups`
- `onesignal-verify`
- `restore-backup`
- `send-fcm-notification`
- `send-push`

Interpretación:

- ya existe una base operativa sólida y no improvisada;
- la aplicación ya delega responsabilidades importantes a backend serverless;
- falta consolidar contratos, responsabilidades, observabilidad y criterios de uso para que ese backend no crezca de manera desordenada.

---

## 3. Principios rectores del plan

Toda mejora futura debería respetar estos principios.

### 3.1 Principio de evolución incremental

- no reescribir todo;
- mejorar por capas;
- cada mejora debe dejar el sistema mejor de lo que estaba;
- evitar refactors abstractos sin beneficio operativo claro.

### 3.2 Principio de dominio claro

- las reglas de PPS deben vivir en lugares previsibles;
- los estados y transiciones deben ser explícitos;
- no seguir dispersando reglas críticas entre componentes visuales.

### 3.3 Principio de seguridad realista

- seguridad suficiente para operación real;
- endurecer primero los puntos con mayor impacto;
- prioridad en RLS, acciones privilegiadas, auditoría y separación frontend/backend.

### 3.4 Principio de administración eficiente

- el panel admin debe mostrar rápido qué requiere atención;
- menos clicks para ver pendientes;
- más trazabilidad y resumen;
- menos dependencia de memoria personal del coordinador.

### 3.5 Principio de documentación para IA

- toda mejora importante debe dejar contexto reutilizable;
- los documentos deben servir para futuras sesiones sin reabrir toda la exploración;
- el contexto estable es parte del producto de ingeniería, no un extra.

---

## 4. Plan de mejora por dominios

## 4.1 Dominio: base de datos y seguridad

### Objetivo

Dejar la base confiable, auditada y segura para seguir construyendo sin miedo a romper permisos o flujos.

### Problemas actuales

- políticas RLS demasiado amplias;
- permisos genéricos en tablas críticas;
- acciones privilegiadas apoyadas en frontend;
- logs y tablas auxiliares con revisión pendiente;
- drift potencial entre migraciones locales y remotas.

### Decisiones de implementación

- toda tabla de negocio debe tener políticas separadas por operación: `SELECT`, `INSERT`, `UPDATE`, `DELETE`;
- eliminar gradualmente políticas `ALL`, salvo casos excepcionalmente justificados;
- distinguir de forma explícita:
  - acceso del estudiante a sus propios datos;
  - acceso admin/coordinación a datos globales;
  - lectura pública solo cuando sea realmente necesaria;
- acciones críticas no deben depender de que el frontend se comporte correctamente;
- operaciones administrativas sensibles deben migrarse a:
  - Edge Functions autenticadas;
  - o RPCs / funciones SQL controladas;
- toda nueva migración debe ser idempotente, clara y registrada con propósito explícito.

### Backlog concreto

- auditar políticas de:
  `estudiantes`, `convocatorias`, `lanzamientos_pps`, `practicas`, `penalizaciones`, `finalizacion_pps`, `solicitudes_pps`;
- revisar `debug_logs` y decidir si:
  - se mueve a schema interno;
  - se le agrega RLS;
  - o se restringe completamente acceso;
- documentar ownership de cada tabla;
- crear inventario de funciones SQL y triggers activos;
- documentar dependencias entre tablas.

### Criterios de aceptación

- ninguna tabla crítica con políticas genéricas innecesarias;
- permisos entendibles por lectura humana;
- acciones sensibles protegidas server-side;
- migraciones reproducibles y sin improvisación.

## 4.2 Dominio: arquitectura frontend

### Objetivo

Bajar complejidad accidental para que agregar funciones nuevas no implique tocar todo.

### Problemas actuales

- componentes admin grandes;
- mezcla de UI, fetch, mutación y reglas;
- servicios que hacen demasiadas cosas;
- tipado y contratos acoplados a decisiones históricas.

### Decisiones de implementación

- separar por capas:
  - acceso a datos;
  - lógica de dominio;
  - hooks de caso de uso;
  - componentes de presentación;
- evitar que componentes visuales decidan reglas de negocio;
- `dataService` debe ir perdiendo responsabilidades de orquestación compleja;
- cada flujo importante debe tener su propio módulo más enfocado.

### Áreas prioritarias

- `Seleccionador`
- `Lanzador`
- dashboard admin
- autenticación y contextos
- servicios de correo y notificaciones
- flujo estudiante de convocatorias y compromisos

### Criterios de aceptación

- archivos más chicos y legibles;
- mutaciones críticas centralizadas;
- menos lógica de negocio en JSX;
- contratos de datos más previsibles.

## 4.3 Dominio: modelo de negocio PPS

### Objetivo

Hacer explícito el dominio para evitar inconsistencias y parches.

### Decisión clave

Modelar y documentar los subdominios como entidades separadas:

- estudiantes
- convocatorias
- lanzamientos PPS
- selección
- compromiso digital
- prácticas
- penalizaciones
- finalización
- corrección
- notificaciones
- auditoría

### Estados canónicos a definir

El sistema debería converger a una máquina de estados mínima y clara.

#### Convocatoria

- `borrador`
- `abierta`
- `cerrada`
- `oculta`
- `finalizada`

#### Inscripción / participación

- `inscripto`
- `seleccionado`
- `confirmado`
- `baja`
- `desaprobado`
- `finalizado`

#### Práctica

- `creada`
- `en_curso`
- `pendiente_informe`
- `en_correccion`
- `aprobada`
- `desaprobada`

#### Compromiso

- `pendiente`
- `aceptado`
- `vencido`
- `anulado`

### Qué debe evitarse

- textos libres para estados cuando deberían ser enumeraciones o contratos controlados;
- reglas escondidas en condicionales de UI;
- duplicación de estados entre frontend y base sin contrato explícito.

## 4.4 Dominio: panel admin y operación diaria

### Objetivo

Que el sistema ayude a coordinar, no que dependa de memoria personal.

### Mejoras concretas a dejar especificadas

- dashboard de pendientes reales;
- resúmenes por lanzamiento;
- confirmados vs pendientes;
- alumnos con informes atrasados;
- seguimiento de bajas y desaprobaciones;
- documentación faltante;
- estado de seguros;
- cola de corrección.

### Diseño funcional deseado

- vistas por excepción:
  - qué está trabado;
  - qué requiere decisión;
  - qué venció;
- filtros persistentes;
- indicadores visibles en cabeceras;
- badges consistentes por estado;
- acciones rápidas sin perder trazabilidad.

### Integración del compromiso digital

El nuevo módulo de compromiso digital ya debe considerarse parte del dominio operativo central. Debe integrarse con:

- selección;
- correos automáticos;
- vista admin;
- preparación de inicio de PPS;
- potencial auditoría futura.

## 4.5 Dominio: automatizaciones y comunicaciones

### Objetivo

Que las automatizaciones sean útiles, confiables y auditables.

### Problemas actuales

- lógica de correo y automatización distribuida;
- poca trazabilidad formal de qué se envió y cuándo;
- riesgo de que el flujo quede opaco si crece sin orden.

### Decisiones de implementación

- distinguir plantillas, disparadores y registro de envío;
- dejar trazabilidad de correos relevantes;
- centralizar mejor la generación de contenido institucional;
- definir qué correos son críticos y deben auditarse siempre.

### Automatizaciones prioritarias

- selección;
- compromiso digital;
- recordatorios de confirmación;
- recordatorios de informe;
- alertas de pendientes para admin;
- notificaciones push o internas cuando tenga sentido operativo.

## 4.6 Dominio: documentación y contexto reutilizable

### Objetivo

Reducir fricción en futuras sesiones de IA y desarrollo.

### Documentos a producir luego

- arquitectura real actual;
- mapa de tablas y flujos;
- catálogo de Edge Functions;
- mapa de estados PPS;
- guía de migraciones;
- guía de operación admin;
- roadmap interno vigente.

### Regla a dejar escrita

Toda mejora importante debe actualizar al menos uno de estos:

- esquema;
- documentación de dominio;
- contratos de estado;
- checklist operativo.

---

## 5. Roadmap por fases

## Fase 1. Estabilización y verdad técnica

### Objetivo

Dejar reflejado cómo funciona realmente el sistema hoy.

### Tareas

- corregir docs base desactualizadas;
- inventario de tablas, políticas, funciones y procesos;
- identificar componentes críticos por deuda;
- consolidar este plan maestro como documento vivo.

### Resultado esperado

Contexto confiable para seguir trabajando sin redescubrir todo.

## Fase 2. Seguridad y permisos

### Objetivo

Cerrar riesgos gruesos antes de seguir escalando funcionalidad.

### Tareas

- auditoría de RLS;
- corrección de permisos amplios;
- revisión de tablas auxiliares;
- diseño de acciones privilegiadas server-side;
- definición de auditoría mínima.

### Resultado esperado

Base más segura y más coherente con buenas prácticas de Supabase.

## Fase 3. Refactor del núcleo admin

### Objetivo

Que el panel admin sea mantenible y extensible.

### Tareas

- refactor de `Seleccionador`;
- refactor de `Lanzador`;
- reducción de responsabilidad de `dataService`;
- creación de componentes admin reutilizables;
- normalización de hooks y mutaciones.

### Resultado esperado

Agregar funciones nuevas sin tocar todo el panel.

## Fase 4. Profesionalización operativa

### Objetivo

Mejorar la coordinación diaria real.

### Tareas

- dashboards por pendientes;
- estados visibles por lanzamiento;
- vistas de seguimiento;
- integración completa del compromiso digital;
- mejores alertas y automatizaciones.

### Resultado esperado

Menos fricción operativa y mejor trazabilidad.

## Fase 5. Preparación para escalar

### Objetivo

Dejar la app lista para crecer a otros coordinadores o casos similares.

### Tareas

- parametrización de textos y reglas;
- definición de roles y permisos más escalables;
- desacople de módulos demasiado específicos;
- documentación lista para onboarding técnico.

### Resultado esperado

Base madura para expansión futura.

---

## 6. Backlog priorizado

### Prioridad alta

- auditoría RLS;
- revisión de `debug_logs`;
- mapa de dominio y estados;
- refactor de `Seleccionador`;
- refactor de `Lanzador`;
- reducción de lógica crítica en frontend;
- trazabilidad de acciones admin.

### Prioridad media

- dashboard operativo consolidado;
- mejora de automatizaciones;
- centralización de comunicaciones;
- mejora de documentación técnica;
- pruebas mínimas de flujos críticos.

### Prioridad baja

- rediseño visual profundo;
- empaquetado institucional/comercial;
- parametrización multi-coordinador completa;
- optimizaciones no críticas de UX.

---

## 7. Tests y criterios de aceptación

### Calidad técnica mínima

- `type-check` limpio de forma sostenida;
- migraciones aplicables sin drift;
- tipos alineados con esquema real;
- sin nuevos bypasses de seguridad.

### Flujos críticos a cubrir

- autenticación;
- carga de panel estudiante;
- inscripción a convocatoria;
- selección admin;
- confirmación de compromiso;
- finalización PPS;
- corrección de informe;
- automatización de correos críticos.

### Criterios operativos

- el admin puede identificar rápido qué está pendiente;
- el estado de una PPS es visible sin navegar múltiples pantallas;
- las acciones sensibles dejan rastro;
- la base no depende de permisos frontend implícitos.

---

## 8. Cómo usar este documento en futuras sesiones de IA

Antes de proponer cambios grandes o refactors amplios, leer este documento.

Reglas de uso:

- no reabrir discusión arquitectónica básica si ya está resuelta acá;
- usar este plan para decidir prioridades;
- no volver a explorar todo el repo ni toda la base si el problema ya está contextualizado en este documento;
- actualizar este archivo cuando cambie el dominio, la base o el roadmap;
- usar este documento como punto de entrada para nuevas sesiones de vibe coding.

La intención es que este archivo reduzca costo cognitivo, repeticiones y decisiones redundantes.

---

## 9. Supuestos y defaults elegidos

- el foco del documento es mejora interna y operativa;
- no se busca reescritura total;
- Supabase es el backend definitivo del sistema;
- el módulo de compromiso digital ya forma parte del núcleo del sistema;
- se prioriza seguridad, mantenibilidad y administración antes que rediseño institucional;
- este documento debe ser suficientemente detallado para sesiones de vibe coding sin reexploración completa.

---

## 10. Notas de contexto ya confirmadas

Para futuras sesiones, dejar asentado lo siguiente:

- el proyecto Supabase real asociado a la app es `qxnxtnhtbpsgzprqtrjl`;
- la tabla `compromisos_pps` fue creada y registrada en migraciones;
- el proyecto ya tiene Edge Functions relevantes en uso;
- la documentación principal del repo todavía necesita alinearse mejor con el estado real;
- el mayor valor del sistema hoy está en el dominio PPS ya capturado y en la operatividad del panel admin;
- la principal deuda no es ausencia de funciones, sino falta de orden, endurecimiento y profesionalización interna.

---

## 11. Orden sugerido de implementación por sesiones de IA

Esta sección existe para que una IA pueda tomar trabajo concreto sin tener que reinterpretar todo el documento ni decidir sola por dónde empezar.

La regla general es:

- trabajar por bloques pequeños pero completos;
- no abrir varios frentes estructurales a la vez;
- cerrar cada sesión con código funcionando, validación mínima y actualización de contexto cuando corresponda.

### Sesión 1. Alinear documentación base con la realidad del sistema

#### Objetivo

Corregir la documentación principal para que refleje el backend y la arquitectura actuales.

#### Inputs mínimos

- este documento;
- [README.md](C:/Users/Blas_/Downloads/Mi%20Panel%20Antigravity/consulta-pps-uflo/README.md);
- [SECURITY_REPORT.md](C:/Users/Blas_/Downloads/Mi%20Panel%20Antigravity/consulta-pps-uflo/SECURITY_REPORT.md);
- carpeta `docs/`.

#### Tareas

- actualizar README para reflejar Supabase, Edge Functions y flujos actuales;
- quitar o contextualizar referencias viejas a Airtable;
- revisar `SECURITY_REPORT.md` y degradarlo a documento histórico o actualizar su framing;
- crear o actualizar una breve nota de arquitectura real.

#### Output esperado

- documentación base confiable;
- menos contradicción entre repo y sistema real.

#### Criterio de cierre

- un lector nuevo entiende qué backend usa realmente la app;
- no quedan afirmaciones centrales técnicamente falsas en docs principales.

### Sesión 2. Inventario de base y seguridad

#### Objetivo

Crear un mapa claro de tablas, ownership, RLS y riesgos principales.

#### Inputs mínimos

- este documento;
- esquema real de Supabase;
- migraciones en `supabase/migrations/`.

#### Tareas

- inventariar tablas de negocio;
- listar ownership esperado por tabla;
- listar políticas RLS actuales por tabla;
- marcar riesgos por amplitud o ambigüedad de permisos;
- identificar tablas auxiliares sensibles, especialmente `debug_logs`.

#### Output esperado

- documento o sección con mapa de seguridad de datos;
- tabla de prioridades para correcciones de RLS.

#### Criterio de cierre

- queda claro qué tabla es pública, propia, administrativa o mixta;
- se puede empezar la corrección de RLS sin seguir descubriendo estructura.

### Sesión 3. Endurecimiento inicial de RLS

#### Objetivo

Corregir los permisos más peligrosos sin romper el funcionamiento principal.

#### Inputs mínimos

- inventario de sesión 2;
- tablas críticas ya priorizadas.

#### Tareas

- empezar por `estudiantes`, `convocatorias`, `lanzamientos_pps`, `practicas`, `solicitudes_pps`;
- reemplazar políticas `ALL` por políticas separadas;
- restringir `UPDATE/DELETE` abiertos;
- validar que admin y estudiante conserven flujos esenciales.

#### Output esperado

- migraciones nuevas de endurecimiento;
- permisos más explícitos y menos amplios.

#### Criterio de cierre

- ninguna de las tablas priorizadas conserva permisos abiertos innecesarios;
- los flujos críticos siguen operativos.

### Sesión 4. Auditoría y trazabilidad de acciones críticas

#### Objetivo

Definir y empezar a registrar acciones administrativas sensibles.

#### Inputs mínimos

- este documento;
- flujos de selección, baja, cierre de convocatoria, compromiso, corrección.

#### Tareas

- identificar acciones que deben dejar rastro;
- decidir estructura mínima de auditoría;
- implementar primer nivel de trazabilidad para eventos críticos;
- dejar claro dónde se consulta esa traza.

#### Output esperado

- base inicial de auditoría operativa;
- capacidad de reconstruir acciones importantes.

#### Criterio de cierre

- al menos selección, baja, confirmación y cambios de estado dejan rastro consultable.

### Sesión 5. Refactor del Seleccionador

#### Objetivo

Reducir complejidad del módulo de selección sin cambiar comportamiento funcional.

#### Inputs mínimos

- [SeleccionadorConvocatorias.tsx](C:/Users/Blas_/Downloads/Mi%20Panel%20Antigravity/consulta-pps-uflo/src/components/admin/SeleccionadorConvocatorias.tsx);
- hooks y servicios asociados.

#### Tareas

- separar UI de lógica de caso de uso;
- extraer componentes secundarios reutilizables;
- aislar fetch/mutaciones y helpers;
- preservar comportamiento actual.

#### Output esperado

- módulo más legible y menos acoplado;
- mejor base para agregar mejoras operativas.

#### Criterio de cierre

- menor tamaño y complejidad del archivo principal;
- sin regresión funcional visible;
- type-check limpio.

### Sesión 6. Refactor del Lanzador

#### Objetivo

Ordenar el módulo de creación/gestión de convocatorias.

#### Inputs mínimos

- [LanzadorConvocatorias.tsx](C:/Users/Blas_/Downloads/Mi%20Panel%20Antigravity/consulta-pps-uflo/src/components/admin/LanzadorConvocatorias.tsx);
- servicios asociados;
- schema real de `lanzamientos_pps`.

#### Tareas

- separar formularios, validaciones y mutaciones;
- extraer secciones del componente;
- consolidar contratos de datos;
- mejorar mantenibilidad sin rediseñar toda la experiencia.

#### Output esperado

- módulo más componible;
- menor deuda estructural en alta de convocatorias.

#### Criterio de cierre

- menos lógica concentrada en un solo archivo;
- validaciones y transformación de payload más explícitas.

### Sesión 7. Reorganización de `dataService`

#### Objetivo

Reducir el rol de “mega servicio” y devolver responsabilidades a capas más claras.

#### Inputs mínimos

- [dataService.ts](C:/Users/Blas_/Downloads/Mi%20Panel%20Antigravity/consulta-pps-uflo/src/services/dataService.ts);
- módulos que lo consumen.

#### Tareas

- identificar funciones por dominio;
- separar servicios por área;
- mover lógica de negocio a helpers o casos de uso;
- conservar API pública solo donde convenga por compatibilidad.

#### Output esperado

- servicios más chicos y temáticos;
- menos mezcla de acceso a datos y orquestación.

#### Criterio de cierre

- responsabilidades más claras;
- llamadas más previsibles desde hooks y componentes.

### Sesión 8. Mapa de estados y contratos de dominio

#### Objetivo

Formalizar los estados del sistema para reducir inconsistencias futuras.

#### Inputs mínimos

- tablas de negocio;
- condicionales de UI existentes;
- flows de admin y estudiante.

#### Tareas

- inventariar estados actuales reales;
- definir estados canónicos;
- documentar transiciones válidas;
- detectar duplicaciones o textos libres peligrosos.

#### Output esperado

- documento o módulo de referencia de estados;
- base para futuras normalizaciones.

#### Criterio de cierre

- los estados principales del sistema quedan documentados y reutilizables.

### Sesión 9. Dashboard operativo interno

#### Objetivo

Construir una vista admin centrada en pendientes reales y no solo en navegación por módulos.

#### Inputs mínimos

- este documento;
- señales ya disponibles en base;
- panel admin actual.

#### Tareas

- definir pendientes prioritarios;
- mostrar lanzamientos con confirmados vs pendientes;
- mostrar informes atrasados, documentación faltante, estados en riesgo;
- priorizar lectura rápida y acción.

#### Output esperado

- tablero más útil para coordinación diaria.

#### Criterio de cierre

- el admin puede detectar rápidamente qué requiere atención sin recorrer múltiples pantallas.

### Sesión 10. Automatizaciones y trazabilidad de correos

#### Objetivo

Ordenar disparadores, plantillas y constancias de envío.

#### Inputs mínimos

- sistema actual de mails;
- `email_templates`;
- Edge Functions de envío;
- flujos de selección, compromiso e informes.

#### Tareas

- separar mejor plantilla, trigger y registro;
- definir correos críticos;
- mejorar trazabilidad de envíos;
- dejar lista la base para recordatorios automáticos más confiables.

#### Output esperado

- sistema de comunicaciones menos opaco;
- mejor capacidad de seguimiento.

#### Criterio de cierre

- se puede saber qué correo crítico se envió, cuándo y con qué propósito.

### Sesión 11. Tests mínimos de flujos críticos

#### Objetivo

Empezar una suite pequeña pero valiosa que proteja flujos sensibles.

#### Inputs mínimos

- flujos críticos ya identificados;
- estado actual de tests.

#### Tareas

- priorizar login, selección, compromiso, finalización y corrección;
- agregar tests donde el riesgo de regresión sea más alto;
- no buscar cobertura masiva, sino cobertura estratégica.

#### Output esperado

- red mínima de seguridad para cambios futuros.

#### Criterio de cierre

- los flujos críticos elegidos tienen al menos una validación automatizada útil.

### Sesión 12. Preparación para escalar sin vender todavía

#### Objetivo

Dejar la app lista para crecer sin rehacer arquitectura.

#### Inputs mínimos

- avances de sesiones previas;
- puntos todavía demasiado específicos a tu operación.

#### Tareas

- detectar hardcodeos de reglas, textos y roles;
- identificar puntos de parametrización futura;
- separar mejor lo que es genérico de lo que es particular de tu coordinación.

#### Output esperado

- base más flexible para una eventual expansión futura.

#### Criterio de cierre

- la app puede crecer a nuevos escenarios sin depender de una reescritura estructural.

---

## 12. Reglas de ejecución para futuras sesiones de vibe coding

Cuando una IA tome este documento como base, debería trabajar así:

1. elegir una sola sesión o sub-bloque por vez;
2. relevar solo los archivos relevantes para ese bloque;
3. evitar abrir discusiones amplias ya resueltas en este documento;
4. implementar cambios completos y verificables;
5. cerrar con validación mínima:
   - type-check;
   - prueba funcional localizada;
   - actualización de documentación si cambió contexto;
6. si un cambio modifica arquitectura, estados o contratos, actualizar este documento o el documento temático correspondiente.

### Qué no hacer

- no mezclar refactor grande con nuevas features no relacionadas;
- no cambiar permisos críticos sin validar flujos reales;
- no introducir nuevas tablas o estados sin documentarlos;
- no dejar mutaciones críticas escondidas en componentes visuales si ya se detectó que deben centralizarse.

### Qué sí hacer

- privilegiar mejoras acumulativas;
- dejar trazabilidad de decisiones;
- documentar nuevos contratos;
- bajar deuda sin frenar evolución funcional.

---

## 13. Estado de avance

### Sesiones cerradas

- SesiÃ³n 1: completada
  - resultado visible en la documentaciÃ³n base actualizada del repo;
  - arquitectura real ya documentada en `docs/architecture-current.md`.

- SesiÃ³n 2: completada
  - inventario de base y seguridad documentado en `docs/supabase-security-inventory.md`;
  - validado contra la base real del proyecto Supabase `qxnxtnhtbpsgzprqtrjl`;
  - apoyado en MCP Supabase y documentaciÃ³n oficial actual de Supabase sobre RLS.

### Siguiente sesiÃ³n sugerida

- SesiÃ³n 3. Endurecimiento inicial de RLS
- orden sugerido:
  - cerrar `debug_logs`;
  - eliminar `UPDATE/DELETE` amplios en tablas crÃ­ticas;
  - separar polÃ­ticas admin por operaciÃ³n;
  - fijar `search_path` en funciones sensibles.

### Estado parcial adicional de la Sesion 3

- `debug_logs` ya fue contenida:
  - RLS activado;
  - lectura solo para admins autenticados;
  - sin escritura directa desde clientes;
  - migracion: `supabase/migrations/20260409131500_secure_debug_logs.sql`.
- `convocatorias` ya fue endurecida en una primera pasada:
  - eliminado `DELETE` abierto para cualquier autenticado;
  - reemplazado `UPDATE` abierto por `UPDATE` de inscripcion propia;
  - `is_admin()` corregida con `search_path` fijo;
  - migracion: `supabase/migrations/20260409143000_harden_convocatorias_and_is_admin.sql`.
- `estudiantes`, `instituciones`, `lanzamientos_pps` y `penalizaciones` ya no conservan `UPDATE/DELETE` abiertos para cualquier autenticado;
  - se mantuvieron las policies propias o admin necesarias;
  - migracion: `supabase/migrations/20260409150000_remove_open_write_policies.sql`.
- las RPC sensibles de FCM ya fueron endurecidas:
  - `save_fcm_token(...)` ya no acepta escritura arbitraria por `uid`;
  - `get_all_fcm_tokens()` quedo restringida a `service_role`;
  - se removio ejecucion para `anon` y `PUBLIC` en las RPC de FCM;
  - se fijaron `search_path` de funciones sensibles de la app;
  - migracion: `supabase/migrations/20260409162000_harden_fcm_rpcs_and_fix_search_paths.sql`.
- las policies admin `ALL` de las tablas PPS criticas ya fueron separadas por operacion:
  - `convocatorias`
  - `estudiantes`
  - `finalizacion_pps`
  - `instituciones`
  - `lanzamientos_pps`
  - `penalizaciones`
  - `practicas`
  - `solicitudes_pps`
  - migracion: `supabase/migrations/20260409170000_split_admin_all_policies.sql`.
- se hizo una pasada adicional de endurecimiento y optimizacion RLS:
  - `backup_history` y `fcm_tokens` ahora usan `public.is_admin()` en vez de checks legacy por claims;
  - varias policies de ownership pasaron a `to authenticated`;
  - se normalizo el uso de `(select auth.uid())` en tablas clave de seguimiento estudiantil;
  - se elimino una policy duplicada de `practicas`;
  - migracion: `supabase/migrations/20260409180000_optimize_remaining_rls_policies.sql`.
- se completo una pasada complementaria sobre tablas auxiliares y operativas:
  - `backup_config` ahora usa policies admin con `public.is_admin()`;
  - `email_templates` dejo de estar abierta a cualquier autenticado y paso a admin-only por operacion;
  - `reminders` quedo optimizada como tabla por usuario;
  - `compromisos_pps` mantuvo el modelo actual, incluyendo lectura para `Reportero`, pero sin llamadas directas a `auth.uid()`;
  - se agrego indice para `backup_history.created_by`;
  - migracion: `supabase/migrations/20260410101500_harden_admin_tables_and_optimize_remaining_rls.sql`.
- se hizo una auditoria y limpieza inicial de funciones privilegiadas:
  - se eliminaron funciones `security definer` ajenas al proyecto que provenian de otra aplicacion;
  - `get_user_creation_dates()` y `get_dashboard_metrics()` dejaron de estar abiertas a `PUBLIC/anon`;
  - se exigio rol operativo valido para esas funciones;
  - se corrigio `search_path` en funciones pendientes;
  - migraciones:
    - `supabase/migrations/20260410113000_remove_foreign_security_definer_functions.sql`
    - `supabase/migrations/20260410121500_harden_reporting_functions_and_search_paths.sql`
- se completo una pasada puntual sobre RPCs sensibles del flujo de auth:
  - se movio la verificacion de identidad sensible al servidor con `verify_student_identity(...)` y `reset_student_password_verified(...)`;
  - `register_new_student(...)` ahora exige sesion autenticada propia y coincidencia de `dni` antes de vincular `user_id`;
  - `admin_reset_password(...)` y `get_student_details_by_legajo(...)` quedaron cerradas para `anon/authenticated`;
  - `get_my_role()` y `mark_password_changed()` dejaron de estar abiertas a `anon`;
  - el frontend dejo de depender de `get_student_details_by_legajo(...)` para login, recuperacion y activacion;
  - migracion: `supabase/migrations/20260410140000_harden_auth_rpcs.sql`.

### Siguiente subpaso sugerido

- decidir si vale la pena consolidar algunas policies `admin + own` en tablas PPS o si ese warning puede aceptarse como costo menor del modelo real;
- revisar si alguna lectura publica/semipublica en `convocatorias` merece separarse en una tabla o vista especifica para bajar warnings sin tocar la UX;
- decidir si conviene mover las RPC privilegiadas de auth fuera de `public` o si alcanza con el cierre actual de grants para este panel interno;
- decidir si `debug_logs` sigue teniendo valor operativo o conviene retirarla.

---

## 14. Track de calidad de codigo y tipado (sesiones tooling)

Este track es transversal a las sesiones de dominio. Apunta a los criterios de
"calidad tecnica minima" de la seccion 7 (type-check limpio, tipos alineados,
sin nuevos bypasses) y a sentar base para el refactor de los monolitos.

### Fase 1. Tooling de calidad con dientes (cerrada)

Problema detectado: el proyecto parecia profesional por fuera (CI, husky,
commitlint, tests) pero los controles de calidad estaban desactivados por dentro.

Cambios aplicados:

- `eslint.config.js`: se activaron reglas clave que estaban en `off`:
  - `react-hooks/rules-of-hooks`: `warn` -> `error` (verificado: 0 violaciones reales);
  - `react-hooks/exhaustive-deps`: `off` -> `warn` (24 casos a revisar);
  - `@typescript-eslint/no-explicit-any`: `off` -> `warn` (deuda ahora visible);
  - `@typescript-eslint/no-unused-vars`: `off` -> `warn` con patron `^_`;
  - `no-console`: `off` -> `warn` permitiendo solo `warn`/`error`.
  - Todo en modo `warn` para no romper build ni CI; visibiliza deuda para limpieza gradual.
- Dependencias deprecadas/sin uso eliminadas: `@google/generative-ai`,
  `@sentry/tracing`, `@types/xlsx`.
- `tsconfig.json`: `target`/`lib` ES2020 -> ES2022.
- Verificacion: `tsc --noEmit` OK, `npm run build` OK.

Observacion para performance futura: el build genera chunks de ~940 KB
(`index` y `exceljs.min`). Candidato a code-splitting con `manualChunks`.

### Fase 2. Tipado de la capa de datos (cerrada)

Objetivo: el `strict: true` existia en papel pero ~684 `any` lo anulaban. Se
ataco primero la capa que consume todo el proyecto.

Cambios aplicados:

- `src/services/supabaseService.ts`:
  - tipos compartidos exportados `SortSpec` y `QueryFilters` (antes `any[]` y `Record<string, any>`);
  - `applyFilters(query: any)` -> generico `applyFilters<Q>(query: Q): Q` con interfaz estructural `GenericFilterBuilder`;
  - helper `toErrorMessage(e: unknown)`: los 6 `catch (e: any)` pasaron a `catch (e)` con narrowing seguro;
  - `allRows: any[]` -> `Row[]`; `lastError: any` -> `unknown`;
  - quedan 4 `as any` (escape hatch documentado de supabase-js con tablas genericas T), ahora con comentario y `eslint-disable` puntual.
- `src/lib/db.ts`: firmas `getAll/get/getPage` usan `QueryFilters`/`SortSpec`;
  `getPage` retorna `AppErrorResponse | null` (antes `error: any`);
  `getStudentLoginInfo` sin `(supabase.rpc as any)` ni `(data as any)` (la RPC ya estaba tipada).
- `src/hooks/useAuthLogic.ts`: eliminado `(supabase.rpc as any)` para `get_student_email_by_legajo`.
- `src/components/admin/EditorEstudiantes.tsx`: el tipado estricto expuso un bug
  latente (acceso a `.message` sobre `string | AppError` sin narrowing). Corregido;
  ademas `filters: any` -> `Record<string, unknown>`.
- Verificacion: `tsc --noEmit` OK, tests de `src/services`/`src/lib` (14) en verde, `npm run build` OK.

### Siguiente paso sugerido del track

- antes de refactorizar los monolitos (`LanzadorView.tsx` ~3270 lineas,
  `SolicitudesManager.tsx` ~3659 lineas), reforzar la red de tests de integracion
  de esos flujos (alinea con Sesion 11);
- continuar reduciendo `any` por dominio (servicios -> hooks -> componentes),
  apoyandose en los tipos compartidos ya creados.

### Fase 3. Refactor de monolitos — SolicitudesManager (primera pasada)

Objetivo: dividir el componente monolítico `SolicitudesManager.tsx` (3714 líneas,
7 componentes apilados) en módulos enfocados, sin cambiar comportamiento. Se apoya
en la red de tests de `solicitudesService` creada en la sesión anterior.

Patrón seguido: extraer cada componente a `src/components/admin/solicitudes/`
(donde un refactor previo ya había movido `types`, `helpers`, `primitives`, `modals`).

Cambios aplicados:

- `EmailReviewModal` -> `solicitudes/EmailReviewModal.tsx` (modal de presentación puro).
- `CorreccionesTabView` + `CorreccionCardItem` -> `solicitudes/CorreccionesTab.tsx`.
- `EgresoTabView` + `EgresoCardItem` -> `solicitudes/EgresoTab.tsx`.
- `CollapsibleHistory` (genérico, compartido por Ingreso y Egreso) -> movido a `solicitudes/primitives.tsx`.
- Limpieza de imports muertos en el archivo principal tras las extracciones.

Resultado:

- `SolicitudesManager.tsx`: **3714 -> 2305 líneas** (-38%).
- Verificación: `tsc --noEmit` OK, suite completa (16 suites / 189 tests) en verde, `npm run build` OK.

Pendiente en este monolito (próxima pasada):

- extraer `IngresoTabView` + `IngresoCardItem` -> `solicitudes/IngresoTab.tsx`;
- extraer `PanelHermesIngreso` y `HermesSolicitudesEditorial` -> componentes Hermes propios;
- dejar `SolicitudesManager` como orquestador delgado (estado de tabs + data fetching + wiring).

Siguiente monolito del backlog: `LanzadorView.tsx` (~3270 líneas).

### Fase 3 (cont.). SolicitudesManager completo + LanzadorView

**SolicitudesManager.tsx — segunda pasada (cerrada).** Se completó la división:

- `IngresoTabView` + `IngresoCardItem` -> `solicitudes/IngresoTab.tsx`.
- `PanelHermesIngreso` -> `solicitudes/PanelHermesIngreso.tsx`.
- `HermesSolicitudesEditorial` -> `solicitudes/HermesSolicitudesEditorial.tsx`.
- limpieza de imports muertos.
- Resultado: `SolicitudesManager.tsx` **3714 -> 839 líneas (-77%)**, ahora orquestador (tabs + data fetching + wiring). Módulo `solicitudes/`: EmailReviewModal (139), CorreccionesTab (610), EgresoTab (763), IngresoTab (743), PanelHermesIngreso (419), HermesSolicitudesEditorial (296), más types/helpers/primitives/modals previos.

**LanzadorView.tsx (cerrada).** Relocalización pura (sin cambios de lógica) a `views/admin/lanzador/`:

- `lanzador/shared.tsx` (965): primitivos (Dot/Chip/Pipeline/Loader/MiniSpark), helpers puros (isEffectivelyArchived, normDateValue), hook `useLaunchEditor`, `CanvasHeader`, `PropagateDatesDialog`, `LanzadorSidebar`.
- `lanzador/stepViews.tsx` (2010): las 6 vistas por estado (Borrador/Seleccion/Seguro/Confirmacion/Activa/Archivada) + helpers de WhatsApp.
- Resultado: `LanzadorView.tsx` **3424 -> 588 líneas (-83%)**, ahora orquestador (estado de pipeline + sidebar + ruteo de vistas).
- El CSS scoped `.lv4` (lanzadorStyles) se mantiene importado en el orquestador (side-effect preservado).

Verificación de toda la Fase 3: `tsc --noEmit` OK, suite completa (16 suites / 189 tests) en verde, `npm run build` OK.

Pendiente (mejora futura, no urgente):

- `stepViews.tsx` (2010) sigue siendo grande; se puede dividir una vista por archivo en una pasada posterior.
- agregar tests de integración del flujo Lanzador antes de tocar su lógica (hoy solo `lanzadorState` tiene tests unitarios).
- continuar reduciendo `any` en los módulos extraídos.

### Fase 3 (cont.). Split fino de stepViews — ConfirmacionView aislada

- `ConfirmacionView` (la vista más grande, ~803 líneas) -> `lanzador/ConfirmacionView.tsx` (818).
- Los sub-componentes lazy (`SeleccionadorConvocatorias`, `SeguroGenerator`) y los
  helpers de mensajes WhatsApp (`buildWhatsappFromLaunch`, `buildFranjasLibresMessage`)
  se consolidaron en `lanzador/shared.tsx` (los usaban varias vistas).
- `stepViews.tsx` quedó como módulo de las 5 vistas restantes (Borrador/Seleccion/Seguro/Activa/Archivada)
  y re-exporta `ConfirmacionView` (barrel), así el orquestador no cambia su import.
- Limpieza de imports muertos en shared.tsx, stepViews.tsx y ConfirmacionView.tsx.
- Tamaños: LanzadorView 592, shared 1024, stepViews 1117, ConfirmacionView 818.
- Verificación: `tsc --noEmit` OK, 16 suites / 189 tests en verde, `npm run build` OK.

### Fase 3 (cont.). Red de tests del Lanzador

Se agregó `views/admin/lanzador/__tests__/shared.test.ts` (11 tests) cubriendo la
lógica pura que el refactor relocalizó a `lanzador/shared.tsx`:

- `isEffectivelyArchived`: archivado por `estado_gestion`, archivado por bucket
  pre-inicio con fecha de inicio vencida (+gracia), respeto del período de gracia,
  y los casos que NO deben archivar.
- `buildWhatsappFromLaunch`: incluye datos clave + link, omite secciones vacías.
- `buildFranjasLibresMessage`: singular vs plural, listado de franjas, `libres` null = 0.

Estado de cobertura del dominio Lanzador (suite total: 17 suites / 200 tests, en verde):

- `lanzadorState.test.ts`: máquina de estados (mapDbToUiState, inscripcionVencida, metadata).
- `aseguramientoService.test.ts` + `.property.test.ts`: deriveBucket (property-based) y mutaciones de seguro.
- `shared.test.ts` (nuevo): helpers de archivado y mensajes.

Pendiente (mejora futura): test de render del orquestador `LanzadorView` (agrupación
de buckets en el sidebar) — requiere montar lazy + searchParams + modal; de mayor
costo y fragilidad, se difiere.

### Fase 3 (cont.). Test de buckets del Lanzador + reducción de `any`

**Test del orquestador (vía extracción a función pura).** Para cubrir la
clasificación del sidebar sin montar el componente (que en testing mode no trae
datos), se extrajo la lógica del `useMemo` de `entries` a una función pura
`buildSidebarEntries` en `lanzadorState.ts` (también se movieron ahí
`isEffectivelyArchived`, `STALE_PRESTART_BUCKETS` y el tipo `SidebarEntry`;
`shared.tsx` los re-exporta para compatibilidad).

- `LanzadorView.tsx`: 588 -> ~488 líneas (el `useMemo` quedó en una línea).
- Nuevo test `buildSidebarEntries.test.ts` (6 tests): borrador, abierta con conteos,
  archivada forzada por `estado_gestion`, confirmación con `needsAction` + metaLine
  de consentimientos, activa con seguro, y orden preservado.
- Suite Lanzador: 3 suites / 34 tests. Suite total: **18 suites / 206 tests**.

**Reducción de `any` (primera pasada del barrido).**

- Eliminados 9 casts `(supabase.auth as any)` (la API de auth ya está tipada):
  `ChangePasswordModal`, `AuthContext`, `useAuthLogic`.
- `utils/metricsCalculations.ts`: `calculateDashboardMetrics(allData: any)` ->
  `allData: DashboardData` (interfaz que documenta las 7 colecciones). Los ~24
  `any` dispersos de callbacks y casts `(launch as any)` se reemplazaron por
  inferencia sobre `MetricRow` (un único `[key: string]: any` para el acceso
  dinámico por columna). Comportamiento idéntico (validado por sus 10 tests).
- `any` en src (sin tests/generados): **665 -> 630**.

**Hallazgo (deuda):** quitar los casts `(supabase.rpc as any)` destapó drift entre
los tipos generados (`src/types/supabase.ts`) y las firmas reales de varias RPCs
(args opcionales, `null` vs `undefined`, `.status` en `PostgrestError`). Varias
RPCs ni siquiera están en los tipos generados. Antes de seguir limpiando esos
casts hay que correr `npm run gen-types` (requiere acceso al proyecto Supabase)
para sincronizar las firmas; por eso esos casts se dejaron intactos.

### Reducción de `any` — dominio de métricas/reportes (cerrado)

Se tipó el contrato de datos del dashboard con un patrón reutilizable: una
interfaz `DashboardData` (las 7 colecciones) y `MetricRow` (`{ id: string;
[key: string]: any }` para el acceso dinámico por columna). Ambos se exportan
desde `utils/metricsCalculations.ts` y se reutilizan en los hooks.

Archivos limpiados (comportamiento idéntico, validado por type-check + suite + build):

- `utils/metricsCalculations.ts`: `allData: any` -> `DashboardData`; ~24 `any` -> 1 index signature.
- `services/metricsLists.ts`: filas de RPC tipadas con `RpcListRow` (27 -> 11 `any`).
- `hooks/useExecutiveReportData.ts`: `processAllData`/`processRequestsForYear` tipados con `DashboardData`/`MetricRow` (34 -> 5).
- `hooks/useOperationalData.ts` y `hooks/useActivityFeed.ts`: arrays locales + callbacks tipados con `MetricRow`.
- 9 casts `(supabase.auth as any)` eliminados.

Total `any` en src (sin tests/generados): **665 -> 564**.

Nota técnica: al spread-ear un `MetricRow` en un object literal, TS pierde el index
signature en el tipo resultante; los `.filter` posteriores a un `.map` que vuelven
a indexar por columna se anotan explícitamente como `MetricRow`.

### Bloqueo conocido: drift de tipos de RPC (requiere acceso a Supabase)

Los casts `(supabase.rpc as any)` restantes NO se pueden quitar de forma segura
hasta sincronizar `src/types/supabase.ts` con la base:

- varias RPCs no están en los tipos generados (`get_convenios_list`,
  `get_convenios_por_vencer`, `get_convenios_kpis`, `get_student_signup_*`, etc.);
- otras tienen firmas desactualizadas (args opcionales, `null` vs `undefined`,
  `.status` en `PostgrestError`).

Resolución: correr `npm run gen-types` (requiere token/acceso al proyecto Supabase
`qxnxtnhtbpsgzprqtrjl`) y luego quitar los casts y ajustar los call-sites. Esto se
facilita instalando el **MCP de Supabase** (introspección de schema + generación de
tipos) — pendiente de credenciales del owner.

El resto de los `any` (~564) vive mayormente en componentes de presentación sin
tests; se recomienda seguir el enfoque incremental guiado por el warning de
`@typescript-eslint/no-explicit-any` ya activo, archivo por archivo.

### Sincronización de tipos Supabase + limpieza de casts de RPC (CLI linkeado)

Con el CLI de Supabase autenticado y linkeado (`qxnxtnhtbpsgzprqtrjl`), se regeneró
`src/types/supabase.ts` desde el schema vivo (`npm run gen-types`). Resultado:

- **Todas las RPCs quedaron tipadas** (antes faltaban `get_convenios_*`,
  `get_student_signup_status`, etc.). Se eliminaron **todos** los `(supabase.rpc as any)`.
- Al quitar los casts, el `type-check` destapó desajustes reales que el `any` ocultaba,
  ahora corregidos:
  - `mark_password_changed` no recibe args (se pasaba `{}`).
  - `telefono_input`/`correo_input`: `null` -> `undefined` (la firma de la RPC los toma opcionales).
  - `rpcResetError.status` no existe en `PostgrestError`: el branch `status >= 500` era
    **código muerto** (siempre false); se conservó el comportamiento con acceso opcional tipado.
  - `get_convenios_kpis`: cast vía `unknown` (Json no solapa con `ConveniosKpis`).
- `any` total: 564 -> **554**. Tests 206/206, build OK.

#### ⚠️ Drift de schema detectado (DECISIÓN PENDIENTE del owner)

La regeneración reveló que la migración local
`supabase/migrations/20260625130000_acreditacion_por_pps.sql` (agrega
`practicas.es_online` y `finalizacion_pps.detalle_practicas`) **NO está aplicada en
la base remota**, pero el código ya depende de esas columnas. Es decir: feature
desplegada sin su migración.

- Estado actual: se parchearon manualmente esas 2 columnas en `src/types/supabase.ts`
  (marcado como stopgap) para mantener el build verde sin tocar la base productiva.
- La migración es ADITIVA, idempotente (`IF NOT EXISTS`), retrocompatible y con rollback
  documentado; su propio encabezado dice "aplicarla NO rompe la app actual".
- **Acción recomendada (requiere OK del owner):** aplicar la migración a remoto
  (`supabase db push` o MCP `apply_migration`), luego `npm run gen-types` para reemplazar
  el parche manual por los tipos reales. Incluye un backfill de datos
  (`UPDATE practicas SET es_online = true WHERE ...`), por eso se pide confirmación.

### Escaneo de seguridad (ggshield) — 2 secretos hardcodeados removidos

`ggshield secret scan` sobre `src/`, `supabase/`, `scripts/` detectó **2 secretos reales** committeados:

- `src/services/todoistDirectService.ts:5`: token de API de Todoist hardcodeado.
- `src/components/admin/AdminDashboard.tsx:28`: token interno de Hermes hardcodeado (como fallback de la env var).

Ambos se removieron del código y ahora se leen solo de variables de entorno
(`VITE_TODOIST_TOKEN`, `VITE_HERMES_INTERNAL_TOKEN`), documentadas en `.env.example`.
Re-escaneo: 0 incidencias. type-check + tests + build OK.

**⚠️ ACCIÓN REQUERIDA del owner (los tokens estuvieron en el repo → potencialmente expuestos):**

1. **Rotar** ambos tokens (Todoist + Hermes interno) — revocar los viejos y emitir nuevos.
2. Setear los nuevos valores como env vars (local `.env` + secrets de CI/GitHub).
3. Considerar proxyear Todoist vía Edge Function: una `VITE_*` se incluye en el bundle
   del cliente, así que un token de Todoist en el frontend queda expuesto igual.

### Pendiente sin resolver: aplicar migración a remoto

No se pudo aplicar la migración `20260625130000` (es_online/detalle_practicas) porque:

- `supabase db push` está bloqueado por drift de historial (el remoto tiene ~60
  migraciones no presentes como archivos locales; repararlo en producción es riesgoso).
- El MCP de Supabase (que permitiría `apply_migration` puntual) requiere que el owner
  complete el login OAuth en el navegador (Command Palette → "Kiro: Focus on MCP Servers View").

Mientras tanto el parche manual de tipos mantiene todo verde. Una vez que el owner
conecte el MCP o autorice el push, aplico la migración + `gen-types` y quito el parche.

### Reducción de `any` — casts de tabla obsoletos (post gen-types)

Con los tipos sincronizados, varios `as any` que existían solo porque los tipos
viejos no incluían ciertas tablas quedaron innecesarios:

- `services/reminderService.ts`: la tabla `reminders` ya está tipada; se eliminaron
  **los 21** `as any` (`.from("reminders" as any)`, `.insert({...} as any)`, wrappers).
- `contexts/ConfigContext.tsx`: la tabla `app_config` ya está tipada; se quitó el cast
  de `.from()` y los `(data as any)`.

`any` total: 554 -> **528**. type-check + 206 tests + build OK.

Nota: `todoist_tasks` NO está en los tipos generados (otra tabla con posible drift),
así que su cast `as any` se conservó.

### Nota sobre el MCP de Supabase

El MCP hosted (`https://mcp.supabase.com/mcp`) usa OAuth de navegador ligado a la
cuenta del owner; no puede conectarse de forma autónoma desde el agente. Para
habilitarlo: Command Palette → "Kiro: Focus on MCP Servers View" → conectar/login
en `supabase`. Una vez conectado, queda disponible `apply_migration` para aplicar la
migración pendiente sin pelear con el drift de historial de `db push`.

### Migración pendiente APLICADA + tipos reales (vía Management API)

Resuelto el drift de schema:

- La migración `20260625130000` (columnas `practicas.es_online` y
  `finalizacion_pps.detalle_practicas`) se aplicó al proyecto remoto vía la
  Management API de Supabase (`POST /v1/projects/{ref}/database/query`), evitando
  el bloqueo de `db push` (drift de historial) y el OAuth del MCP.
- Verificado contra `information_schema.columns`: ambas columnas existen en la base viva.
- `src/types/supabase.ts` regenerado desde el schema vivo vía Management API
  (`GET /v1/projects/{ref}/types/typescript`) — el parche manual de tipos quedó
  reemplazado por las columnas reales. type-check + 206 tests + build OK.

Nota operativa: el CLI (`supabase gen types` / `migration repair`) devolvió 403
para esta cuenta; la Management API con PAT funcionó. La migración NO quedó
registrada en `supabase_migrations.schema_migrations` (el DDL es idempotente con
`IF NOT EXISTS`, así que re-aplicarla en el futuro no rompe nada).

### MCP de Supabase: configurado por token (no OAuth)

El OAuth hosted (`mcp.supabase.com`) daba `Unauthorized`. Se configuró en su lugar
el server por token en `~/.kiro/settings/mcp.json` (nivel usuario, FUERA del repo):
`@supabase/mcp-server-supabase` con `SUPABASE_ACCESS_TOKEN` y `--project-ref`.
Reconectar el server `supabase` en la MCP Servers View para que cargue las tools.

> ⚠️ El PAT se compartió en el chat → debe ROTARSE. Tras rotar, actualizar el valor
> de `SUPABASE_ACCESS_TOKEN` en `~/.kiro/settings/mcp.json`.

### Migración pendiente APLICADA + tipos reales

Con un Personal Access Token del owner se aplicó la migración `20260625130000`
(es_online + detalle_practicas) directamente vía la Management API de Supabase
(`POST /v1/projects/{ref}/database/query`), evitando el bloqueo de `db push`
(drift de historial) y el OAuth del MCP.

- Columnas creadas en remoto (additivas, idempotentes); backfill de `es_online` ejecutado.
- `src/types/supabase.ts` regenerado desde el schema vivo vía Management API
  (`GET /v1/projects/{ref}/types/typescript`) — ahora trae `es_online`,
  `detalle_practicas` y `convenios` reales. **Se eliminó el parche manual de tipos.**
- type-check 0, 206 tests, build OK.
- MCP `supabase` (token, `@supabase/mcp-server-supabase`) configurado en el
  `~/.kiro/settings/mcp.json` del usuario; el OAuth hosted (que daba "Unauthorized")
  quedó deshabilitado.

Notas:

- `npm run gen-types` (CLI) empezó a fallar con error de privilegios; la generación
  vía Management API + PAT funciona como alternativa. Revisar privilegios del login del CLI.
- **El PAT quedó expuesto en el chat de la sesión → ROTARLO** (revocar en
  https://supabase.com/dashboard/account/tokens y reemplazar el valor en `mcp.json`).

### Pulido de base guiado por Supabase Advisors (vía Management API + PAT)

Auditoría de la base con los advisors de Supabase (`/advisors/security` y
`/advisors/performance`) y corrección de los ítems seguros/aditivos:

Estado inicial relevante:

- security: `function_search_path_mutable` (8 funciones), + warnings esperables
  (`*_security_definer_function_executable` x71 = RPCs intencionales,
  `extension_in_public` x2, `public_bucket_allows_listing` x1,
  `auth_leaked_password_protection` x1, `rls_enabled_no_policy` INFO x1).
- performance: `multiple_permissive_policies` x21, `unindexed_foreign_keys` x5,
  `unused_index` x11.
- RLS: **todas** las tablas de `public` tienen RLS habilitado (verificado).

Corregido (migraciones `20260628120000` y `20260628130000`, aplicadas a remoto e
idempotentes):

- **`function_search_path_mutable`: 8 -> 0.** Se fijó `search_path = 'public'` en
  las 6 RPCs de métricas SECURITY DEFINER (`get_activos_list`, `get_admin_metrics_kpis`,
  `get_finalizados_list`, `get_metrics_years`, `get_proximos_finalizar_list`,
  `get_sin_pps_list`) + `safe_date_cast` y `set_gmail_hilos_updated_at`.
- **`unindexed_foreign_keys`: 5 -> 0.** Índices de cobertura para FKs en
  `admin_action_log`, `agent_suggestions` (x2) y `whatsapp_contactos` (x2).
- Funciones verificadas post-cambio (ejecutan OK con search_path fijo).

Pendientes (no aplicados — requieren decisión/criterio, no son "free"):

- `auth_leaked_password_protection`: habilitar el chequeo HaveIBeenPwned en Auth
  (toggle de config, beneficioso; afecta signup/cambio de contraseña).
- `multiple_permissive_policies` x21: consolidar políticas RLS (rework, validar flujos).
- `unused_index` x11: evaluar drop (ahorro de escritura; confirmar que no se usan).
- `*_security_definer_function_executable` x71: revisar grants de RPCs (mayormente intencional).
- `extension_in_public` x2, `public_bucket_allows_listing` x1: revisar caso por caso.

### Estado de `any` (rendimientos decrecientes)

`any` total: 665 -> 528 en la sesión. Lo limpiado fue lo de mayor valor y menor
riesgo (dominio métricas/reportes, servicios, contextos con tablas ya tipadas,
casts de RPC/tabla obsoletos). El remanente (~528) vive sobre todo en componentes
de presentación sin tests (payloads realtime, `catch (e: any)`, `useState<any>`,
filas en handlers) y conviene seguirlo de forma incremental guiado por el warning
de `@typescript-eslint/no-explicit-any` ya activo, archivo por archivo y con QA manual.

### Modernización: code-splitting del bundle + manejo de errores centralizado

**Code-splitting (vite `manualChunks`).** El build generaba un `index` monolítico
de ~938 KB. Se agregó `manualChunks` en `vite.config.ts` que separa las librerías
pesadas en chunks vendor independientes y cacheables:

- `index`: **938 KB -> 294 KB** (gzip 83 KB).
- chunks aislados: `react-vendor` (154 KB), `supabase` (175 KB), `charts` (295 KB),
  `motion` (114 KB), `firebase` (77 KB), `pdf` (368 KB), `spreadsheet`/exceljs (940 KB),
  `vendor` (341 KB).
- Beneficio: mejor carga inicial (las libs pesadas solo se bajan cuando se usan) y
  mejor cache-hit entre deploys (un cambio en la app no invalida el vendor de React).
- Cambio puramente de bundling; build OK.

**Util de errores centralizado.** Se creó `src/utils/getErrorMessage.ts`
(`getErrorMessage(e: unknown)`), reemplazando el `toErrorMessage` inline de
`supabaseService.ts` (DRY). Se empezó a migrar `catch (e: any)` -> `catch (e)` +
`getErrorMessage(e)` en servicios (`geminiService`, `storageService`,
`todoistDirectService`). El resto de los `catch (e: any)` queda como limpieza
incremental con el mismo patrón.

`any` total: **526**. type-check 0, 206 tests, build OK.
