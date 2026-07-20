# Reconstrucción de lanzamientos PPS 2024 desde el grupo de WhatsApp

## Resumen técnico

Sí: el archivo permite reconstruir una parte sustancial y estadísticamente útil
de la oferta pública de PPS de 2024. La primera conciliación identifica **40
anuncios iniciales**, **2 relanzamientos explícitos** y **42 ofertas candidatas**
cuando un mismo anuncio contiene programas con orientación u horas diferentes.
De esas 42 ofertas, 36 informan un cupo finito que suma **270 vacantes ofrecidas**;
las otras 6 son abiertas, realizadas o no informan capacidad.

El hallazgo principal no fue sólo que faltaban registros: la base inicial usaba un
grano distinto. Contenía **69 filas de lanzamiento 2024** y 44 nombres distintos,
pero muchas filas parecen derivadas de prácticas o cohortes realizadas. El chat,
en cambio, documenta la oferta publicada. Por eso `cupos_disponibles` a menudo
representa participantes y no vacantes originales, y contar filas como
"lanzamientos" sobreestima o fragmenta la actividad.

La conciliación inicial vinculó 33 de las 42 ofertas y detectó 9 sin lanzamiento.
Después del lote determinístico, Coordinación resolvió las excepciones de dominio
y la limpieza final cerró los casos restantes: hoy las 42 ofertas están conciliadas
con 60 filas legacy, las 363 prácticas PPS tienen lanzamiento y los 80 lanzamientos
PPS tienen institución.

## Estado de implementación

- Lote A aplicado: 68 vínculos lanzamiento–institución y 317 vínculos
  práctica–lanzamiento.
- Lote B aplicado: fuente, 42 ofertas, 31 slots, 50 relaciones con filas legacy y
  2 eventos de relanzamiento en el esquema `private`.
- Lote C publicado: `analytics-v2` muestra 42 ofertas y 270 vacantes finitas para
  2024; el drilldown reconcilia con las mismas 42 filas.
- Limpieza operativa completada: 44 prácticas conciliadas, 11 lanzamientos legacy
  reconstruidos, 20 observaciones cerradas y duplicados maestros consolidados.
- Lote D pendiente: procedencia y cambios de capacidad nativos para nuevas
  convocatorias.

## La fuente recupera oferta que hoy no existe como lanzamiento

| Indicador                                 | Resultado | Interpretación                                                             |
| ----------------------------------------- | --------: | -------------------------------------------------------------------------- |
| Mensajes del grupo en 2024                |       176 | 109 sustantivos y 67 eventos del sistema                                   |
| Anuncios iniciales identificados          |        40 | No cuenta recordatorios ni los dos relanzamientos como lanzamientos nuevos |
| Ofertas candidatas                        |        42 | Se separan subprogramas con distinta orientación/horas                     |
| Ofertas con cupo finito                   |        36 | Suman 270 vacantes publicadas                                              |
| Ofertas conciliadas en la primera pasada  |        33 | Coincidencia nominal, temporal y/o por prácticas                           |
| Ofertas ausentes en la primera pasada     |         9 | Luego reconstruidas como lanzamientos históricos ocultos                   |
| Filas actuales de `lanzamientos_pps` 2024 |        69 | No son comparables uno a uno con anuncios públicos                         |

Los 9 faltantes incluyen Centro de Salud Progreso, el primer período de Parque
Industrial, dos investigaciones UFLO, Entrevistas a Psicólogos, SAU/PAOS, AYUN,
Mindfulness M-PBI y Colegio Virgen del Luján. Algunos sí tienen prácticas, lo que
confirma que el problema es de identidad histórica y no necesariamente de falta
de actividad.

La evidencia detallada está en
[`whatsapp_2024_launch_candidates.csv`](./whatsapp_2024_launch_candidates.csv).
La matriz no guarda nombres de participantes, teléfonos, correos ni una copia del
chat; sólo fechas, líneas de evidencia y atributos de la convocatoria.

## Dos backfills ya pueden resolverse de forma determinística

La conciliación con Supabase encontró dos lotes de bajo riesgo:

1. **Instituciones de lanzamientos.** Los 69 lanzamientos 2024 tienen
   `institucion_id` nulo. En 68 casos existe una única institución cuyo nombre
   normalizado coincide exactamente. El único caso no automático es Municipalidad
   de Plottier, porque hay dos instituciones maestras equivalentes. El lote seguro
   elevaría la cobertura de 0% a **98,6%**.
