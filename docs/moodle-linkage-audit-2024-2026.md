# Auditoría de articulación Moodle ↔ Mi Panel (2024–2026)

Fecha del relevamiento: 2026-08-10  
Curso Moodle: `3615` — 2026 Práctica Profesional Supervisada

## Resultado ejecutivo

Se inventariaron directamente desde Moodle **108 tareas**:

| Pestaña Moodle | Clínica | Laboral/Comunitaria | Educacional |   Total |
| -------------- | ------: | ------------------: | ----------: | ------: |
| 2024           |      14 |                   6 |           6 |      26 |
| 2025           |      21 |                  20 |          13 |      54 |
| 2026           |       9 |                  13 |           6 |      28 |
| **Total**      |  **44** |              **39** |      **25** | **108** |

El catálogo reproducible está en [moodle-task-catalog-2024-2026.json](./moodle-task-catalog-2024-2026.json).

La regla observada desde 2025 es: una tarea puede ser reutilizada por varios lanzamientos de la misma institución durante el mismo año. La institución por sí sola no alcanza como clave porque una misma institución puede tener tareas distintas por orientación. La relación canónica queda definida como:

```
año de entrega + institución normalizada + orientación → Moodle course-module id (cmid)
```

El año se toma de `fecha_finalizacion`; sólo si falta se usa `fecha_inicio`. Una vez confirmado el vínculo, la aplicación no vuelve a inferirlo por nombre: usa la relación persistida.

## Cobertura obtenida

Se generaron **100 relaciones** lanzamiento-orientación ↔ tarea:

- 99 confirmadas: vínculo existente validado, coincidencia unívoca o alias institucional inequívoco.
- 1 en revisión: Fundación Kano, orientación Clínica, apunta a la tarea 2025 `914852` aunque la PPS finaliza en 2026.

Sobre las prácticas asociadas a lanzamientos cuyo año de entrega es 2025 o 2026:

| Año de entrega | Prácticas | Con relación confirmada | Pendientes |
| -------------- | --------: | ----------------------: | ---------: |
| 2025           |        35 |                      32 |          3 |
| 2026           |       522 |                     417 |        105 |
| **Total**      |   **557** |                 **449** |    **108** |

Estas cifras se refieren sólo a la articulación con tareas. **No se modificó ninguna nota.**

## Pendientes que no deben inferirse

No aparece una tarea 2026 visible para:

| Institución/PPS                      | Orientación | Prácticas afectadas |
| ------------------------------------ | ----------- | ------------------: |
| Institución Fernando Ulloa - Ateneos | Clínica     |                  63 |
| Asociación Civil Programa Aser       | Clínica     |                  18 |
| Centro Evaluador Camioneros          | Laboral     |                  14 |
| Refugio Gabriel Brochero             | Clínica     |                   6 |

Además:

- 4 prácticas de Fundación Kano son Clínicas y hoy conservan un vínculo a la tarea 2025; quedan en revisión.
- 1 práctica del Banco Provincia del Neuquén finaliza en 2025 y no tiene una tarea inequívoca en la pestaña 2025.
- 2 prácticas de la III Jornada 2025 tienen especialidad Clínica/Laboral aunque el lanzamiento y la tarea están vinculados como Comunitaria; quedan como inconsistencia de datos y no se fuerzan a otra orientación.
- 2024 se catalogó, pero no se enlazó automáticamente: la organización histórica usa tareas genéricas y convenciones diferentes.

## Aliases confirmados

Se documentaron tres equivalencias que el nombre literal no resuelve:

| Lanzamiento                                               | Tarea Moodle                 |    cmid |
| --------------------------------------------------------- | ---------------------------- | ------: |
| III Jornada Universitaria de Salud Mental (2025)          | III Jornadas de Salud Mental |  919158 |
| Colonia de Verano - Consumos problemáticos (entrega 2026) | Prevención en Colonias       | 1009867 |
| Asociación Civil Pensar - Barriletes (2026)               | Barriletes en Bandada        | 1111226 |

## Modelo implementado

`aula_entregas` pasa a funcionar como catálogo de tareas y suma:

- `course_id`
- `academic_year`
- `moodle_name`
- `source_synced_at`
- unicidad por `course_id + moodle_id`

La tabla nueva `lanzamiento_moodle_tareas` representa la relación explícita. Admite varias orientaciones por lanzamiento y varios lanzamientos apuntando a la misma tarea anual. `lanzamientos_pps.codigo_tarjeta_campus` se conserva como compatibilidad legacy; no debe seguir creciendo como JSON cuando la nueva relación esté consumida por toda la aplicación.

Estados de validación:

- `confirmed`: puede usarse para pedir estado/nota a Moodle.
- `review`: visible para coordinación, pero no debe actualizar una nota.
- `rejected`: candidato descartado con trazabilidad.

## Próxima etapa: notas

El orden seguro es:

1. Resolver la tarea exacta desde `practica.lanzamiento_id` y `practica.especialidad`.
2. Leer Moodle y guardar una observación append-only con valor bruto, máximo, fecha de corrección, cmid y versión del puente.
3. Construir el dry-run de discrepancias contra `practicas.nota`.
4. Clasificar: iguales, panel vacío, Moodle sin nota, diferencia, tarea sin vínculo, error de acceso.
5. Aprobar un lote.
6. Recién entonces actualizar el valor canónico, guardando antes/después y quién aprobó.

La extracción mediante sesión del navegador sólo cubre al usuario que abre su panel en Moodle. Para una conciliación histórica completa sin esperar a cada estudiante se necesita exportar el libro de calificaciones de Moodle o habilitar un servicio web restringido.

## Fuentes y archivos relacionados

- [Requisitos generales de integración](./moodle-integration-requirements.md)
- [Contrato técnico del puente de navegador](./moodle-browser-bridge.md)
- [Catálogo exacto de tareas](./moodle-task-catalog-2024-2026.json)
- [InformeCampusLinker.tsx](../src/components/admin/InformeCampusLinker.tsx)
