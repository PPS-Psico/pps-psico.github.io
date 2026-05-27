# Vault Obsidian — Hermes-PPS

Estructura inicial del vault que vive en el VPS (`/opt/obsidian-pps/`) y sincroniza con tu compu por Syncthing.

## Estructura

```
obsidian-pps/
├── README.md                 ← este archivo, queda como índice
├── daily/                    ← brief diario escrito por Hermes
│   └── YYYY-MM-DD.md
├── instituciones/            ← una nota por institución, mantenida por Hermes
│   └── <slug-institucion>.md
├── agent/                    ← notas técnicas del agente
│   ├── prompts.md            ← evolución de prompts
│   ├── decisiones.md         ← decisiones de diseño relevantes
│   └── errores.md            ← cosas que el agente hizo mal, para iterar
└── tuyas/                    ← TU espacio. Hermes lee acá pero nunca escribe.
    ├── criterios.md          ← criterios personales de coordinación
    ├── contexto-uflo.md      ← contexto institucional que ayuda a Hermes
    └── pendientes.md         ← lo que vos quieras anotar a mano
```

## Reglas de escritura

| Carpeta          | Lectura     | Escritura       |
| ---------------- | ----------- | --------------- |
| `daily/`         | tú + Hermes | **solo Hermes** |
| `instituciones/` | tú + Hermes | **solo Hermes** |
| `agent/`         | tú + Hermes | tú + Hermes     |
| `tuyas/`         | tú + Hermes | **solo tú**     |

Hermes nunca toca `tuyas/`. Es tu lugar para acumular contexto que vos querés que el agente lea pero no modifique (ej. "no contactar al Hospital X en horario de almuerzo", "Fundación Y prefiere mail antes que WhatsApp", etc.).

## Cómo lee Hermes el vault

Cuando arma el brief o procesa una institución, Hermes lee:

1. La nota de la institución correspondiente (`instituciones/<slug>.md`).
2. `tuyas/criterios.md` y `tuyas/contexto-uflo.md` como contexto general.
3. El último daily (`daily/<ayer>.md`) para continuidad.

## Templates

Ver `templates/` para los formatos sugeridos de nota diaria y nota institucional.
