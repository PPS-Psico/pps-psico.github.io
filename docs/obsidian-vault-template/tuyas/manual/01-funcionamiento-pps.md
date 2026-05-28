# 01 — Qué son las PPS y cómo funcionan

## Definición

Las **Prácticas Profesionales Supervisadas (PPS)** son una instancia curricular
obligatoria de la carrera de Licenciatura en Psicología en UFLO Universidad.
Cada estudiante debe acreditar **X horas** (TODO: cantidad exacta) de práctica
en una institución externa, bajo supervisión de un tutor institucional + un
docente de la carrera.

> TODO operador: completar — duración mínima, año de cursada, requisitos previos,
> orientaciones obligatorias vs electivas.

## Orientaciones

Las PPS se ofrecen en cuatro orientaciones (mapean a campos profesionales):

- **Clínica** — hospitales, centros de salud mental, consultorios.
- **Educacional** — escuelas, gabinetes, centros pedagógicos.
- **Laboral** — empresas, RRHH, consultoras.
- **Comunitaria** — ONGs, programas sociales, municipios.

En el panel cada lanzamiento tiene una `orientacion` (única). Las instituciones
pueden tener múltiples orientaciones habilitadas en `instituciones.orientaciones`.

## Ciclo de vida de una práctica — pipeline completo

```
1. ALUMNO solicita PPS
   ├─ Vía: formulario en el panel (tabla `solicitudes_pps`)
   ├─ Datos: nombre, legajo, orientación, localidad, descripción
   └─ Estado inicial: 'Pendiente'

2. COORDINADOR (vos) procesa solicitud
   ├─ Matchea con institución existente o no existente
   ├─ Si matchea → ofrece cupo en lanzamiento abierto
   └─ Si no matchea → contacta institución nueva (o redirige al alumno)
   Resultado: estado pasa a 'Realizada' / 'No se pudo concretar' / 'En proceso'

3. LANZAMIENTO (convocatoria) — vida útil:
   ├─ borrador          → coordinador arma cupos, fechas, requisitos
   ├─ abierta           → alumnos se inscriben (hasta cierre)
   ├─ cerrada           → coordinador selecciona estudiantes
   ├─ seleccionada      → se genera seguro estudiantil
   ├─ activa            → la PPS arrancó, hay seguimiento
   └─ archivada         → finalizada (acreditada o no relanzable)

4. SEGUIMIENTO (durante PPS activa)
   ├─ Reuniones periódicas alumno × tutor × coordinador
   ├─ Eventos típicos: PPS suspendida, alumno se va, cambio de tutor
   └─ Termina con acreditación de horas

5. ACREDITACIÓN
   ├─ Tutor institucional certifica horas y desempeño
   ├─ Coordinador valida y carga en sistema académico UFLO
   └─ Alumno suma horas a su acreditación curricular
```

## Volúmenes (TODO: confirmar con datos reales)

- Solicitudes por cuatrimestre: ~?
- Lanzamientos activos típicos: ~50-60 (medido 2026-05).
- Estudiantes en PPS simultáneas: ~?
- Instituciones con convenio vigente: ~?

## Particularidad de UFLO

- Geografía: alumnos distribuidos entre **Buenos Aires** (Almagro/Recoleta) y
  **Patagonia** (Cipolletti, Roca, Neuquén). Lo que se aprueba para BA no
  necesariamente sirve para sedes patagónicas (distancias enormes).
- **Convenios institucionales** son requisito previo a cualquier PPS. Sin
  convenio firmado entre UFLO y la institución, no se puede lanzar una PPS.
- Hay dos tipos de convenios: **marco** (general, válido años) y **específico**
  (por cohorte). TODO: confirmar.

## Documentación reglamentaria

- TODO: cita del reglamento de PPS UFLO + link
- TODO: criterios CONEAU si aplican
- TODO: cantidad mínima de horas por orientación
