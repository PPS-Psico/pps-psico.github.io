# Rediseño del reporte ejecutivo de PPS

Fecha de análisis: 17 de julio de 2026.

Estado: propuesta para validación antes de implementar.

## Decisión acordada

Construir un sistema documental nuevo, versionado y orientado a autoridades,
sin borrar ni modificar el generador anual existente. Ambos quedarán disponibles
en paralelo para poder compararlos durante la validación. El nuevo módulo tendrá
nombre, acceso y contrato de datos propios para que no pueda confundirse con el
generador actual.

El sistema nuevo ofrecerá dos productos:

1. un **informe anual de situación**, seleccionable por año, con una comparación
   contextual contra el año anterior cuando las definiciones sean comparables;
2. un **informe general de gestión**, que reconstruirá todo 2024, marcará de
   manera visible el ingreso de Blas Rivera a la institución y documentará los
   avances desde ese hito hasta la fecha de corte.

La audiencia primaria son las autoridades. El objetivo es entregar un estado de
situación detallado, comprensible y respaldado por evidencia; no es un tablero
para la toma de decisiones cotidiana del coordinador. La vista web y el PDF
nuevos consumirán exactamente el mismo modelo de datos y las mismas definiciones
de `analytics-v2`.

Para la descarga directa se recomienda `@react-pdf/renderer` en el cliente. Es
compatible con el hosting estático actual, no envía información institucional a
un tercero y permite controlar fuentes, páginas, encabezados, tablas y gráficos
vectoriales. La vista web seguirá siendo HTML semántico. Ambas representaciones
se reconciliarán mediante pruebas sobre un `ExecutiveReportModel` común.

## Qué debe resolver el documento

Una autoridad debería poder contestar, en menos de tres minutos:

1. cuál es el estado del programa al corte;
2. qué cambió respecto de una base comparable;
3. cuáles fueron los principales avances y asuntos pendientes;
4. qué parte de la lectura es sólida y qué parte tiene limitaciones;
5. cómo se explica cada resultado y de qué fuente proviene.

El reporte actual responde bien el primer punto y contiene evidencia para los
demás, pero obliga al lector a construir la interpretación por su cuenta. El
nuevo documento debe explicar el estado institucional sin presuponer que la
autoridad conoce la operatoria cotidiana de las PPS.

## Auditoría del estado actual

### Fortalezas que deben conservarse

- `analytics-v2` separa flujos, stocks, capacidad y calidad.
- Los ciclos en curso se comparan al mismo día del calendario.
- La capacidad distingue cupos fijos de plazas realizadas.
- La reconstrucción 2024 evita contar filas legacy como ofertas reales.
- Trayectoria usa mediana y rango intercuartílico, no sólo promedio.
- Los indicadores experimentales informan muestra y cobertura.
- Las listas de detalle ya se reconciliaron con los KPI principales.

### Convivencia controlada de dos reportes

La pestaña **Reporte** usa el nuevo contrato analítico. En cambio, el generador
histórico de **Descargas** (`useExecutiveReportData` +
`PrintableExecutiveReport` + `executiveReportPdf`) vuelve a descargar tablas
completas y recalcula indicadores con `processAllData`.

Si ambos documentos se presentaran como equivalentes, existirían cuatro riesgos:

- dos documentos con el mismo nombre pueden mostrar valores distintos;
- las correcciones de `analytics-v2` no llegan automáticamente al reporte viejo;
- el cálculo legado mezcla consulta, negocio, narrativa y maquetación;
- se mantiene por duplicado una versión HTML y otra imperativa en jsPDF.

Por decisión de producto, el generador histórico se conservará intacto como
alternativa de comparación. La implementación nueva no retirará esa ruta, no
reemplazará su PDF y no modificará sus cálculos. En la interfaz se diferenciarán
de forma inequívoca **Generador anual actual** y **Nuevo reporte ejecutivo**.
Sólo el nuevo llevará versión de contrato, trazabilidad de fuentes y pruebas de
reconciliación con `analytics-v2`.

### Problema de narrativa ejecutiva

El documento actual se organiza como inventario de datos: matrícula,
trayectoria, seguimiento, instituciones, orientación, dinámica y anexo. Falta
una página inicial que transforme esos datos en una lectura institucional.

No están jerarquizados de forma explícita:

