# Revisión operativa del legado 2024

Fecha de corte: 2026-07-17
Estado: completado en Supabase productivo. Migraciones aplicadas y verificadas:
`cleanup_2024_legacy_entities` y `cleanup_2024_plottier_institution`.

## Objetivo

Cerrar las observaciones que quedaron fuera del backfill determinístico inicial sin
inventar relaciones. La capa histórica canónica ya evita que estos casos distorsionen
las estadísticas; esta etapa corrige o documenta las entidades operativas legacy.

## Resumen de la investigación

| Cola inicial                 | Descomposición comprobada                                                                                    | Tratamiento propuesto                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 20 ofertas con observaciones | Las 20 quedan resueltas; coordinación confirmó 20 h como valor definitivo de Fútbol Valorado                 | Registrar cada resolución y cerrar la revisión                               |
| 44 prácticas sin lanzamiento | Las 44 tienen destino explícito: 39 por evidencia documental y 5 por decisión de dominio/excepción histórica | Vincular por migración con aserciones de conteo; no usar coincidencia difusa |
| 9 ofertas sin fila legacy    | Las 9 pueden reconstruirse; M-PBI fue confirmada como PPS externa alojada en Psicoterapia Corporal           | Crear filas históricas ocultas, nunca convocatorias activas                  |

## Las 44 prácticas, reducidas a decisiones reales

### A. Destino determinístico o de alta confianza: 39

| Grupo                                  | Cantidad | Resolución                                                                                 |
| -------------------------------------- | -------: | ------------------------------------------------------------------------------------------ |
| Parque Industrial, primer período      |        8 | Crear lanzamiento de marzo y vincular las prácticas iniciadas el 12/03                     |
| Parque Industrial, segundo período     |        1 | Vincular al lanzamiento existente iniciado el 12/08, slot Grupo de Mujeres                 |
| UFLO Entrevistas a Profesionales       |       12 | Crear lanzamiento continuo y vincular las 12 realizaciones                                 |
| Investigación Adultos Mayores, abril   |        1 | Crear lanzamiento del 06/04 y vincular la práctica de 30 h                                 |
| Investigación Relaciones 50-70, agosto |        1 | Crear lanzamiento del 24/08 y vincular la práctica específica de 30 h                      |
| UFLO SAU, primer período               |        5 | Crear lanzamiento del primer cuatrimestre y vincular las cinco prácticas                   |
| ASER, septiembre                       |        2 | Vincular al lanzamiento existente del 02/09                                                |
| Colegio San José Obrero                |        1 | Vincular al lanzamiento principal del 09/09; coincide con el slot de 24 h                  |
| Barriletes, cohorte de marzo           |        8 | Vincular al lanzamiento comunitario del 19/03; el anuncio del 14/03 y las fechas convergen |

### B. Decisión humana o excepción explícita resuelta: 5

| Grupo                                 | Cantidad | Duda que no debe resolverse por aproximación                                                                  |
| ------------------------------------- | -------: | ------------------------------------------------------------------------------------------------------------- |
| Barriletes, 06/06                     |        1 | Se vincula a la cohorte comunitaria previa del programa continuo                                              |
| Barriletes, 10/09                     |        1 | Se vincula a la cohorte clínica de agosto; no se cambia la especialidad individual                            |
| UFLO PPS Investigación, 27/08 y 29/08 |        2 | Se preservan bajo un lanzamiento legacy realizado y sin anuncio, como modalidad histórica luego discontinuada |
| UFLO SAU, 24/08                       |        1 | Se preserva como segundo período legacy interno sin anuncio, modalidad luego discontinuada                    |

## Las 9 ofertas sin lanzamiento legacy

