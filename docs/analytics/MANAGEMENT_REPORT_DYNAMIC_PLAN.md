# Plan del informe dinámico de gestión PPS

Estado: **implementado; consolidación institucional y acceso verificados el 01/09/2026**  
Fecha de aprobación: **31/08/2026**  
Responsable funcional: **Coordinación General de PPS · Psicología · Sede Comahue**

## 1. Alcance confirmado

La implementación modifica exclusivamente el **Informe integral de gestión** del
nuevo reporte ejecutivo.

El **Informe anual detallado** existente no se rediseña, no cambia sus páginas,
métricas, textos ni identidad visual. Se conserva como segundo documento para
adjuntar cuando corresponda. Sólo podrá recibir una adaptación técnica mínima si
fuera necesaria para utilizar la misma fecha de corte elegida por el usuario.

Los dos documentos previstos para circulación son:

1. `Informe de gestión de PPS 2024–<fecha de corte>.pdf`;
2. `Informe anual detallado de PPS <año>.pdf`, generado por el flujo anual
   existente.

## 2. Generación dinámica y fecha de corte

El usuario elige una fecha de corte válida al momento de generar el informe de
gestión. No se guardan cifras manuales dentro del documento.

Reglas:

- el corte no puede ser futuro;
- el período comienza en 2024 y termina en el año de la fecha elegida;
- los años anteriores al año del corte se consultan al 31 de diciembre;
- el año del corte se consulta hasta el día elegido;
- la línea de base de la gestión permanece fijada al 31/08/2024;
- el hito de inicio de gestión permanece fijado al 01/09/2024;
- cada consulta, título, gráfico, tabla, nota y nombre de archivo declara el
  corte efectivo;
- web y PDF consumen exactamente el mismo modelo ya calculado.

Ejemplo: para un corte `15/06/2026`, el informe usa cierre 2024, cierre 2025 y
acumulado 2026 al 15/06/2026. Cuando corresponda una comparación YTD, 2025 se
consulta también al 15/06/2025.

## 3. Pregunta que responde el informe

El documento debe permitir que una autoridad comprenda:

- qué escala y condiciones tenía el sistema PPS al comenzar la gestión;
- cómo evolucionaron la demanda, la oferta, los inicios y las finalizaciones;
- qué convenios, instituciones y espacios se incorporaron;
- cuántos cupos o lugares registrados aportó cada incorporación por año;
- qué red institucional tuvo actividad reciente y en qué orientaciones;
- cuál es el estado al corte y qué limitaciones afectan la lectura.

El informe describe asociaciones temporales verificables. No atribuye causalidad
a la gestión cuando la evidencia sólo demuestra coexistencia temporal.

## 4. Arquitectura editorial

La extensión esperada es de 10 a 12 páginas, ajustada automáticamente según la
cantidad de instituciones y convenios. Las páginas de detalle se paginan con
encabezados repetidos y sin cortar filas.

### 4.1 Portada institucional

- Informe integral de gestión PPS.
- Período 2024–fecha de corte.
- Fecha de emisión y corte de datos.
- Inicio de gestión: 01/09/2024.
- Responsable, unidad y clasificación de circulación.

### 4.2 Resumen de los años de gestión

Matriz comparativa con una columna por año y filas para:

- PPS lanzadas;
- cupos finitos ofrecidos;
- participantes incorporados en ofertas sin cupo finito;
- estudiantes que iniciaron PPS;
- acceso observado en el año del corte: postulantes distintos, inicios y casos
  pendientes, con su distribución por cantidad de PPS intentadas y sin inferir
  intención;
- estudiantes con PPS activa al corte, sólo cuando el stock histórico sea
  reconstruible;
- estudiantes que finalizaron durante el período;
- cuentas de estudiantes creadas;
- nuevas cuentas actualmente activas, con fecha de estado explícita;
- matrícula administrativa PPS, únicamente para años con dato oficial;
- convenios nuevos.

