# Auditoría de articulación Moodle ↔ Mi Panel (2024–2026)

Fecha de cierre: 2026-08-11
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

La relación canónica es:

```text
práctica → lanzamiento → orientación → tarea Moodle (cmid)
```

Desde 2025 una misma tarea institucional puede ser reutilizada por varios
lanzamientos del mismo año. Para siete registros legacy que no poseen un
lanzamiento histórico confiable se usa una excepción explícita
`práctica → tarea`; nunca se inventa un lanzamiento para hacer coincidir los
datos.

## Cobertura final

La reparación dejó:

- **509 prácticas** con su lanzamiento reconstruido y auditado de forma privada.
- **2 orientaciones** corregidas desde el horario individual efectivamente asignado.
- **212 vínculos lanzamiento/orientación → tarea**, todos confirmados.
- **7 excepciones práctica → tarea**, todas confirmadas.
- **1392 de 1400 prácticas** con una tarea exacta resoluble (**99,43 %**).

| Año de entrega | Prácticas | Tarea exacta | Pendientes |   Cobertura |
| -------------- | --------: | -----------: | ---------: | ----------: |
| 2024           |       365 |          365 |          0 |    100,00 % |
| 2025           |       498 |          496 |          2 |     99,60 % |
| 2026           |       537 |          531 |          6 |     98,88 % |
| **Total**      |  **1400** |     **1392** |      **8** | **99,43 %** |

Estas cifras se refieren sólo a la articulación con tareas. **No se modificó
ninguna entrega ni ninguna nota.**

## Únicos pendientes reales

Los ocho pendientes no son ambigüedades del algoritmo: en el curso Moodle no se
encontró una tarea identificable para esas PPS.

| Institución/PPS                               |  Año | Orientación | Prácticas |
| --------------------------------------------- | ---: | ----------- | --------: |
| Asociación Civil Pensar - AYUN                | 2025 | Educacional |         1 |
| Escuela de Formación Cooperativa y Laboral N8 | 2025 | Educacional |         1 |
| Refugio Gabriel Brochero                      | 2026 | Clínica     |         6 |

La aplicación muestra estos casos como **“Espacio pendiente de vincular”** y no
abre una tarea aproximada por nombre o de otro año. Cuando coordinación cree o
identifique la tarea correcta, basta confirmarla en el articulador administrativo.

## Reparaciones relevantes

- Las PPS 2024 dejaron de caer en tareas homónimas de 2026. Por ejemplo, Colegio
  San José Obrero 2024 resuelve el `cmid 625361`.
- Aser, Camioneros e Institución Fernando Ulloa reutilizan las tareas anuales que
  el libro de calificaciones permitió corroborar.
- CPAVZO quedó separado por orientación: `908739` para Clínica y `817710` para
  Laboral/Comunitaria.
- Dos PPS del Ministerio de Trabajo tenían copiada toda la oferta dentro de
  `especialidad`; el horario asignado demostraba que eran Laborales y se corrigió
  ese dato con auditoría.
- Las PPS legacy huérfanas de Sensus, San Rafael, Ulloa-Ateneos, Alma Comahue,
  CRYBE y la práctica de prueba Randstad usan una excepción directa confirmada,
  sin alterar su lanzamiento.
- Fundación Lanna conserva la tarea `906851` indicada explícitamente por
  coordinación; el contrato descartó la homónima 2026 que había sugerido el
  catálogo.

## Comportamiento de la aplicación

El estudiante sólo recibe una tarea cuando existe uno de estos dos vínculos
confirmados:

1. una excepción directa para esa práctica; o
2. un único vínculo de su lanzamiento y orientación.

Se eliminó el fallback que elegía una tarea por similitud del nombre de la
institución. Esto evita especialmente cruces entre años. Una especialidad con
varias orientaciones sólo usa el único vínculo disponible; si hubiera más de uno,
el caso permanece pendiente hasta contar con evidencia individual.

## Trazabilidad y seguridad

- `private.moodle_practice_link_repair_audit` conserva el antes, el después y las
  fuentes usadas para cada lanzamiento reconstruido.
- `private.moodle_practice_orientation_repair_audit` conserva las dos
  correcciones de orientación y el horario asignado que las justificó.
- `practica_moodle_tareas` guarda excepciones legacy. El estudiante sólo puede
  leer la de una práctica propia; sólo administración puede escribirlas.
- Sólo vínculos con `validation_status = 'confirmed'` llegan al panel o al puente
  de notas.

## Próxima etapa: notas

El vínculo exacto permite pedir a Moodle el estado y la calificación de la tarea
correcta. La secuencia segura sigue siendo:

1. guardar observaciones Moodle append-only;
2. generar un dry-run de discrepancias contra la nota legacy de Mi Panel;
3. clasificar iguales, faltantes, diferencias y errores de acceso;
4. aprobar un lote auditado;
5. recién entonces cambiar la fuente canónica de la nota.

La sesión del navegador sólo observa al estudiante que abre su panel. Para una
conciliación histórica completa se necesita el export del libro de calificaciones
o un servicio web restringido de Moodle.

## Implementación relacionada

- Migraciones:
  - `20260811114411_repair_all_moodle_linkages_2024_2026.sql`
  - `20260811115316_repair_remaining_deterministic_practice_links.sql`
  - `20260811120500_complete_legacy_moodle_practice_links.sql`
  - `20260811121500_repair_assigned_practice_orientation.sql`
  - `20260811122500_prioritize_explicit_moodle_task_urls.sql`
  - `20260811123000_index_practica_moodle_tareas.sql`
- Contrato SQL: `supabase/tests/moodle_linkage_repair_contract.sql`
- Resolución frontend: `src/utils/moodleTaskResolution.ts`
- Guía de entregas: `src/views/student/deliveryGuide.ts`
- Articulador administrativo: `src/components/admin/InformeCampusLinker.tsx`
- Puente de navegador: [moodle-browser-bridge.md](./moodle-browser-bridge.md)

## Backfill canónico Moodle v2 · 20 de agosto de 2026

La migración `20260820101000_backfill_legacy_moodle_task_intents.sql` proyectó
los vínculos confirmados exactos al nuevo modelo sin modificar Moodle:

- 212 intenciones `legacy_shared`;
- 1.409 filas de padrón esperado/histórico;
- 0 participantes asignados a una orientación incompatible;
- 0 vínculos asignados cuando había más de una unidad candidata;
- 3 prácticas históricas contradictorias dejadas como backlog manual.

El backfill permite orientación nula únicamente cuando el lanzamiento posee una
sola unidad inequívoca. No usa semejanza de nombres ni fuerza las tres
excepciones restantes.