| Oferta                             | Evidencia                                              | Acción propuesta                                                                      |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Centro de Salud Progreso           | Anuncio: 2 vacantes, 120 h, inicio marzo               | Crear institución y lanzamiento oculto sin prácticas                                  |
| Parque Industrial — primer período | Anuncio más 8 prácticas                                | Crear lanzamiento y vincular prácticas                                                |
| Investigación Adultos Mayores      | Anuncio más práctica del 06/04                         | Crear lanzamiento y vincular práctica                                                 |
| UFLO Entrevistas a Psicólogos      | Anuncio continuo más 12 prácticas                      | Deduplicar institución maestra, crear lanzamiento y vincular prácticas                |
| UFLO SAU/PAOS — primer período     | Anuncio más 5 prácticas                                | Deduplicar institución maestra, crear lanzamiento y vincular prácticas                |
| Asociación PENSAR — AYUN           | Anuncio; institución maestra existente; sin prácticas  | Crear lanzamiento oculto con capacidad/resultado desconocidos                         |
| Mindfulness M-PBI — junio/julio    | Anuncio con 21 vacantes y confirmación de coordinación | Crear bajo Centro de Psicoterapia Corporal PATAGONIA, sin inventar prácticas ausentes |
| Investigación Relaciones 50-70     | Anuncio más práctica específica del 24/08              | Crear lanzamiento y vincular práctica                                                 |
| Colegio Virgen del Luján           | Anuncio y relanzamiento; sin prácticas                 | Crear institución y lanzamiento oculto con resultado sin prácticas                    |

## Duplicados maestros comprobados

Existen tres instituciones `UFLO - Entrevista a Profesionales`, tres `UFLO - SAU`
y dos `UFLO - PPS Investigación`. Ninguna de esas ocho filas está referenciada por
lanzamientos, convenios, solicitudes o contactos de WhatsApp. Se pueden consolidar
en una sola fila por nombre dentro de la misma migración, con validaciones previas y
posteriores.

## Decisiones de dominio registradas

1. M-PBI fue una PPS de una docente UFLO realizada externamente en el Centro de
   Psicoterapia Corporal PATAGONIA para cumplir el requisito de institución con
   convenio. La institución anfitriona y el nombre del programa son dimensiones
   distintas y ambas deben conservarse.
2. Barriletes desarrollaba actividades acreditables en Clínica y Comunitaria. No se
   debe forzar la especialidad de las prácticas a la orientación general del anuncio.
3. SAU fue una práctica interna histórica de UFLO, anterior a la normalización del
   requisito de institución externa. Se discontinuó y debe marcarse como excepción,
   no borrarse ni reinterpretarse como práctica vigente.
4. Investigación también fue aceptada históricamente como PPS y luego dejó de
   gestionarse por este circuito. Las dos realizaciones genéricas de agosto quedan
   documentadas como legacy sin anuncio.

## Resolución académica de Fútbol Valorado

Aunque una comunicación intermedia de Fútbol Valorado indicaba 10 horas y una sola
jornada acreditable, coordinación confirmó el 2026-07-17 que el valor académico
definitivo fue 20 horas. La migración corrige las fechas imposibles y conserva las 33
acreditaciones de 20 horas.

## Reglas de implementación acordadas

- Una migración transaccional y reejecutable por condiciones semánticas.
- Aserciones de conteos antes y después; abortar ante cualquier deriva.
- Las filas reconstruidas quedan `Oculto`, nunca `Abierta` ni `Activa`.
- No copiar contenido personal del chat a la base o al repositorio.
- Conservar la procedencia por `offer_id`, referencias de línea y notas de resolución.
- Regenerar tipos y ejecutar contrato SQL, type-check y pruebas al finalizar.

## Artefacto de implementación

La migración preparada es
`supabase/migrations/20260717223000_cleanup_2024_legacy_entities.sql`. Incluye
aserciones antes y después: 44→0 prácticas sin vínculo, 9→0 ofertas documentadas sin
fila legacy, consolidación de duplicados UFLO y 20→0 ofertas con revisión pendiente.

La migración complementaria
`supabase/migrations/20260717225321_cleanup_2024_plottier_institution.sql`
consolidó el duplicado por doble espacio de Municipalidad de Plottier y elevó la
cobertura institucional a 80/80 lanzamientos 2024.

## Resultado productivo verificado

- 363/363 prácticas PPS 2024 vinculadas a un lanzamiento; pendientes: 0.
- 80/80 lanzamientos PPS 2024 vinculados a una institución.
- 42/42 ofertas históricas verificadas y conciliadas con 60 filas legacy.
- 11 lanzamientos reconstruidos, todos `Oculto` y `Archivado` en gestión.
- Tres grupos institucionales UFLO y el duplicado de Plottier consolidados.
- Cero rangos de fecha invertidos en lanzamientos y prácticas 2024.
- Fútbol Valorado conserva 33 prácticas de 20 horas, según confirmación final.