- los tres hallazgos principales;
- los avances verificables;
- los riesgos y limitaciones;
- los asuntos que merecen seguimiento institucional;
- la continuidad temporal entre resultados, mejoras y pendientes.

Una variación positiva tampoco equivale automáticamente a buen desempeño. Sin
una meta formal sólo puede informarse crecimiento, reducción o cambio respecto
de una base. El reporte no debe llamar "cumplimiento" o "resultado favorable" a
una cifra que no tenga objetivo aprobado.

### Problemas de medición y explicación todavía visibles

1. **Stocks históricos.** `active_students` y
   `active_students_with_current_pps` representan el estado actual y el contrato
   marca `historically_comparable = false`. No deben aparecer como si fueran el
   stock reconstruido de 2024 o 2025.
2. **2024 es un resultado anual consolidado.** El resultado oficial es de 42
   ofertas y 270 vacantes finitas documentadas. De las 42 ofertas, 36 poseen un
   cupo finito que suma exactamente 270 y seis son de capacidad no finita. Estas
   últimas se informarán por separado: no introducen duda sobre el resultado de
   270 vacantes finitas ni se convertirán en una capacidad numérica estimada.
3. **2025 tiene baja cobertura relacional.** Al cierre anual sólo 3,2% de las
   prácticas están vinculadas a lanzamiento y 0% de los lanzamientos a
   institución. Los análisis históricos por institución u orientación deben
   bloquearse o rotularse como no publicables hasta la reconstrucción.
4. **Selección 2026 sigue experimental.** `selected_at` cubre 199 de 454
   selecciones (43,8%). La mediana de espera no puede usarse como KPI de
   desempeño interanual.
5. **Capacidad 2026 requiere contexto.** La capacidad operativa combina 243
   cupos fijos y 249 plazas realizadas. El aumento no es sólo expansión de cupos
   anunciados.
6. **Dos lanzamientos fijos superan el cupo registrado.** Deben figurar como
   incidencia operativa, no quedar enterrados en una nota metodológica.

### Riesgos de presentación y privacidad

- El reporte ejecutivo incluye un foco nominativo de estudiantes sin PPS. Los
  nombres y legajos no deberían circular en el cuerpo principal destinado a
  autoridades; ese listado debe ser un exportable operativo separado y
  restringido.
- Las notas metodológicas usan tamaños cercanos a 10,5 px y cargan demasiado la
  lectura en A4.
- Algunas secciones completas tienen `break-inside: avoid`; una sección larga
  puede dejar grandes blancos o paginar de manera inestable.
- No hay portada, índice, encabezado corrido, numeración `página n de N` ni una
  ficha de trazabilidad documental.
- En el comparativo la numeración salta de 01 a 03.
- La fuente se declara de forma genérica al final, no junto a cada figura o
  tabla.
- El diseño de impresión depende del diálogo del navegador y de que el usuario
  habilite gráficos de fondo.
- El PDF creado con jsPDF usa una plantilla distinta de la vista web; la paridad
  visual y semántica no está garantizada.

## Lectura real disponible al 17/07/2026

Comparación YTD al mismo día:

| Indicador                     | 2025 | 2026 | Variación | Lectura permitida                          |
| ----------------------------- | ---: | ---: | --------: | ------------------------------------------ |
| Estudiantes que iniciaron PPS |  105 |  190 |    +81,0% | Crecimiento del flujo de inicios           |
| Finalizaciones efectivas      |   17 |   28 |    +64,7% | Más finalizaciones registradas al corte    |
| Lanzamientos PPS              |   35 |   41 |    +17,1% | Mayor volumen de oferta operativa          |
| Capacidad operativa           |  195 |  492 |   +152,3% | Crece con fuerte peso de plazas realizadas |
| Estudiantes postulantes       |  169 |  203 |    +20,1% | Mayor cantidad de personas buscando lugar  |
| Postulaciones                 |  661 |  779 |    +17,9% | Mayor volumen de inscripciones             |

Estas cifras permiten afirmar que el programa procesó más actividad en 2026.
No permiten afirmar por sí solas que mejoró la eficiencia, que se resolvió toda
la demanda o que aumentó la tasa de finalización de una cohorte.

