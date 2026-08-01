# Poblaciones de ingreso, activación y actividad PPS

Estado: **vigente**

Versión: `population-contract-v2`

Fecha de decisión: 30/07/2026
Ámbito: Licenciatura en Psicología · Sede Comahue

Este documento reemplaza la versión del 31/05/2026 que presentaba
`estudiantes.cohorte` como criterio de “ingresantes”. Aquella implementación
resolvió un problema técnico de migración, pero no representa la definición de
gestión acordada posteriormente.

La palabra **ingresantes** queda desaconsejada en métricas y reportes porque
puede significar matrícula administrativa, creación de cuenta, primera
postulación o primera PPS. Cada superficie debe usar una etiqueta específica.

## Embudo poblacional canónico

```text
Matriculado administrativamente en PPS
  → cuenta creada en Mi Panel
  → estudiante activo en Mi Panel
  → estudiante postulado
  → estudiante que inició una PPS
```

Las etapas no son intercambiables. Una persona matriculada puede no crear una
cuenta porque todavía no desea hacer PPS; una persona con cuenta puede no
postularse; una persona postulada puede no haber iniciado una práctica.

## 1. Matrícula administrativa PPS

- **Qué mide:** estudiantes de Sede Comahue inscriptos administrativamente en la
  materia PPS al inicio del año.
- **Qué habilita:** acceso potencial al campus Moodle de la materia.
- **Fuente:** registro administrativo provisto por la Facultad; no se deriva de
  Supabase ni de Mi Panel.
- **Tipo:** flujo administrativo anual.
- **No implica:** creación de cuenta, búsqueda activa de una práctica,
  postulación ni inicio efectivo.
- **Etiqueta permitida:** `Matriculados administrativamente en PPS`.
- **Etiqueta prohibida sin calificador:** `estudiantes activos`.

Serie administrativa disponible:

| Ciclo  | Matriculados |
| ------ | -----------: |
| 2022/1 |           39 |
| 2023/1 |           87 |
| 2024/1 |          101 |
| 2025/1 |          242 |

No existe todavía un valor oficial documentado para 2026/1.

Estos totales no permiten calcular una tasa de activación de Mi Panel. Para ello
se necesita el padrón nominal anual, vinculado por legajo con las cuentas.

## 2. Cuentas de estudiantes creadas en Mi Panel

- **Qué mide:** estudiantes distintos con una cuenta vinculada cuya fecha de
  creación cae dentro del año.
- **Fuente temporal:** `auth.users.created_at`, interpretado en
  `America/Argentina/Buenos_Aires`.
- **Vínculo obligatorio:** `estudiantes.user_id = auth.users.id`.
- **Población:** cuentas vinculadas a estudiantes; se excluyen usuarios de
  personal y cuentas sin perfil de estudiante.
- **Tipo:** flujo de activación digital.
- **Etiqueta permitida:** `Cuentas de estudiantes creadas`.
- **No usar como fuente:** `estudiantes.created_at`, porque fue afectado por
  importaciones y migraciones históricas.
- **No usar como sustituto:** `estudiantes.cohorte`.

El conteo debe conservar la fecha de corte y una consulta reproducible. Una
cuenta creada en un año permanece en el flujo de ese año aunque posteriormente
el estudiante finalice.

## 3. Nuevas cuentas actualmente activas

- **Qué mide:** cuentas de estudiantes creadas durante el año cuyos perfiles se
  encuentran actualmente en `estado = 'Activo'`.
- **Numerador:** subconjunto de “Cuentas de estudiantes creadas en Mi Panel”.
- **Fuente:** `auth.users.created_at` + estado actual de `estudiantes`.
- **Tipo:** cohorte de activación con estado actual; no es un flujo histórico
  inmutable.
- **Fecha obligatoria:** siempre debe publicarse `al DD/MM/AAAA`.
- **Etiqueta recomendada:** `Nuevas cuentas activas`.

Este es el indicador operativo elegido por la Coordinación para describir a los
estudiantes que ingresaron efectivamente a Mi Panel durante el año y todavía
continúan activos.

El total puede disminuir cuando un estudiante finaliza o cambia de estado. Por
eso debe mostrarse junto con el total fijo de cuentas creadas:

