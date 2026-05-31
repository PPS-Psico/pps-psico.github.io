# Esquema de persistencia · Gestión

> **Estado:** propuesta. Sin tocar el backend todavía. El prototipo ya emite eventos con esta forma — solo falta enchufarlos a tablas reales.

Acciones que hoy emite la app (en memoria de sesión) y que deberían persistirse:

| Acción         | Trigger                                                 | Datos clave                                                                               |
| -------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **`sent`**     | Modal de contacto: "Abrir WhatsApp" / "Enviar mail"     | canal, destinatario, asunto, cuerpo final, plantilla usada, si pasó a Esperando respuesta |
| **`state`**    | Ficha → chip "Cambiar estado" → confirmar               | estado anterior, nuevo, nota opcional                                                     |
| **`edit`**     | Ficha → "Cargar datos faltantes" / "Editar institución" | campos modificados                                                                        |
| **`reminder`** | Ficha → "Crear recordatorio"                            | tipo, fecha de vencimiento, nota, PPS asociada                                            |

## Tablas propuestas

### `gestion_log` — historial de gestión institucional

| Columna           | Tipo          | Nota                                                      |
| ----------------- | ------------- | --------------------------------------------------------- |
| `id`              | `uuid`        | PK                                                        |
| `institucion_id`  | `uuid`        | FK → `instituciones.id`                                   |
| `usuario_id`      | `uuid`        | FK → `auth.users.id`                                      |
| `accion`          | `text`        | enum: `sent` \| `state` \| `edit` \| `reminder` \| `note` |
| `canal`           | `text`        | enum: `mail` \| `whatsapp` \| `null`                      |
| `estado_anterior` | `text`        | snapshot del estado de gestión                            |
| `estado_nuevo`    | `text`        | snapshot                                                  |
| `payload`         | `jsonb`       | detalle: `{ subject?, body?, fields?, ... }`              |
| `nota`            | `text`        | nota humana opcional                                      |
| `pps_id`          | `uuid`        | FK opcional a la PPS asociada                             |
| `created_at`      | `timestamptz` | default now()                                             |

### `gestion_recordatorios` — recordatorios programados

| Columna          | Tipo          | Nota                                                                  |
| ---------------- | ------------- | --------------------------------------------------------------------- |
| `id`             | `uuid`        | PK                                                                    |
| `institucion_id` | `uuid`        | FK                                                                    |
| `usuario_id`     | `uuid`        | FK (quién lo creó)                                                    |
| `tipo`           | `text`        | enum: `contactar` \| `seguimiento` \| `vencimiento` \| `acreditacion` |
| `vencimiento`    | `date`        | cuándo avisar                                                         |
| `nota`           | `text`        | recordatorio escrito                                                  |
| `pps_id`         | `uuid`        | FK opcional                                                           |
| `estado`         | `text`        | enum: `pendiente` \| `completado` \| `descartado`                     |
| `created_at`     | `timestamptz` |                                                                       |
| `completed_at`   | `timestamptz` | null hasta que se marque hecho                                        |

### `instituciones_overrides` (opcional — si no querés tocar `instituciones`)

Para edits de la ficha sin tocar la tabla maestra de instituciones. Si confiás en `instituciones` como source of truth, esto se va y se hace UPDATE directo a la tabla con un trigger que escribe en `gestion_log`.

## Cómo se calculan las "categorías" hoy y mañana

El hook `useGestionConvocatorias` deriva categorías (`porContactar`, `esperandoRespuesta`, etc.) leyendo `lanzamientos_pps.estado_gestion` y comparándolo con fechas. Con `gestion_log` se podría además:

- Derivar `daysWaiting` desde el último evento de tipo `sent` (no desde `updated_at` global)
- Mostrar el historial de gestión real, no solo el campo `estado_gestion` actual
- Calcular métricas: "Borda tarda en promedio 5 días en responder" (Hermes)

## Para Hermes (cuando llegue el momento)

Hermes puede leer `gestion_log` agrupado por `institucion_id` y derivar:

- **Tiempos típicos de respuesta** por institución
- **Patrones de día/hora** que conviene contactar
- **Tasa de respuesta** por plantilla
- **Sugerencias contextuales** ("últimas 3 PPS con Borda terminaron sin acreditación")

Eso es alimento para la nota de Hermes en la ficha y para "Pedirle a Hermes que priorice tu día".

## Lo que NO toco hoy

- `lanzamientos_pps` — sigue siendo tabla maestra de PPS
- `instituciones` — sigue siendo tabla maestra
- `solicitudes_pps` — fuera de scope de Gestión

Solo agregamos `gestion_log` y `gestion_recordatorios` como log/programa, leídas por la app cliente.