Para 2024 completo, el resultado consolidado es de 42 ofertas y 270 vacantes
finitas documentadas: 36 ofertas con cupo finito y seis de capacidad no finita.
La demanda histórica no está disponible en la base. El informe puede comparar
el volumen de ofertas entre años; sólo calculará variaciones de capacidad cuando
ambos períodos utilicen una definición equivalente y lo declarará junto a la
cifra.

## Modalidades del nuevo reporte

### Informe anual de situación

- el usuario selecciona un año calendario;
- presenta el cierre anual o, para el año en curso, el corte exacto de emisión;
- explica oferta, capacidad, acceso, trayectoria, finalización, red institucional
  y calidad del dato;
- incorpora una columna o bloque de comparación con el año anterior sólo para
  métricas homogéneas;
- evita mezclar un año cerrado con un año parcial sin una etiqueta YTD visible;
- cierra con una síntesis de avances, asuntos pendientes y notas metodológicas.

Para 2024 mostrará sin ambigüedad: **42 ofertas**, **270 vacantes finitas** y
**seis ofertas de capacidad no finita**.

### Informe general de gestión

- comienza con el año 2024 completo, no únicamente con el período posterior al
  ingreso del coordinador;
- incorpora una línea de tiempo y un hito visual con la fecha efectiva de ingreso
  de Blas Rivera;
- diferencia el contexto recibido, las acciones de normalización, los cambios de
  medición y los resultados observables hasta la fecha de corte;
- atribuye avances a la gestión únicamente cuando exista evidencia temporal o
  documental suficiente; cuando sólo haya coexistencia temporal, usa lenguaje
  descriptivo y no causal;
- conserva los resultados anuales completos y utiliza cortes equivalentes para
  comparaciones parciales;
- termina con el estado actual, avances consolidados, pendientes legítimos y
  limitaciones de información.

## Arquitectura editorial propuesta

### Documento principal: 6 a 8 páginas

1. **Portada institucional**
   - título del documento y tipo de corte;
   - período analizado;
   - fecha de emisión;
   - responsable y estado del documento;
   - clasificación "Circulación interna";
   - versión del reporte y del contrato de métricas.

2. **Resumen ejecutivo de una página**
   - una conclusión principal escrita en lenguaje directo;
   - tres hallazgos con evidencia;
   - cuatro indicadores esenciales;
   - bloque "Requiere atención";
   - bloque "Estado y seguimiento institucional".

3. **Acceso y capacidad**
   - demanda, inicios y oferta al mismo corte;
   - composición de la capacidad fija/realizada;
   - orientaciones con mayor presión;
   - una conclusión textual debajo de cada gráfico.

4. **Trayectoria y finalización**
   - finalizaciones efectivas;
   - mediana, P25 y P75 del tiempo de trayectoria;
   - cobertura de la medición;
   - lectura que evite convertir una razón transversal en tasa de cohorte.

5. **Red institucional**
   - instituciones activas y convenios nuevos;
   - aporte de capacidad por nueva institución;
   - cobertura territorial u otra dimensión sólo cuando exista dato canónico.

6. **Calidad, avances y asuntos pendientes**
   - semáforo de publicabilidad de cada familia de indicadores;
   - incidencias operativas;
   - mejoras implementadas y su estado de consolidación;
   - pendientes legítimos y alcance de sus efectos.

### Anexo técnico

- diccionario de indicadores;
- período, fecha de corte y reglas de comparabilidad;
- fuente por tabla y figura;
- tamaño de muestra y cobertura;
- listado agregado de lanzamientos;
- detalle de capacidad histórica 2024;
- historial de versión del reporte.

Los listados con nombres o legajos se exportarán por separado y no formarán
parte del PDF ejecutivo por defecto.

## Sistema de lectura para autoridades

Cada indicador deberá presentar siempre, en el mismo orden:

1. **valor** y unidad;
2. **período** o instante de referencia;
3. **base comparable**;
4. **interpretación** en una oración;
5. **calidad**: cobertura, muestra o limitación relevante;
6. **estado de seguimiento** cuando la métrica requiera contexto adicional.

Las variaciones usarán lenguaje neutral. Verde y rojo se reservarán para una
meta o regla explícita; un incremento no será verde por defecto. Color nunca
será el único canal para comunicar estado.

## Opciones de generación de PDF evaluadas

