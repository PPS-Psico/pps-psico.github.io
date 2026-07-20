# Contrato del reporte ejecutivo profesional

## Propósito y audiencia

El reporte presenta a las autoridades de UFLO un estado de situación reproducible
de las PPS de Psicología, Sede Comahue. Tiene tres salidas:

1. **Informe anual:** ciclo elegido, con contexto del año anterior sólo cuando las
   definiciones y el corte son comparables.
2. **Informe de gestión:** serie completa desde 2024 hasta la fecha de corte. Marca
   el 1 de septiembre de 2024 como inicio de la gestión de Blas Rivera y conserva
   el 31 de agosto como línea de base temporal, sin atribuir causalidad automática.
3. **Informe para Dirección:** conserva la lectura anual y agrega una foto actual
   nominal de estudiantes y presión de convocatorias. Se rige por un contrato
   separado de circulación interna: [DIRECTOR_REPORT_CONTRACT.md](./DIRECTOR_REPORT_CONTRACT.md).

El generador anterior sigue disponible en la aplicación bajo **Reporte actual** y
el generador anual histórico permanece en **Descargas**.

## Fuente única y modelo

- RPC autoritativo: `public.get_analytics_v2(p_year, p_cutoff)`.
- Adaptador: `src/features/executive-report/executiveReport.service.ts`.
- Contrato compartido: `src/features/executive-report/executiveReport.types.ts`.
- Reglas y narrativa: `src/features/executive-report/executiveReport.model.ts`.
- Vista: `ProfessionalExecutiveReport.tsx`.
- PDF vectorial: `pdf/ExecutiveReportPdf.tsx`.

La vista y el PDF reciben el mismo `ExecutiveReportModel`. Ninguna salida vuelve a
calcular KPIs por su cuenta.

## Reglas publicables

- Un año cerrado usa corte al 31 de diciembre.
- El año en curso y su referencia usan el mismo día y mes.
- La interfaz publica **capacidad registrada**: cupos publicados en ofertas con
  límite prefijado + participantes incorporados en ofertas sin límite prefijado.
  El contrato de datos conserva el nombre técnico `operational`.
- Una variación de capacidad se publica si ambos períodos comparten `source`,
  `date_basis` y `comparable = true`, o mediante el puente histórico verificado
  2025–2024. En este último caso, el informe declara que la base numérica 2024
  son 270 vacantes finitas y mantiene aparte las seis ofertas sin cupo prefijado.
- La demanda se publica únicamente con `demand_available = true`.
- Los stocks actuales no se presentan como stocks históricos reconstruidos.
- El informe principal no publica la demora entre inscripción y timestamp de
  selección: es una medida de proceso administrativo, no de acceso estudiantil.
- El acceso se resume con el porcentaje de estudiantes cuya primera selección
  ocurrió en su primera postulación, acompañado por mediana, P75 y tamaño de
  cohorte. No se publica para 2024 por secuencia histórica incompleta.
- Calidad, método y limitaciones se incluyen sólo si se activa **Anexo técnico**;
  la opción permanece apagada por defecto.
- La base de comparación se declara una vez por página (`AAAA · al DD/MM contra
AAAA · al DD/MM`, o cierres completos). Junto a cada KPI se muestran sólo la
  variación absoluta con unidad y la variación porcentual, en tamaño legible.
- El informe anual y el de gestión no incorporan nombres, legajos, DNI ni
  identificadores de estudiantes. La variante restringida para Dirección sí
  incluye nombre y legajo, pero excluye datos de contacto y nunca se mezcla con
  las otras dos salidas.

## Contrato especial 2024

El cierre oficial es **42 ofertas**: **36 ofertas de cupo finito que totalizan 270
vacantes documentadas** y **seis ofertas sin cupo finito**. Las 270 vacantes no se
presentan como “mínimo” ni como estimación. Las seis ofertas no finitas se informan
aparte y no se fuerzan a una capacidad numérica.

El cierre 2024 está habilitado como base de comparación del informe 2025. Las
ofertas se comparan 81 contra 42. La capacidad registrada se compara 552 contra
las 270 vacantes finitas documentadas, con una aclaración visible sobre las seis
ofertas 2024 sin total numérico.

## Identidad y firma

- Autor: Blas Rivera.
- Cargo: Coordinador General.
- Unidad: Psicología · Sede Comahue.
- Correo: `blas.rivera@uflouniversidad.edu.ar`.
- Tipografías locales: Source Serif 4 para títulos y Manrope para texto/datos.
- Paleta editorial basada en el Manual de Marca UFLO: azul `#08186B`, verde
  `#299E94`, ciruela `#46153D`, tinta `#151A27`.
