# Contrato compartido entre dashboard e informes

Versión: `dashboard-report-contract-v1` · 18/07/2026.

## Decisión

El dashboard y los informes no calculan variantes propias de una misma cifra.
Comparten dos contratos, separados por su naturaleza temporal:

1. **Resultados del período (`analytics-v2`)**: ofertas, capacidad registrada,
   estudiantes que iniciaron, finalizaciones, postulaciones y postulantes.
2. **Foto operativa (`director-report-v1`)**: estudiantes sin PPS con demanda
   activa, próximos a finalizar, listos para solicitar acreditación y solicitudes
   en trámite.

No se comparan stocks actuales como si fueran resultados anuales. Cambiar el
selector de año modifica el ciclo de los resultados y el año usado para probar
demanda activa; la situación académica de cada estudiante sigue siendo la foto
actual registrada en la base.

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

El cierre oficial 2024 es 42 ofertas, 270 vacantes finitas, 117 estudiantes que
iniciaron y 32 finalizaciones. La demanda no se publica. La comparación 2025 vs.
2024 está habilitada como puente histórico revisado: el informe aclara que seis
ofertas 2024 no tenían un cupo finito numérico.

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