| Opción                           | Fortalezas                                                                                | Debilidades                                                                                  | Adecuación al proyecto                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Impresión HTML/CSS del navegador | Reutiliza la vista, costo bajo                                                            | Diálogo manual, paginado y encabezados limitados, resultado dependiente del navegador        | Útil como respaldo                                        |
| jsPDF + AutoTable actual         | Descarga local y directa                                                                  | Posicionamiento imperativo, plantilla duplicada, difícil sostener diseño editorial           | Conservar sin cambios para comparar                       |
| `@react-pdf/renderer`            | Descarga directa, React, fuentes embebidas, gráficos vectoriales, paginado determinístico | Usa primitivas y estilos propios; requiere una plantilla PDF específica                      | **Recomendada**                                           |
| pdfmake                          | Declarativo, tablas y encabezados repetidos                                               | Otra DSL, tipografía y composición menos flexibles, bundle adicional                         | Alternativa funcional                                     |
| HTML/CSS + Playwright/Puppeteer  | Alta fidelidad, encabezados, pies, PDF etiquetado experimental                            | Requiere servicio Node o proceso CI; no funciona como descarga autónoma del hosting estático | Excelente para automatización futura                      |
| Vivliostyle / Paged.js           | Paged Media avanzado, índice y encabezados corridos                                       | Mayor complejidad; Vivliostyle usa AGPLv3 y requiere revisión de integración                 | Valiosa si el producto evoluciona a publicación editorial |
| WeasyPrint                       | Muy buen HTML/CSS paginado                                                                | Requiere servicio Python y no ejecuta la aplicación React                                    | No prioritaria                                            |
| Prince                           | Calidad editorial profesional                                                             | Licencia comercial elevada e infraestructura adicional                                       | Excesiva para esta etapa                                  |

## Arquitectura técnica recomendada

```text
Supabase analytics-v2
        |
        v
get_executive_report_v1 (contrato staff, versionado)
        |
        v
ExecutiveReportModel (una sola semántica)
        |
        +--> Informe anual por año
        |
        +--> Informe general de gestión
        |
        +--> Reporte web accesible (HTML + CSS)
        |
        +--> PDF A4 (@react-pdf/renderer)
        |
        +--> Excel/CSV de respaldo y anexo operativo
```

El RPC nuevo no tiene que duplicar todos los cálculos: debe componer y congelar
el contrato documental, con corte, versión, fuentes, muestras y estados de
publicabilidad. La narrativa cuantitativa será determinística. Una nota manual
del coordinador podrá complementar el documento, pero no modificar cifras.

El generador anual existente permanecerá fuera de este flujo. No consumirá el
nuevo contrato ni será requisito para validar la paridad del nuevo PDF.

## Identidad, autoría y firma

- responsable: **Blas Rivera**;
- cargo confirmado: **Coordinador General**;
- sede: **Comahue**;
- correo: **blas.rivera@uflouniversidad.edu.ar**;
- línea de firma: **Blas Rivera — Coordinador General — Psicología, Sede Comahue**;
- audiencia: autoridades institucionales;
- clasificación predeterminada: **Circulación interna**.

La coordinación de Psicología Buenos Aires es una coordinación distinta y no
debe figurar en la firma de este reporte.

## Criterios de calidad del PDF

- A4, márgenes reales y grilla editorial estable;
- portada y secciones con paginación intencional;
- encabezado corrido y `página n de N`;
- tipografías embebidas y texto seleccionable;
- tablas con encabezado repetido;
- gráficos vectoriales con etiquetas y valores visibles;
- contraste WCAG AA y lectura válida en escala de grises;
- metadatos: título, autor institucional, asunto, idioma y versión;
- ninguna cifra sin período, unidad y fuente;
- ninguna tabla cortada, texto superpuesto o fila huérfana;
- verificación automática de contenido y revisión visual de todas las páginas.

## Pruebas y trazabilidad

1. contrato SQL con fixtures y cortes 2024, 2025 y 2026;
2. reconciliación de KPI del PDF contra `get_analytics_v2`;
3. pruebas unitarias de variaciones, redondeos y etiquetas de comparabilidad;
4. prueba que prohíba PII en el modelo ejecutivo;
5. generación de PDF de referencia;
6. extracción de texto con `pypdf` para validar cifras, versión y páginas;
7. render de todas las páginas a PNG con Poppler;
8. inspección visual en A4 y prueba de contraste;
9. snapshot del esquema del documento para detectar cambios no intencionales.

