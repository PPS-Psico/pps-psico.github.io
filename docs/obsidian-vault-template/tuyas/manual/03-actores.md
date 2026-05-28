# 03 — Actores (quién es quién)

> Este archivo le da nombre real a las personas. Hermes lo usa para no tratar a
> todos como "una institución más" y para entender la jerarquía.
>
> Mantenelo actualizado cuando entra/sale alguien.

## Internos UFLO (alta jerarquía)

| Nombre                         | Rol                                                       | Contexto                                                                                                                    |
| ------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Fabiana De Col**             | Vicerrectora UFLO                                         | Cargo más alto que toca PPS. Decisiones institucionales mayores.                                                            |
| **Agostina** _(TODO apellido)_ | Directora de la carrera Lic. en Psicología                | Contacto frecuente vía WhatsApp. Te pide cosas seguido.                                                                     |
| **Florencia Peralta**          | Jefa del área de Evaluación (también referencia para PPS) | Aparece en el otro proyecto (automatización informes docentes), pero también tiene voz en decisiones de PPS por estructura. |
| **Elizabeth Alonzo**           | Área de gestión / evaluación                              | Contacto operativo en el lado UFLO.                                                                                         |

## Internos UFLO (operativos)

| Nombre   | Rol                              | Contexto |
| -------- | -------------------------------- | -------- |
| **TODO** | Otro coordinador de PPS (si hay) |          |
| **TODO** | Administrativa secretaría        |          |

## Vos (operador actual)

- **Blas Rivera** — `blas.rivera@uflouniversidad.edu.ar`
- Coordinador de PPS de Psicología
- Cuentas paralelas: `blas.r7@gmail.com` (personal, dueño del backup WhatsApp)

## Tipología de contactos en la lista PPS de WhatsApp

Cuando Hermes lee tu lista PPS (55 contactos al 2026-05-27), los clasifica así:

| Tipo                       | Descripción                                                                          | Acción de Hermes                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `autoridad_uflo`           | Fabiana, Agostina, otros internos jerárquicos                                        | Tono respetuoso, atención prioritaria, NO sugiere acciones automáticas — propone notas |
| `institucion_con_convenio` | Referente de institución ya cargada en `instituciones` con convenio activo           | Asocia mensajes a `institucion_id`, sugiere drafts, alimenta `institucion_resumen`     |
| `institucion_sin_convenio` | Referente de institución que estás gestionando por primera vez, todavía sin convenio | Hermes propone agregar al catálogo cuando el vínculo se concrete                       |
| `coordinador_externo`      | Coordinador de PPS de otra carrera/sede/universidad                                  | Tono peer, contexto distinto                                                           |
| `alumno`                   | Estudiante (raro en lista PPS, mejor por panel)                                      | Hermes minimiza intervención, te pide a vos que decidas                                |
| `otro`                     | Cualquier otro contacto institucionalmente relevante                                 | TODO: el operador define                                                               |

## Reglas operativas sobre actores

1. **Con autoridades UFLO**: Hermes nunca redacta borradores que vos vas a "solo confirmar". Siempre te muestra el contexto y vos escribís. Eso es por jerarquía y por riesgo.
2. **Con instituciones sin convenio**: Hermes puede borradorear, pero el primer contacto es siempre humano-iniciado (vos).
3. **Personal mezclada**: si Hermes detecta que un mensaje no es PPS-related (ej. coordinás con Agostina sobre otra materia), lo deja en `whatsapp_mensajes` pero no genera suggestions.

## Vínculo entre tablas

```
whatsapp_contactos (futuro)
  ├─ telefono (PK)
  ├─ nombre_displayed (lo que ves en tu agenda)
  ├─ tipo (enum de la tabla de arriba)
  ├─ institucion_id (nullable)
  └─ notas_hermes (qué aprendió Hermes sobre este contacto)
```

> TODO: implementar tabla `whatsapp_contactos` y poblar con clasificación
> inicial de los 55 contactos de tu lista PPS.
