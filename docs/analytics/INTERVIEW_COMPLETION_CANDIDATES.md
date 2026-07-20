# KPI operativa · Próximos a finalizar

## Propósito

Identificar estudiantes a quienes coordinación puede ofrecer una PPS de 20
horas basada en entrevistas a profesionales. La PPS puede acreditarse en la
orientación que necesite cada estudiante y permitirle completar horas totales,
rotación o carga de especialidad.

La KPI es una **foto operativa actual**. No representa un flujo anual y, por lo
tanto, no cambia de definición cuando se modifica el selector de año de
Métricas.

## Universo

Se consideran estudiantes con `estado = Activo`, `role = Alumno`, al menos una
práctica registrada y sin solicitud en `finalizacion_pps`.

## Criterios de inclusión

“Próximo a finalizar” es la unión deduplicada de estas situaciones, evaluadas en
este orden:

1. Entre 230 y 249 horas totales.
2. 250 horas o más y exactamente dos orientaciones acreditadas.
3. 250 horas o más, tres orientaciones o más y entre 50 y 69 horas de la
   especialidad elegida.

Los objetivos de 250 horas, 70 horas de especialidad y tres orientaciones se
leen de `app_config`. Los límites inferiores equivalen a una brecha máxima de 20
horas.

## Exclusión específica

Se excluye al estudiante si existe cualquier registro de práctica —sin importar
su estado— cuyo nombre corresponda a:

- Relevamiento del Ejercicio Profesional en Psicología; o
- Entrevista/Entrevistas a Profesionales.

La detección revisa `practicas.nombre_institucion` y
`lanzamientos_pps.nombre_pps`. El patrón es intencionalmente específico: no
excluye “Entrevistas de Admisión” de Institución Fernando Ulloa ni el
“Laboratorio de entrevistas laborales”.

## Fuente única y seguridad

- La clasificación de los tres criterios reutiliza
  `private.get_director_report_v1_impl`, por lo que el informe para Dirección y
  la KPI no pueden divergir.
- La RPC pública es `public.get_interview_completion_candidates_v1()`.
- La implementación con privilegios vive en el esquema no expuesto `private`.
- La función pública es `SECURITY INVOKER`, valida `public.is_staff()` y sólo
  puede ejecutarla el rol `authenticated`; `anon` y `public` no tienen permiso.
- El payload nominal no incluye DNI, correo, teléfono ni domicilio.

## Presentación en Métricas

La tarjeta muestra el total y su composición por motivo. Al abrirla se listan:

- nombre y legajo;
- horas totales y de especialidad;
- orientaciones acreditadas y especialidad elegida;
- motivo de inclusión;
- cantidad de prácticas activas.

Cada fila abre el perfil del estudiante para que coordinación pueda revisar el
caso antes de realizar la oferta.

## Corte validado · 18 de julio de 2026

| Motivo                                   | Estudiantes |
| ---------------------------------------- | ----------: |
| Entre 230 y 249 horas                    |          11 |
| 250 horas o más y falta una orientación  |           2 |
| Brecha de especialidad de hasta 20 horas |           0 |
| **Total elegible**                       |      **13** |

Cuatro estudiantes que cumplían algún criterio fueron excluidos porque ya
registran Relevamiento o Entrevista a Profesionales.