## Implementación por etapas

### Etapa 1 - Contrato nuevo y convivencia segura

- definir `ExecutiveReportModel`;
- crear `get_executive_report_v1` o un compositor equivalente probado;
- conectar los dos modos nuevos al contrato `analytics-v2`;
- preservar sin cambios el generador anual actual;
- diferenciar claramente ambas opciones en navegación, títulos y archivos;
- añadir pruebas de reconciliación y privacidad.

### Etapa 2 - Edición anual y de gestión

- implementar el informe anual seleccionable y el informe general de gestión;
- integrar la comparación contra el año anterior dentro del informe anual;
- crear resumen, hallazgos, avances, riesgos y asuntos pendientes;
- incorporar el hito de ingreso del coordinador en la cronología de gestión;
- separar anexo técnico y exportable operativo nominativo;
- documentar reglas de redacción y publicabilidad.

### Etapa 3 - Sistema visual y PDF

- construir la vista editorial accesible;
- construir la plantilla A4 con `@react-pdf/renderer`;
- incorporar tipografías, gráficos vectoriales y metadatos;
- implementar descarga con nombre de archivo estable;
- mantener operativo el PDF actual para la comparación solicitada.

### Etapa 4 - Validación y operación

- revisar un documento real con coordinación y una autoridad;
- corregir comprensión, no sólo estética;
- comparar el resultado nuevo con el generador anual actual sin exigir que ambos
  compartan la misma definición histórica;
- renderizar y revisar todas las páginas;
- documentar el runbook de generación y publicación;
- versionar cada documento emitido y su fecha de corte.

## Definiciones confirmadas antes de diseñar

Confirmado:

- audiencia primaria: autoridades;
- propósito: estado de situación anual y rendición general de gestión;
- universo de evidencia: todo lo existente en esta base de datos;
- resultado 2024: 42 ofertas y 270 vacantes finitas documentadas;
- autor: Blas Rivera, Coordinador General;
- unidad: Psicología, Sede Comahue;
- correo: blas.rivera@uflouniversidad.edu.ar;
- identidad: uso del logotipo y la paleta institucional de UFLO;
- el generador anual actual no se borra ni se modifica.

El hito de ingreso se fija documentalmente el **1 de septiembre de 2024**. La
dirección visual aprobada es institucional-editorial sobria: fondo claro, azul
profundo y verde UFLO, tipografía de alta legibilidad, gráficos limpios y una
expresión más narrativa para el informe de gestión que para el anual.

### Contrato visual aprobado

- azul profundo UFLO `#0F1B62` como color primario;
- verde UFLO `#3CB88D` como acento funcional y temporal;
- bordó institucional `#46253D` reservado a detalles secundarios;
- tinta `#151A27`, gris frío `#697386`, fondo `#F7F8FA` y blanco `#FFFFFF`;
- `Source Serif 4 Semibold` para títulos editoriales y conclusiones narrativas;
- `Manrope` para cifras, tablas, metadatos, controles y cuerpo funcional;
- eje temporal azul/verde con hito destacado como motivo de continuidad;
- sin gradientes, vidrio, sombras pesadas, tarjetas repetitivas ni estética de
  tablero SaaS genérico.

### Dirección de composición aprobada

Se adopta **Atlas de evidencia** como sistema principal: páginas claras,
jerarquía editorial, diagramas de composición, comparaciones horizontales con
etiquetas directas y cronologías legibles. El informe general de gestión toma la
portada azul ceremonial de la dirección **Editorial de autoridad**. El logotipo
se renderiza desde el componente institucional existente y nunca desde las
imágenes conceptuales.

## Referencias de diseño y tecnología

- IBCS / ISO 24896: consistencia de notación y composición en reportes.
- Government Analysis Function: títulos con mensaje, anotaciones, fuentes,
  tablas alternativas y descarga de datos.
- W3C WCAG 2.2: contraste de texto y objetos gráficos; no depender del color.
- Documentación oficial de React-pdf, Puppeteer, Vivliostyle, Paged.js,
  pdfmake, jsPDF, WeasyPrint y Prince.
