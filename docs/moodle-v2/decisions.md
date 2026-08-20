# Decisiones vigentes · Moodle Task Automation v2

Fecha: 20 de agosto de 2026
Estado: decisiones aprobadas; despliegue operativo parcial

## ADR-01 · Unidad de entrega

La unidad atómica es `(lanzamiento_id, orientacion_key)`. Un lanzamiento
multi-área produce una unidad independiente por orientación y cada jefatura
accede sólo a la suya.

## ADR-02 · Convivencia 2026 y corte 2027

- Antes de 2027: `legacy_shared`, sólo con vínculo confirmado exacto.
- Desde 2027: `dedicated`, una tarea exclusiva por unidad activa/archivada.
- No se dividen, renombran, reconfiguran ni adoptan por nombre tareas históricas.
- El mismo `cmid` legacy se consulta una vez y se distribuye por el padrón
  esperado; una tarea `dedicated` no se comparte.

## ADR-03 · Fechas y SLA

Zona de negocio `America/Argentina/Buenos_Aires`, datos persistidos como
`timestamptz`:

- apertura deseada: 7 días corridos antes del fin de la PPS;
- vencimiento deseado: fin + 30 días a las 23:59:59;
- cutoff: `NULL`, para admitir entregas tardías;
- SLA de corrección: 30 días corridos desde `submitted_at` real.

## ADR-04 · Nota insuficiente y reentrega

Una nota insuficiente deriva `revision_required`; no cierra el monitoreo ni se
convierte automáticamente en desaprobación definitiva. `failed_final` requiere
resolución institucional explícita. La reapertura automática de Moodle sigue
siendo un requisito del worker futuro: hoy no debe presentarse como capacidad
productiva.

## ADR-05 · Padrón esperado

Esperados, faltantes y completitud se calculan desde
`moodle_task_expected_participants`, no desde el total bruto de usuarios de
Moodle. Bajas, reemplazos y excepciones conservan historia y motivo.

## ADR-06 · Frontera de permisos

Leer entregas como estudiante, jefe o admin en simulación no autoriza a crear o
modificar actividades. Sólo `SuperUser`, `AdminTester` o `service_role` pueden
reconciliar, reclamar leases, confirmar tareas o cambiar excepciones. Las RPC
públicas son invoker y la elevación controlada está aislada en `private`.

## ADR-07 · Sincronización anual de jefatura

La selección sigue siendo “todas las tareas confirmadas del año y la
orientación”, no una ventana arbitraria de dos meses: las tareas reutilizadas
hacen inseguro inferir alcance por fecha. El navegador recibe lotes secuenciales
de 4. Si uno falla, se conservan los lotes válidos y la corrida queda `partial`.

## ADR-08 · Confirmación dedicada fail-closed

El agente debe usar la `stable_key` como `ID number`, poseer el lease vigente y
devolver todas las opciones materiales. Cualquier clave o hash distinto deja la
intención en `needs_attention`; no se enlaza una tarea parecida por nombre.