Para 2024 se informa el año completo como base operativa y se marca visualmente
el inicio de la gestión. No se atribuye a la gestión todo el resultado anual.

### 4.3 Crecimiento de la demanda y respuesta institucional

- Serie administrativa 2022/1–2025/1: 39, 87, 101 y 242 matriculados.
- La serie se etiqueta como matrícula administrativa externa; no como altas de
  Mi Panel ni estudiantes nuevos.
- Evolución de ofertas, cupos ofrecidos como capacidad total registrada, inicios
  y finalizaciones. La descomposición técnica se conserva en el contrato, no en
  la lectura directiva.
- Comparaciones parciales únicamente contra el mismo día y mes del año previo.

### 4.4 Cronología de la gestión

- situación de base al 31/08/2024;
- ingreso de la coordinación el 01/09/2024;
- normalización de registros y medición;
- convenios y espacios incorporados;
- resultados anuales y estado actual al corte.

### 4.5 Instituciones incorporadas y aporte a las PPS

Una fila por institución canónica incorporada durante la gestión, consolidando
sus convenios y espacios operativos. También se incluyen seis convenios de 2024
confirmados por Coordinación cuya carga histórica sólo conserva precisión anual:

| Institución / espacio | Convenio desde | Orientaciones | 2024 | 2025 | Año del corte | Total desde el convenio |
| --------------------- | -------------- | ------------- | ---: | ---: | ------------: | ----------------------: |

Cada celda anual muestra un único dato: estudiantes distintos con una PPS
registrada en esa institución durante el año. Banco Provincia del Neuquén se
omite de esta tabla por decisión del responsable, sin borrar su registro fuente.

Convenciones:

- celda vacía: el convenio aún no estaba vigente;
- `0`: convenio existente sin aporte registrado durante el período;
- `ND`: dato no disponible o no publicable;
- el total deduplica estudiantes entre años.

Para una fecha técnica `01/01/2024` proveniente del backfill anual, la interfaz
muestra sólo `2024 · fecha anual registrada`. No afirma que el convenio haya
sido firmado ese día.

El total acumula únicamente actividad desde la fecha de firma hasta la fecha de
corte. Los estudiantes del total se deduplican nuevamente entre años; no se suman
sin más las columnas anuales.

### 4.6 Red institucional con actividad reciente

Listado de instituciones con PPS lanzadas durante los dos años calendario más
recientes incluidos en el informe. Para un corte en 2026, el período es 2025
completo y 2026 hasta el corte.

La tabla muestra institución, orientaciones con sus colores, lanzamientos por año
y total. La vigencia documental y la cobertura de mapeo quedan fuera del cuerpo
directivo.

Campos:

- institución canónica;
- orientaciones observadas en ofertas reales;
- cantidad de ofertas por año;
- última actividad;
- estado de vigencia documental.

Estados:

1. `Vigencia confirmada`: último convenio registrado no vencido al corte;
2. `Vigencia pendiente de validación`: existe actividad reciente pero falta
   cobertura documental suficiente;
3. `Inconsistencia a regularizar`: actividad posterior al vencimiento registrado
   u otra contradicción material.

No se presenta como jurídicamente vigente una institución cuya documentación no
puede confirmarse desde la fuente disponible.

### 4.7 Cierre ejecutivo

- escala alcanzada al corte;
- capacidad institucional instalada;
- avances verificables;
- asuntos pendientes;
- referencia al Informe anual detallado del año actual como documento adjunto.

## 5. Contrato de métricas

Se mantienen las definiciones vigentes de:

- `analytics-v2` para resultados anuales;
- `population-contract-v2` para matrícula, cuentas y activación;
- `historical-scope-v1` para 2024 y el alcance de gestión.

Reglas obligatorias:

- matrícula administrativa, cuenta creada, cuenta activa, postulación e inicio
  de PPS son poblaciones distintas;
