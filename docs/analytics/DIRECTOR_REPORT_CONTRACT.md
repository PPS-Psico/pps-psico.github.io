# Contrato del informe para Dirección de Carrera

## Propósito y circulación

El informe está preparado para **Agostina Reale Berrueta, Directora de la
Carrera**, y combina dos planos que deben leerse por separado:

1. los resultados generales del ciclo seleccionado, construidos con
   `analytics-v2` y su corte anual correspondiente;
2. una foto operativa actual de estudiantes y convocatorias, construida con
   `director-report-v1` al día de generación.

La salida se clasifica como **circulación interna** porque incluye nombres y
legajos. No debe adjuntarse al informe ejecutivo general ni circular fuera de las
autoridades y equipos autorizados. El payload excluye DNI, correo, teléfono y
domicilio.

## Fuente y seguridad

- RPC público: `public.get_director_report_v1(p_year, p_snapshot_date)`.
- Implementación privilegiada: `private.get_director_report_v1_impl(...)`.
- Autorización: ambas funciones validan `public.is_staff()`.
- Ejecución: revocada para `public` y `anon`; concedida a `authenticated`.
- Adaptador: `directorReport.service.ts`.
- Vista: `DirectorReport.tsx`.
- PDF vectorial: `pdf/DirectorReportPdf.tsx`.

La función pública es `SECURITY INVOKER`; la lectura privilegiada vive en el
esquema privado, usa `search_path = ''` y nombres totalmente calificados.

## Población de seguimiento

La foto incluye estudiantes con:

- `estado = 'Activo'`;
- `role = 'Alumno'`.

“Sin PPS · demanda activa” significa que el estudiante no posee ningún registro
en `practicas` y realizó al menos una postulación a una oferta de tipo `pps`
durante el año informado. Para el ciclo en curso se cuentan postulaciones desde
el 1 de enero hasta la fecha de corte; para un ciclo cerrado se toma el año
completo. Quienes no se postularon durante ese período quedan fuera porque no
hay evidencia actual de que estén buscando una PPS.

El listado agrega sólo legajo, cohorte, orientación elegida y cantidad de
postulaciones del ciclo; no incorpora datos de contacto.

## Criterio “próximo a finalizar”

El listado es la unión deduplicada de tres reglas mutuamente excluyentes:

1. **Tramo final de horas:** entre 230 y 249 horas totales.
2. **Rotación faltante:** 250 horas o más y exactamente dos orientaciones
   distintas acreditadas.
3. **Brecha de especialidad:** 250 horas o más, tres orientaciones o más y entre
   50 y 69 horas de la orientación elegida.

Quienes ya poseen una solicitud en `finalizacion_pps` se muestran en “En
acreditación” y no se duplican en “Próximos a finalizar”. La prioridad de
clasificación es: horas totales, rotación faltante y brecha de especialidad.

Además, se excluye a quien ya posea una práctica de Relevamiento Profesional o
Entrevista a Profesionales. Esta exclusión convierte el indicador en una cohorte
accionable: son estudiantes a quienes todavía se les puede ofrecer esa PPS de 20
horas. El dashboard, el informe web y ambos PDF consumen exactamente esta misma
lista; no existe una variante “general” publicada con otro total.

Los objetivos vigentes se leen de `app_config` —250 horas totales, 70 de
especialidad y tres orientaciones—. Los umbrales de cercanía se calculan como 20
horas menos que cada objetivo.

## Otros estados accionables

- **En condiciones de solicitar:** cumple 250/70/3, no tiene prácticas activas y
  no registra solicitud de finalización.
- **En acreditación:** posee al menos una fila en `finalizacion_pps`.
- **Criterios completos con PPS activa:** cumple 250/70/3, pero conserva una
  práctica en estado `En curso`, `Pendiente` o `En proceso`.

## Presión de convocatorias

La presión se calcula sólo sobre ofertas:

- abiertas;
- de tipo `pps`;
- con modalidad de cupo `fijo`.

Para cada oferta:

```text
lugares disponibles = max(cupo publicado − seleccionados, 0)
presión = postulaciones pendientes / lugares disponibles
```

Niveles:

- **Baja:** menos de 1 postulación pendiente por lugar.
- **Media:** desde 1 y menos de 2.
- **Alta:** 2 o más.
- **Saturada:** no quedan lugares y existen postulaciones pendientes.

El indicador mide tensión operativa. No estima la probabilidad individual de ser
seleccionado ni reemplaza la revisión de requisitos y horarios.

## Foto productiva validada al 18/07/2026

| Indicador                                      | Valor |
| ---------------------------------------------- | ----: |
| Estudiantes activos                            |   234 |
| Sin PPS · demanda activa                       |     3 |
| Próximos a finalizar                           |    13 |
| └ Entre 230 y 249 horas                        |    11 |
| └ Falta una orientación                        |     2 |
| └ Faltan hasta 20 horas de especialidad        |     0 |
| En condiciones de solicitar                    |     3 |
| En acreditación                                |     8 |
| Criterios completos con alguna práctica activa |    32 |

La presión actual corresponde a 23 postulaciones pendientes, 11 lugares
disponibles y una relación agregada de **2,09 postulaciones por lugar**. Dos de
las tres ofertas abiertas presentan presión alta o saturación.

Los tres estudiantes sin PPS incluidos registran cinco postulaciones durante 2026. Otros 14 estudiantes activos sin prácticas cargadas no se muestran porque
no poseen postulaciones en el ciclo.

La clasificación previa encontraba 17 casos cercanos a finalizar. Cuatro ya
habían realizado Relevamiento o Entrevista a Profesionales y se excluyen del
indicador operativo; por eso el total publicable y nominal es 13.

## Operación

1. Abrir **Métricas → Reporte ejecutivo → Nuevo profesional**.
2. Elegir el ciclo general.
3. Seleccionar **Para Dirección**.
4. Verificar la fecha de la foto operativa en la portada.
5. Descargar
   `informe-direccion-pps-agostina-reale-berrueta-AAAA.pdf`.
6. Mantener el archivo en un canal de circulación interna.

## Verificación mínima

```bash
npm run gen-types
npm run type-check
npm test -- --runInBand src/features/executive-report/__tests__/directorReport.service.test.ts
npm run build
node scripts/analytics/render-professional-report-fixture.mjs --director
```

Además deben inspeccionarse todas las páginas renderizadas y ejecutarse el
contrato SQL `supabase/tests/director_report_v1_contract.sql` con una sesión de
staff.