2. **Prácticas con lanzamiento.** Hay 363 prácticas PPS iniciadas en 2024; sólo 2
   están vinculadas. Para 317 prácticas sin vínculo existe exactamente un
   lanzamiento con el mismo nombre normalizado y la misma fecha de inicio. Ese
   lote elevaría la cobertura de **0,6% a 87,9%** y deja 44 casos para la
   conciliación histórica por ventanas/episodios.

El preview reproducible sigue disponible en
[`BACKFILL_2024_SAFE_PREVIEW.sql`](./BACKFILL_2024_SAFE_PREVIEW.sql). La migración
aplicada, con guardas de conteo y verificación de triggers, es
`20260717211658_backfill_2024_deterministic_links.sql`.

## Los conflictos confirman que oferta y realización deben medirse por separado

Los casos más importantes son:

- **Fútbol Valorado:** la aclaración final permite acreditar una sola jornada de
  10 horas. La base guarda dos filas de 20 horas y una tercera fila que empieza el
  31 de agosto pero finaliza el 31 de mayo, una imposibilidad temporal.
- **Mindfulness de octubre:** el anuncio ofrece 14 vacantes; la base guarda 22 y
  hay 21 prácticas. Pudo existir una ampliación, pero no debe reemplazarse un dato
  por otro: son capacidad inicial y ocupación observada.
- **Subsecretaría de Trabajo:** el anuncio dice por error `04/09/2025`, mientras
  que la inscripción, los recordatorios, las prácticas y la base ubican el inicio
  en 2024. Es una corrección de alta confianza, pero debe conservarse la fuente.
- **San José Obrero:** el mensaje corregido dice "lunes 8 de septiembre"; en 2024
  el 8 fue domingo. La base y las prácticas apoyan el 9 de septiembre.
- **Fundación Tiempo de Niños:** el mensaje publicado en marzo de 2024 conserva
  "2023" en la duración, probablemente por reutilización del texto anterior.
- **Ofertas con varios slots:** Parque Industrial, Sol Mapu, San José Obrero, IFD
  y Subsecretaría de Empleo combinan horarios o actividades con cupos y, a veces,
  horas diferentes. Una sola cifra de cupo/horas en la cabecera pierde información.

Estos conflictos impiden sobrescribir masivamente fechas, cupos u horas. En cambio,
los vínculos por identificador pueden aplicarse primero y los atributos conflictivos
deben conservarse con procedencia.

## Alcance, definiciones y fuente

- **Fuente:** exportación de WhatsApp del grupo institucional de lanzamientos PPS.
- **Período analizado:** mensajes fechados entre el 1 de enero y el 31 de diciembre
  de 2024; los anuncios aparecen entre el 15 de febrero y el 5 de noviembre.
- **Huella de la fuente:**
  `SHA256 4546FE38C5976458AED7B7D55C424E49F16282289B36227A252420B9072FBA28`.
- **Anuncio inicial:** publicación que abre o comunica una oferta PPS. No incluye
  recordatorios de vacantes ni aclaraciones posteriores.
- **Relanzamiento:** reapertura o nueva comunicación de la misma oferta/periodo;
  se registra como evento, pero no aumenta el conteo de ofertas.
- **Oferta candidata:** unidad con institución/actividad, orientación y horas
  coherentes. Un mensaje puede generar más de una cuando contiene subprogramas
  materialmente distintos.
- **Slot:** opción seleccionable dentro de una oferta (turno, dupla, grupo o
  actividad). Los slots no deben inflar el conteo de ofertas, pero sí conservan su
  capacidad y horario.

La cifra de 270 es descriptiva de las 36 ofertas con cupo explícito. No incluye
ofertas abiertas ni capacidad desconocida y no equivale a estudiantes seleccionados,
prácticas iniciadas o capacidad final ampliada.

## Método de extracción y conciliación

1. Se parseó el formato de exportación de WhatsApp, incluyendo mensajes multilínea
   y marcas Unicode invisibles antes de algunos encabezados.
2. Se separaron eventos del sistema, mensajes sustantivos, anuncios, recordatorios,
   aclaraciones y relanzamientos.