- `estudiantes.cohorte` no representa cuenta creada ni matrícula;
- las cuentas creadas se fechan con `auth.users.created_at`;
- los stocks siempre declaran fecha de corte y no se reconstruyen si la fuente
  sólo conserva estado actual;
- 2024 publica 42 ofertas, 36 ofertas finitas por 270 vacantes y 6 ofertas sin
  cupo finito;
- la etiqueta visible no expone nombres internos como `analytics-v2`;
- la versión técnica se conserva en metadatos o anexo técnico.

## 6. Requisitos de datos previos a publicación

1. Reconstruir y revisar la institución de las ofertas 2025 sin
   `institucion_id`.
2. Completar los vínculos faltantes del año del corte.
3. Consolidar variantes de nombre sin fusionar instituciones distintas.
4. Verificar último convenio y vencimiento por institución.
5. Resolver inconsistencias entre actividad y vigencia registrada.
6. Mantener visible la cobertura del historial de cuentas: comienza el
   29/11/2025 y todo período anterior se informa como `ND`, no como cero.
7. Reconciliar cada total institucional contra el total de sus ofertas.
8. Mantener fuera del documento toda información personal de estudiantes.

Una ausencia de cobertura produce `ND` o un estado de validación; nunca produce
un cero inventado.

## 7. Implementación técnica

### Etapa A — corte configurable

- agregar selector de fecha de corte al generador del informe de gestión;
- conservar el selector anual existente;
- pasar el corte al hook, consultas, modelo y PDF;
- generar nombres de archivo con el corte efectivo.

### Etapa B — contrato de datos de gestión

- componer snapshots anuales desde 2024 hasta el año del corte;
- obtener la comparación YTD equivalente del año anterior;
- incorporar cuentas creadas y nuevas cuentas activas;
- incorporar convenios, contribución anual e instituciones recientes;
- devolver estados de cobertura y publicabilidad junto a cada familia de datos.

### Etapa C — modelo y narrativa

- ampliar `ExecutiveReportModel` sólo para `kind = "management"`;
- mantener intactas las secciones y datos de `kind = "annual"`;
- construir títulos, interpretaciones y notas de forma determinística;
- separar siempre cupos finitos de participantes realizados.

### Etapa D — vista web y PDF

- agregar resumen anual, crecimiento, convenios y red institucional;
- paginar tablas largas de forma explícita;
- repetir encabezados y conservar orden alfabético o cronológico estable;
- ocultar versiones técnicas del cuerpo visible;
- mantener paridad semántica entre React web y `@react-pdf/renderer`.

### Etapa E — validación

- pruebas unitarias de corte, años incluidos y comparación YTD;
- pruebas de reconciliación agregado–detalle;
- prueba de ausencia de PII;
- prueba que garantice que el informe anual no cambió;
- `npm run type-check`;
- pruebas del módulo y build de producción;
- generación de PDF, extracción de texto y render de todas sus páginas a PNG;
- revisión de cortes, encabezados, pies y legibilidad.

## 8. Fuera de alcance

- rediseñar o reescribir el Informe anual detallado;
- reemplazar el generador anual histórico;
- modificar FAQ del estudiante;
- inferir vigencia jurídica sin registro suficiente;
- crear series administrativas 2026 sin una fuente oficial;
- publicar listados nominales de estudiantes en el informe ejecutivo.

## 9. Criterios de aceptación

La implementación se considera completa cuando:

1. el usuario puede elegir cualquier corte válido hasta el día actual;
2. el informe se recalcula sin cifras manuales;
3. todos los años desde 2024 aparecen con el período correcto;
4. 2024 conserva su resultado oficial y el hito de gestión;
5. instituciones y convenios incluyen aporte anual y total acumulado;
6. la red reciente incluye orientaciones y estado documental honesto;
7. web y PDF muestran los mismos resultados;
8. el informe anual existente conserva contenido y presentación;
9. todas las cifras tienen período, fuente y definición verificables;
10. el PDF final no presenta filas cortadas, superposiciones ni texto ilegible.
