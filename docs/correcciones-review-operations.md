# Cola de correcciones

Correcciones abre en Pendientes. Aprobadas, Rechazadas y Archivadas se consultan
por separado; los contadores de trabajo sólo cuentan pendientes. Cambiar de lista
no modifica datos ni oculta un pedido pendiente por antigüedad.

La revisión programada de Claude usa `scripts/pps/correcciones.py`: sus comandos
son `listar`, `revisar` y `descargar`. Es de sólo lectura. La instrucción instalada
`correcciones-pps-revision/SKILL.md` fue corregida el 12/09/2026 para eliminar un
comando `archivar` inexistente y una supuesta devolución a la cola inexistente.
El registro local de decisiones no prueba que una aprobación se haya aplicado.

El archivo administrativo requiere evidencia concreta y autorización: duplicación
de otro pedido o resultado ya registrado. Conservar el motivo en `notas_admin`
y una copia privada del antes. No borrar solicitudes, no cambiar prácticas, no
inferir archivo de la edad del pedido o del estado Finalizado del estudiante.
La aprobación y el rechazo siguen pasando exclusivamente por las RPC autorizadas.
No conceder UPDATE a authenticated para implementar mantenimiento.

La revisión del 12/09 retiró cinco pedidos redundantes (dos altas y tres cambios
de horas), dejando doce pendientes. Recuperó además ocho vínculos históricos
de solicitudes aprobadas con coincidencia única de estudiante, institución,
período, orientación, horas y modalidad. Catorce aprobadas históricas todavía
requieren investigación de su vínculo: no se les asignó una práctica por nombre.
No se alteraron horas, notas ni estados de las prácticas.

CI ejecuta las pruebas Python y el replay aislado de migraciones con contratos
y concurrencia de resoluciones antes de permitir el despliegue. El replay nunca
usa producción. Ver `docs/pps-concurrency-local.md`.
