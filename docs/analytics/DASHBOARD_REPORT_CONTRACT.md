# Contrato compartido entre dashboard e informes

Versión: `dashboard-report-contract-v1.1` · 30/07/2026.

## Decisión

El dashboard y los informes no deben calcular variantes propias de una misma
cifra. El contrato objetivo separa tres familias:

1. **Resultados del período (`analytics-v2`)**: ofertas, capacidad registrada,
   estudiantes que iniciaron, finalizaciones, postulaciones y postulantes.
2. **Foto operativa (`director-report-v1`)**: estudiantes sin PPS con demanda
   activa, próximos a finalizar, listos para solicitar acreditación y solicitudes
   en trámite.
3. **Poblaciones de acceso y activación (`population-contract-v2`)**: matrícula
   administrativa, cuentas creadas, nuevas cuentas activas y cohorte de primera
   actividad.

No se comparan stocks actuales como si fueran resultados anuales. Cambiar el
selector de año modifica el ciclo de los resultados y el año usado para probar
demanda activa; la situación académica de cada estudiante sigue siendo la foto
actual registrada en la base.

## Estado de cumplimiento

Este archivo define el contrato objetivo, no certifica por sí solo que todas las
pantallas ya lo cumplan.

Al 30/07/2026 permanecen pendientes:

- reemplazar o renombrar la tarjeta legacy
  `matricula_generada = cohorte = año`;
- implementar el KPI `Nuevas cuentas activas` desde
  `auth.users.created_at` + estado actual;
- hacer reconciliables `Población del ciclo` y su listado nominal;
- separar errores de consulta, cero real y dato parcial;
- evitar datos placeholder de un año etiquetados con el año recién seleccionado;
- desacoplar `analytics-v2` de la disponibilidad de la RPC legacy.

Hasta completar estos puntos, el informe profesional anual es la superficie
autoritativa para resultados del período. Las tarjetas poblacionales legacy del
dashboard no deben citarse como matrícula o activación.

## Vocabulario poblacional obligatorio

- `Matriculados administrativamente en PPS`: padrón externo de Sede Comahue.
- `Cuentas de estudiantes creadas`: flujo por `auth.users.created_at`.
- `Nuevas cuentas activas`: cuentas creadas en el año que siguen activas al
  corte.
- `Cohorte de primera actividad`: debut registrado en convocatoria o práctica.
- `Estudiantes postulados`: demanda observada en el período.
- `Estudiantes que iniciaron PPS`: inicio efectivo en el período.

La etiqueta `Ingresantes` sin calificador no se publica. El contrato completo
está en
[criterio-metricas-ingresantes.md](../criterio-metricas-ingresantes.md).

## Períodos

- Ciclo en curso: desde el 1 de enero hasta la fecha de emisión.
- Ciclo cerrado: año calendario completo, hasta el 31 de diciembre.
- Comparación del ciclo en curso: mismo día y mes del año anterior.
- Comparación de ciclos cerrados: cierre contra cierre.

La fecha de corte sale de `reportCutoff()` y se reutiliza en la serie, los
gráficos, el anexo de ofertas y los datos complementarios. No se incluyen
lanzamientos futuros en un acumulado a la fecha.

## Resultados primarios

| Etiqueta visible           | Campo canónico         | Unidad y deduplicación                                   |
| -------------------------- | ---------------------- | -------------------------------------------------------- |
| Ofertas de PPS             | `capacity.launches`    | ofertas canónicas; relanzamientos históricos no duplican |
| Capacidad registrada       | `capacity.operational` | cupos fijos + participantes de ofertas sin límite        |
| Estudiantes que iniciaron  | `flows.pps_started`    | personas distintas con inicio efectivo                   |
| Finalizaciones registradas | `flows.finalized`      | personas distintas con finalización efectiva             |
| Postulaciones              | `flows.applications`   | registros de inscripción a ofertas PPS del período       |
| Estudiantes postulados     | `flows.applicants`     | personas distintas con al menos una postulación          |

La banda principal del dashboard se construye con
`buildExecutiveReportModel()`. Por eso valor, rótulo, detalle, comparación y
leyenda son los mismos que en el informe profesional.

