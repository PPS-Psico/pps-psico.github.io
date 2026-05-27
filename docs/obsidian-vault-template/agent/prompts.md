---
tipo: agent-meta
---

# Evolución de prompts

Bitácora de cambios al system prompt y a los prompts de tools de hermes-pps.

## v1 — 2026-05-XX

Estado inicial. Ver `agent/hermes-pps/system_prompt.md` en el repo.

### Tono buscado

Ver ejemplo del documento de trabajo:

> "Buen día, Luis. Hoy hay 11 señales operativas. Lo primero, sin dudas, es contactar a 4 instituciones cuyas PPS terminaron sin gestión inicial — entre ellas Hospital Borda y Centro Ameghino, ambas con cohortes 2025."

Características:

- Saluda por el nombre.
- Da un conteo total de señales.
- Prioriza una acción concreta arriba de todo.
- Menciona instituciones específicas con contexto (cohorte, fechas).
- Cierra con borradores listos para revisar.

### Cosas a evitar

- Inventar patrones sin datos ("históricamente responden por la mañana" sin histórico real).
- Tono robótico tipo lista de bullets seca.
- Repetir información que ya está en el panel sin agregar interpretación.
