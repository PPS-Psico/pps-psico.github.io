# Manual operativo de PPS — UFLO Psicología

> Memoria institucional de Hermes. Cada archivo está estructurado para ser leído
> en el system prompt como contexto. Cuando hagas cambios significativos,
> actualizá el archivo correspondiente.
>
> **Hermes lee todo el directorio `tuyas/` al arrancar.** Cuanto más fino esté
> esto, más útil es Hermes.
>
> Última edición: 2026-05-27 (bootstrap inicial)

## Estructura

- **[01-funcionamiento-pps.md](01-funcionamiento-pps.md)** — Qué son las PPS, marco curricular, ciclo de vida completo de una práctica.
- **[02-flujo-coordinacion.md](02-flujo-coordinacion.md)** — El día a día del coordinador: cómo entra una solicitud, cómo se gestiona una institución, qué decisiones tomás.
- **[03-actores.md](03-actores.md)** — Quién es quién: hierarquía interna UFLO, contactos institucionales, alumnos.
- **[04-estados.md](04-estados.md)** — Vocabulario de estados (lanzamientos, solicitudes, gestión).
- **[05-criterios.md](05-criterios.md)** — Cómo decidís: aprobar, rechazar, priorizar.
- **[06-documentacion.md](06-documentacion.md)** — Qué documentos existen (convenios, seguros, fundamentaciones), dónde viven, cuándo se piden.
- **[07-glosario.md](07-glosario.md)** — Vocabulario propio de UFLO y de PPS.
- **[08-fuera-de-alcance.md](08-fuera-de-alcance.md)** — Cosas que NO son responsabilidad del coordinador, qué se delega y a quién.

## Cómo usar este manual

- Hermes lee esto cada vez que arranca el contenedor (al inicio de cada llamada,
  vía `_read_tuyas()` en `app/main.py`).
- Si edita `criterios.md` o agrega una sección nueva, **reiniciá el contenedor**
  (`docker compose restart hermes-pps` en el VPS) para que se relea.
- Cuando Hermes te haga una pregunta en una exploración, la respuesta vive acá.
- Cuando dejes una decisión en `agent/aprendizajes.md` que se vuelva regla
  permanente, copiala al manual y borrala del log de aprendizajes.