Las consultas complementarias sobre `convocatorias` se paginan de forma estable
por `id`. Esto evita que el límite predeterminado de 1.000 filas de PostgREST
recorte silenciosamente la demanda histórica (por ejemplo, las 1.379
postulaciones del ciclo 2025).

## Foto operativa

### Sin PPS · demanda activa

Estudiante activo, rol Alumno, sin registros en `practicas` y con al menos una
postulación a una actividad PPS durante el ciclo seleccionado. Quien no se
postuló queda fuera aunque administrativamente continúe activo.

### Próximos a finalizar

Unión deduplicada de:

- 230 a 249 horas totales;
- 250 horas o más y exactamente dos orientaciones;
- 250 horas o más, tres orientaciones y una brecha de especialidad de hasta 20
  horas.

Se excluyen solicitudes de finalización y estudiantes que ya realizaron
Relevamiento Profesional o Entrevista a Profesionales. La función privada
`get_interview_completion_candidates_v1_impl()` es la única implementación de
la cohorte. `director-report-v1` adapta esa misma tabla a JSON.

### Estados posteriores

- **Listos para solicitar**: cumplen 250 horas, 70 de especialidad y tres
  orientaciones; no tienen práctica activa ni solicitud.
- **En acreditación**: poseen una solicitud registrada en `finalizacion_pps`.

## Comparabilidad 2024

El cierre oficial 2024 es 42 ofertas, 270 vacantes finitas, 118 estudiantes que
iniciaron y 32 finalizaciones. La demanda no se publica. La comparación 2025 vs.
2024 está habilitada como puente histórico revisado: el informe aclara que seis
ofertas 2024 no tenían un cupo finito numérico.

El total de inicios se reconcilió nuevamente el 1 de agosto de 2026. Aumentó de
117 a 118 por una práctica 2024 incorporada mediante backfill el 26 de julio de
2026; no cambió la definición de `analytics-v2.flows.pps_started`.

## Cifras reconciliadas al 18/07/2026

| Indicador                  | 2026 | Base 2025 al 18/07 |
| -------------------------- | ---: | -----------------: |
| Ofertas de PPS             |   41 |                 35 |
| Capacidad registrada       |  492 |                195 |
| Estudiantes que iniciaron  |  190 |                105 |
| Finalizaciones registradas |   28 |                 17 |

Foto operativa: 234 estudiantes activos, 3 sin PPS con demanda activa, 13
próximos a finalizar (11 por horas y 2 por orientación), 3 listos para solicitar
y 8 en acreditación.

## Pruebas obligatorias

1. `npm run gen-types`
2. `npm run type-check`
3. pruebas del modelo ejecutivo y del adaptador de Dirección;
4. contratos SQL de `analytics-v2`, `director-report-v1` y candidatos de
   entrevistas;
5. `npm run build`;
6. revisión visual del dashboard y render completo de los PDF afectados.

## Contrato adicional: jefaturas de área

`get_jefe_dashboard_v1(year, cutoff)` es el contrato de lectura de Inicio,
Informes y Panorama. Resuelve alcance por DNI en
`private.jefe_area_assignments`; el cliente no envía orientaciones ni puede
ampliarlas. Selva accede a Clínica, Franco a Educacional y Cynthia a Laboral más
Comunitaria.

El payload separa cuatro bloques:

- `queue`: agregado reconciliable con el detalle de `reports`;
- `reports`: una fila por práctica, ordenada por vencimiento individual a 30
  días corridos desde la entrega;
- `panorama`: resultado anual con fecha de corte y procedencia explícita;
- `current`: foto operativa actual, sin comparación interanual.

Para 2024 `panorama.source = historical_documented` y la oferta se reconstruye
desde la capa histórica revisada. Para años posteriores la fuente es
`operational_live`. Capacidad e instituciones conservan las definiciones del
diccionario de métricas. El contrato SQL obligatorio es
`supabase/tests/jefe_area_panel_v1_contract.sql`.

La simulación administrativa consume `get_jefe_dashboard_preview_v2` y debe
permanecer en modo sólo lectura. El RPC comparte el cálculo del contrato real,
valida el rol en la base y sólo acepta claves opacas publicadas por
`list_jefe_preview_profiles_v1`; el DNI no forma parte del contrato cliente. No
habilita la escritura de calificaciones ni amplía orientaciones.