```text
Nuevas cuentas activas al corte
de un total de cuentas creadas durante el año
```

## 4. Cohorte de primera actividad PPS

- **Qué mide:** año de la primera actividad PPS registrada para el estudiante.
- **Campo:** `estudiantes.cohorte`.
- **Cálculo histórico:** mínimo año válido entre actividad de convocatoria y
  práctica.
- **Tipo:** debut registrado en el circuito PPS.
- **Etiqueta permitida:** `Debut en el circuito PPS` o
  `Cohorte de primera actividad`.
- **Etiqueta prohibida:** `Matrícula`, `Cuenta creada`, `Nueva cuenta activa` o
  `Primera PPS iniciada`.

La primera actividad puede ser una postulación. Por lo tanto, `cohorte` tampoco
prueba que una práctica haya comenzado.

El campo sigue siendo útil para segmentación histórica, pero deja de ser la
fuente del KPI de activación de Mi Panel.

## 5. Estudiantes postulados

- **Qué mide:** personas distintas con al menos una postulación a una oferta de
  tipo `pps` dentro del período.
- **Fuente:** `analytics-v2.flows.applicants`.
- **Tipo:** flujo de demanda observada.
- **Fecha anual:** la definida por el contrato `analytics-v2`.
- **Etiqueta:** `Estudiantes postulados`.

No es una medida de matrícula ni de cuentas activas. Representa evidencia de
que el estudiante está buscando una PPS durante el período.

## 6. Estudiantes que iniciaron PPS

- **Qué mide:** personas distintas con al menos una práctica `pps` cuya
  `fecha_inicio` cae dentro del período.
- **Fuente:** `analytics-v2.flows.pps_started`.
- **Tipo:** flujo de inicio efectivo.
- **Etiqueta:** `Estudiantes que iniciaron PPS`.

Esta es la medida apropiada para describir participación anual efectiva. No debe
llamarse matrícula ni activación.

## Reglas de comparación

1. Matrícula administrativa se compara contra matrícula administrativa.
2. Cuentas creadas se comparan contra cuentas creadas con cobertura temporal
   equivalente.
3. Nuevas cuentas activas se comparan sólo con el mismo criterio de estado y la
   misma fecha de corte.
4. Postulantes e inicios se comparan como flujos YTD contra el mismo día y mes
   del año anterior.
5. No se divide “estudiantes que iniciaron” por matrícula administrativa como
   tasa de conversión: puede haber arrastre de estudiantes matriculados en años
   anteriores.
6. No se calcula una tasa de activación con totales agregados. Se necesita
   vinculación nominal por legajo entre el padrón administrativo y Mi Panel.

## Limitación de 2025

La creación de cuentas de 2025 se concentra en la incorporación inicial de Mi
Panel entre fines de noviembre y diciembre. No representa un año completo de
activación natural y no es comparable directamente con el flujo continuo de
2026 sin una aclaración visible.

Los perfiles migrados o importados tampoco deben clasificarse usando
`estudiantes.created_at`.

## Estado de implementación

Este documento es la definición de negocio vigente, pero el dashboard aún
conserva una tarjeta legacy:

```text
matricula_generada = estudiantes con cohorte = año
```

Mientras esa implementación no se reemplace:

- debe etiquetarse como `Cohorte de primera actividad`, no como
  `Ingresantes nuevos`;
- no puede interpretarse como matrícula ni como creación de cuenta;
- no debe usarse en el informe ejecutivo como indicador de activación.

La implementación objetivo requiere un RPC de staff que publique por año:

- `student_accounts_created`;
- `student_accounts_created_currently_active`;
- `as_of`;
- cobertura de vínculo cuenta–estudiante.

## Pruebas contractuales mínimas

1. Ninguna tarjeta llamada `Nuevas cuentas activas` puede leer `cohorte`.
2. Ninguna consulta de creación de cuenta puede leer `estudiantes.created_at`.
3. El total agregado debe reconciliar con el listado nominal deduplicado.
4. La respuesta debe excluir cuentas no vinculadas a estudiantes.
5. El stock activo debe declarar fecha de corte.
6. Los informes y el dashboard deben consumir el mismo contrato versionado.
