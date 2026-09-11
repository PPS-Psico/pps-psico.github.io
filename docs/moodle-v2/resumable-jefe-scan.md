# Lectura de jefatura por páginas

## Contrato

El panel consulta `moodle_scan_queue_v2`, reclama una página con
`claim_moodle_scan_page_v2`, solicita `PPS_MOODLE_JEFE_PAGE_REQUEST` al puente
instalado en Campus y entrega la respuesta a `commit_moodle_scan_page_v2`.
Cada página contiene hasta 100 filas; la respuesta conserva el número de página.

El commit conserva la evidencia mediante el capturador autenticado existente y
avanza el cursor en la misma transacción. La atribución de notas sigue pasando
por la autoridad de evidencia existente. El cursor no almacena nombres de archivos.
Un recibo repetido con el mismo lease, request y contenido devuelve el resultado
original. Una respuesta perdida no autoriza avanzar ni descartar el lease: al
vencer, la próxima reclamación lee el cursor que efectivamente quedó confirmado.

Los leases duran 90 segundos y se limitan al curso, tarea y conjunto de áreas
autorizadas. Dos pestañas no pueden reclamar simultáneamente esa unidad. Una
página incompleta conserva las observaciones válidas y no avanza. El primer
error pausa esa tarea en servidor; la interfaz también detiene los reintentos
automáticos hasta una acción explícita. La ausencia de datos nunca borra notas.

Las identidades repetidas dentro del ciclo detienen la paginación. El reintento
manual de ese caso reinicia el cursor; los ciclos interrumpidos durante más de
dos horas también reinician. Esto detecta páginas repetidas, pero no convierte
la tabla mutable de Moodle en una fotografía transaccional del padrón.

## Recorrido cotidiano e histórico

La cola cotidiana incluye tareas del año actual y tareas anteriores con evidencia
de entregas pendientes de corrección. Estas últimas tienen prioridad. Se usa el
año real del catálogo, no el año de autorización del capturador.

Cada tanda inicia hasta cuatro páginas y deja de iniciar trabajo cuando consume
45 segundos; la página en curso termina de guardarse. Las llamadas tienen sus
propios límites de tiempo. El dashboard se invalida después de cada commit.
Si quedan tareas y no hubo error, la siguiente tanda puede comenzar después de
un minuto. El botón Pausar detiene esa continuación. Una tarea completa vuelve
a ser elegible a los 30 minutos si tiene entregas pendientes, a las dos horas
si es del año actual, o a los siete días si es histórica sin pendientes.

El botón Revisar años anteriores habilita una tanda histórica explícita. No se
drena automáticamente todo el histórico. Continuar consulta la cola vigente y
retoma su cursor. Los estados del estudiante no cambian.

## Compatibilidad y despliegue

Primero se aplica la migración `20260910112441`, luego se instala el script del
puente y finalmente se publica el panel. El protocolo anterior se conserva para
clientes abiertos. El panel nuevo exige `jefePages: true`: un puente antiguo
muestra el motivo y no vuelve al barrido completo anterior.

La migración se verificó en transacción con rollback y se registró junto con su
SQL en el ledger. `scripts/tests/moodle-scan-pages.sql` comprueba reclamación
exclusiva, avance, repetición idempotente, recuperación, límites de alcance y
rechazo anónimo. Ejecutarlo junto con la migración en una base descartable o en
la misma transacción antes del despliegue, siempre con rollback.

Las pruebas de frontend cubren límites de tanda, avance visible, fallos de
transporte, confirmación incierta, pausa, remontaje, revisión histórica y
compatibilidad del protocolo. La validación del recorrido real en Selva se
registra en el workboard una vez publicado el panel.