3. Se pseudonimizaron remitentes y se redactaron teléfonos, correos y URLs en los
   archivos temporales; esos archivos viven bajo `scratch/` y están ignorados por Git.
4. Los anuncios se agruparon con grano de oferta y se separaron subprogramas con
   orientación u horas propias.
5. Se conciliaron contra `lanzamientos_pps`, `instituciones`, `practicas` y
   `convocatorias` productivas usando nombre normalizado, fecha, orientación y
   contexto de la publicación.
6. Cada caso se clasificó como coincidencia, uno-a-muchos, faltante o ambiguo, con
   acción recomendada y referencias de línea.

La extracción es reproducible con
[`parse-whatsapp-pps-history.mjs`](../../../scripts/analytics/parse-whatsapp-pps-history.mjs)
y la conciliación preliminar con
[`reconcile-whatsapp-pps-2024.mjs`](../../../scripts/analytics/reconcile-whatsapp-pps-2024.mjs).

## Limitaciones y robustez

- Un export de WhatsApp puede contener mensajes eliminados, flyers sin texto y
  anuncios realizados por otros canales; ausencia en el chat no demuestra que una
  PPS no haya existido.
- El chat prueba publicación, no selección ni realización. No debe usarse para
  fabricar `selected_at`, inscripciones o participantes.
- Un cupo anunciado puede haber sido ampliado. Cuando chat y prácticas difieren,
  deben persistirse ambos con su semántica y fecha de observación.
- Las fechas textuales pueden tener errores de copia. Sólo se corrigen cuando
  convergen calendario, mensajes posteriores, prácticas y base.
- Las líneas de evidencia son auditables únicamente contra el archivo con la
  huella SHA256 indicada.
- La matriz es una propuesta técnica. Los casos `ambiguous_split`, los 9 faltantes
  y las correcciones destructivas requieren revisión de Coordinación.

## Plan de implementación actualizado

### Lote A — vínculos seguros — completado

1. Convertir el preview en una migración con guardas de conteo: exactamente 68
   instituciones y 317 prácticas.
2. Abortarla si los conteos cambian, regenerar tipos y ejecutar pruebas SQL,
   `type-check`, tests y build.
3. Recalcular cobertura y comprobar que ninguna fila previamente vinculada cambió.

### Lote B — capa canónica histórica — completado

1. Crear tablas privadas de `historical_launch_episode`, `historical_launch_slot`
   y `historical_launch_member`, con fuente, huella, confianza y notas de conflicto.
2. Cargar las 42 ofertas candidatas y sus slots sin borrar las 69 filas legacy.
3. Mapear las filas legacy a la oferta canónica; conservar uno-a-muchos y
   relanzamientos como relaciones explícitas.
4. Resolver con revisión humana los 9 faltantes, las instituciones UFLO duplicadas
   y los grupos genéricos de Sol Mapu.

### Lote C — métricas 2024 corregidas — completado

1. Publicar `analytics-v2` con dos medidas distintas: ofertas públicas y slots.
2. Calcular capacidad ofrecida desde la fuente de convocatoria y ocupación desde
   prácticas/selecciones, nunca desde la misma columna.
3. Mantener demanda/tiempo de selección como no disponible para 2024.
4. Comparar 2024 contra el diagnóstico legacy y bloquear variaciones incompatibles.

La implementación final y sus campos están documentados en
[`../ANALYTICS_V2_2024_RELEASE.md`](../ANALYTICS_V2_2024_RELEASE.md).

### Lote D — control operativo

1. Agregar al flujo actual procedencia de capacidad y cambios de cupo.
2. Impedir fechas finales anteriores al inicio y registrar correcciones.
3. Incorporar una exportación anual de ofertas, slots, capacidad y resultados para
   no depender nuevamente de fuentes conversacionales.

## Preguntas que requieren confirmación

1. ¿El programa M-PBI de junio/agosto llegó a realizarse y en qué institución?
2. ¿AYUN tuvo participantes o quedó sólo como oferta publicada?
3. ¿La práctica SAU del 24 de agosto fue un segundo período no anunciado en el chat?
4. ¿Los 22 lugares de Mindfulness de octubre fueron una ampliación aprobada del cupo 14?
5. ¿Qué registro maestro de Municipalidad de Plottier y qué duplicados UFLO deben
   conservarse como institución canónica?
