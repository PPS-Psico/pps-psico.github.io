# Prueba local de concurrencia de solicitudes PPS

## Estado vigente tras bad3f06

Corrida `f90ad170`, con la migración `20260911233659`: **siete escenarios OK,
cero fallos y cero no concluyentes**, además de los siete contratos SQL portables.
El replay registra ahora 276 migraciones y 20 overlays. El caso antes observado
ya prueba el contrato de horas vistas: cambio concurrente devuelve `45001`,
mantiene pendiente la segunda solicitud y permite confirmar con el valor fresco.

Se corrigió una precondición del séptimo test: el escenario anterior dejaba 100 h
y A volvía a aprobar 100. Ahora A elige una cantidad distinta del valor actual,
de modo que realmente cambie el testigo. Se añadió la confirmación posterior.
El log vigente está en `artifacts/pps-concurrency/local-run.log`.

La RPC conserva compatibilidad: omitir `p_horas_vistas` desactiva esa comprobación.
Por eso el resultado no certifica protección de clientes viejos o llamadas que
no envíen el parámetro. Verificar el flujo de actualización del panel en navegador
y definir el retiro de esa excepción tras migrar consumidores. El testigo detecta
diferencias en horas actuales; no es un historial ni una versión de toda la práctica.

Los resultados y pendientes relativos al séptimo escenario que figuran más abajo
se conservan como historial y quedan reemplazados por esta actualización.

## Ejecución

Desde la raíz del repositorio:

```bash
node scripts/replay-migrations.mjs --concurrency
```

Para incluir también los contratos SQL portables existentes:

```bash
node scripts/replay-migrations.mjs --concurrency --contracts
```

Requiere Docker activo y Python con pip en el equipo. `PYTHON` permite elegir
el ejecutable. El runner descarga a un directorio temporal las dependencias
Python fijadas (psycopg binary 3.3.4 y typing_extensions 4.15.0), las copia al
contenedor y las elimina al terminar. No instala paquetes en el Python global.

La base usa `public.ecr.aws/supabase/postgres:17.6.1.063`, Python 3.12 del
contenedor y conexiones por socket Unix. No solicita credenciales de producción,
no lee el `.env`, no publica puertos y usa `--network none`. Los cron quedan
desactivados. No se levantan Edge Functions ni workers de correo o Moodle.
El contenedor completo se elimina al terminar, incluso ante errores controlados.
Si se mata el proceso abruptamente, revisar el contenedor identificado en el log;
no confundirlo con otros contenedores de desarrollo.

## Alcance y resultados

Ejecución local del 11/09/2026, corrida `d80a7afd`, después de preparar la
migración `20260911230337_qualify_withdrawal_practice_delete.sql`:

Actualización: esa migración provisional fue retirada del árbol local porque
otra sesión aplicó la corrección equivalente `20260911232920_baja_pps_estado_ambiguo.sql`
(commit `66be23c`). Se confirmó la versión registrada y el DELETE calificado
en producción mediante lectura. Las primeras corridas de este documento son
evidencia histórica del arreglo provisional; el replay actual usa la versión canónica.
Se repitió el replay con esa versión (corrida `7e7d754b`): seis escenarios OK,
uno observado, cero fallos y cero no concluyentes; siete contratos SQL OK.

Repetición final `a6f04057` con `--contracts`: mismos resultados de concurrencia,
los siete contratos SQL portables aprobados y código de salida 0. Log conservado
en `artifacts/pps-concurrency/local-run.log`. También pasaron type-check,
check:migrations y los 10 tests Python existentes.

| Escenario                                          | Resultado                                            |
| -------------------------------------------------- | ---------------------------------------------------- |
| Dos aprobaciones idénticas de una solicitud nueva  | OK; misma práctica, sin duplicados                   |
| Aprobaciones con cantidades distintas              | OK; segunda decisión en conflicto                    |
| Aprobación contra rechazo                          | OK; una decisión y una práctica                      |
| Dos rechazos                                       | OK; conserva el primer motivo                        |
| Dos decisiones sobre una misma solicitud de horas  | OK; conserva la primera cantidad                     |
| Dos aprobaciones de una baja                       | OK; elimina su práctica y crea una sola penalización |
| Dos solicitudes distintas sobre una misma práctica | OBSERVADO; ambas se aplican y termina en 120 horas   |