- El wordmark usa como acento el gradiente positivo del manual; el documento no
  replica la plantilla institucional y conserva una identidad editorial propia.
- Las orientaciones reutilizan el sistema cromático de Mi Panel: Clínica
  `#3CB88D`, Educacional `#203B73`, Laboral `#C23B3F` y Comunitaria `#7A3F9E`.

Las fuentes se empaquetan mediante `@fontsource`; el PDF no depende de una conexión
externa al momento de generarse.

## Operación y verificación

1. Abrir **Métricas → Reporte ejecutivo → Nuevo profesional**.
2. Elegir el año en el selector general.
3. Alternar entre **Por año**, **Mi gestión** y **Para Dirección**.
4. Activar **Anexo técnico** sólo si la autoridad lo solicita.
5. Verificar que cada página comparativa indique una sola base temporal y que cada
   variación conserve unidad y porcentaje.
6. Descargar el PDF y revisar que el nombre sea:
   - `informe-pps-sede-comahue-AAAA.pdf`, o
   - `informe-gestion-pps-sede-comahue-2024-AAAA.pdf`, o
   - `informe-direccion-pps-agostina-reale-berrueta-AAAA.pdf`.
7. Ante diferencias, ejecutar el RPC con el mismo `p_year` y `p_cutoff`; no corregir
   texto o cifras directamente en la plantilla.

## Pruebas mínimas ante cambios

```bash
npm run type-check
npm test -- --runInBand src/features/executive-report/__tests__/executiveReport.model.test.ts
npm run build
```

Además se debe renderizar un PDF de muestra, convertir todas sus páginas a PNG,
inspeccionarlas y extraer el texto para comprobar que no falten cifras ni se haya
introducido información personal.

Si cambia la semántica de una métrica, corresponde una nueva versión analítica y
la actualización conjunta del diccionario; no se parchea silenciosamente el
reporte.

## Última reconciliación productiva

Validación actualizada el 18 de julio de 2026 contra `get_analytics_v2`:

| Corte      | Ofertas | Capacidad | Inicios | Finalizaciones | Postulaciones |
| ---------- | ------: | --------: | ------: | -------------: | ------------: |
| 31/08/2024 |      33 |       199 |     104 |             11 | No disponible |
| 31/12/2024 |      42 |       270 |     117 |             32 | No disponible |
| 18/07/2025 |      35 |       195 |     105 |             17 |           661 |
| 31/12/2025 |      81 |       552 |     197 |             56 |         1.379 |
| 18/07/2026 |      41 |       492 |     190 |             28 |           779 |

Para 2024, “capacidad” en la tabla significa las 270 vacantes de las 36 ofertas
finitas; las seis ofertas no finitas permanecen informadas por separado.

Reconciliación del recorrido de acceso al 18 de julio de 2026: cohorte de 87
estudiantes con primera selección en el ciclo; 61 accedieron en la primera
postulación (**70,1%**), mediana de **1** postulación y P75 de **2**. El cálculo
fue contrastado con una consulta SQL independiente sobre la secuencia completa
de `convocatorias` y la fecha de inicio de `lanzamientos_pps`.

La consulta del cliente pagina explícitamente `convocatorias` en bloques de mil
filas y aplica orden estable por `created_at, id`. Esto evita que el límite de la
API recorte la secuencia: al 18/07/2026 existen 2.270 postulaciones históricas.

## Decisión editorial del 18 de julio de 2026

- Se retiró el bloque redundante “Criterio de lectura”.
- Se retiraron calidad y metodología del cuerpo destinado a autoridades.
- Los convenios muestran orientación, cantidad de ofertas y lugares registrados.
- La capacidad realizada identifica a Fundación Tiempo e Institución Fernando
  Ulloa y consigna que ambos convenios fueron gestionados por esta Coordinación.
- Un indicador sin base publicable se omite del cuerpo principal; no se completa
  el espacio con una tarjeta “No disponible”.
- El anexo de ofertas se agrupa por mes; el modo mayoritario no repite “cupo
  finito”. Sólo las ofertas sin límite explican que el total corresponde a
  participantes registrados.
- La tabla plana fue reemplazada por capítulos mensuales y filas editoriales para
  facilitar búsqueda y lectura sin perder precisión.