En todos se comprobó la espera de B por A mediante `pg_blocking_pids`, con las
RPC ejecutadas como `authenticated` y un administrador sintético. No se dedujo
competencia por un retraso de red. El último escenario no certifica un contrato
de versiones: sigue pendiente decidir si la segunda solicitud debe detectar
que la práctica cambió desde su presentación.

El caso de baja ensaya una práctica sin `convocatoria_id`; no certifica todos
los efectos de la rama que delega en `dar_baja_pps_con_penalizacion` con inscripción.
Los resultados tampoco prueban el formulario en navegador ni el despliegue.

## Fallo encontrado y corrección preparada

Antes de la corrección, la aprobación de baja falló con SQLSTATE `42702`:
`column reference "estado" is ambiguous`. El DELETE de prácticas tenía una
columna sin calificar que colisionaba con el parámetro de salida de la RPC.
La misma definición se confirmó mediante lectura de producción.

La nueva migración agrega un alias a ese DELETE conservando el resto de la
definición, sus permisos y su firma. Fue ejecutada sólo en la base descartable.
La corrección equivalente `20260911232920` ya fue aplicada por otra sesión y
verificada mediante lectura. No volver a aplicar el parche provisional eliminado.
No cambia la interfaz TypeScript de la RPC.

También se corrigió el arnés: la baja tenía una práctica Finalizada, que no
cumplía su precondición. Ahora usa una práctica propia En curso y no destruye
la que necesitan los otros escenarios. Verifica su eliminación y el conflicto
de la segunda baja; un fallo inicial ya no se informa como falta de competencia
en ese caso. El escenario observado exige que ambas llamadas hayan funcionado
y que el bloqueo esté demostrado. La limpieza incluye fallos de preparación.

## Reconstrucción del esquema: límites explícitos

El replay registra 275 versiones canónicas y 20 overlays locales; esto no
significa que todas las reparaciones de datos históricos hayan sido ejecutadas.
Se conserva el bootstrap y la compatibilidad de plataforma del proyecto.
La verificación corresponde al esquema reconstruido, no a una copia completa
ni a una comparación exhaustiva con la base de producción.

Para que el replay vacío llegue al final se incorporaron estas adaptaciones
locales, sin editar los archivos de las migraciones históricas:

- Se omiten la fusión institucional `20260819152557`, el vínculo individual
  `20260831205748` y ocho correcciones de notas que exigen registros reales:
  `20260821210000`, `20260821240000`, `20260824200000`, `20260824230000`,
  `20260824240000`, `20260824250000`, `20260825150000`, `20260825160000`.
  Son operaciones sobre datos, no creación de funciones o tablas.
- Se adaptan los dos textos buscados por `20260821020000`: la migración anterior
  ya cambió `visible` a `stealth`. Se conserva el resultado final del parche.
- Se completa el punto y coma del cierre de función exportado en
  `20260825122000`, `20260825130000`, `20260825140000`, `20260902120000`,
  `20260902230000` y `20260902233000`.
- Se mantienen las excepciones de replay que ya existían para las reparaciones
  históricas de julio. Todas están localizadas en `replaySql`.

Las migraciones se ejecutan en lotes de 20, manteniendo su orden, sus límites
transaccionales y `ON_ERROR_STOP`. Ante un fallo, el log identifica el último
archivo. Agruparlas evita abrir dos procesos de Docker por cada migración.

## Pendientes posteriores

1. Mantener sólo la migración canónica `20260911232920`; la colisión con el
   parche local quedó resuelta. Conservar las pruebas de regresión.
2. Definir el contrato de dos solicitudes distintas sobre una práctica y, si
   corresponde, implementar detección de versión obsoleta.
3. Conectar esta ejecución a CI e incorporar los demás escenarios del plan
   progresivamente, incluidos los caminos con inscripción vinculada.
4. Completar la prueba en navegador, despliegue del frontend y transición de
   la columna de institución: son entregas independientes de este resultado.
