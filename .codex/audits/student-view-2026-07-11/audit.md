# Auditoría visual y UX — Vista estudiante

Fecha: 2026-07-11

## Alcance

Revisión combinada de UX, diseño visual y riesgos de accesibilidad en el entorno de simulación de la vista estudiante. Se recorrieron Inicio, Entregas, Prácticas y Solicitudes en escritorio, más Inicio y navegación inferior en móvil.

## Evidencia

1. `01-inicio-desktop.png` — Inicio, escritorio.
2. `02-entregas-desktop.png` — Entregas, escritorio.
3. `03-practicas-desktop.png` — Prácticas, escritorio.
4. `04-solicitudes-desktop.png` — Solicitudes, escritorio.
5. `05-inicio-mobile.png` — Inicio, móvil.
6. `06-inicio-mobile-scroll.png` — Tarjetas y navegación inferior, móvil.

## Veredicto

La vista ya tiene una dirección visual reconocible, sobria y más cuidada que un panel académico típico. La jerarquía editorial, la tipografía y el uso moderado del color funcionan bien. La mayor oportunidad no es un rediseño total: es reducir fricción, corregir inconsistencias entre escritorio y móvil, mejorar estados interactivos y reforzar accesibilidad.

## Fortalezas

- Jerarquía clara: título, contexto, estado y acción principal se distinguen rápido.
- Sistema visual coherente entre secciones: titulares grandes, acento verde, bordes suaves y etiquetas compactas.
- Inicio comunica horas, convocatorias y próximo paso sin convertir la pantalla en un dashboard saturado.
- Prácticas explica bien el avance hacia las 250 horas y los requisitos restantes.
- Solicitudes separa correctamente autogestión y acreditación.
- La navegación móvil conserva cinco destinos claros y etiquetas visibles.

## Hallazgos prioritarios

### P0 — Controles interactivos anidados en las tarjetas móviles

En Inicio móvil, cada convocatoria aparece como un botón que contiene otro botón (`Inscripto` o `Inscribirme`). Esta estructura es inválida para interacción y puede producir foco, activación y anuncios confusos en lectores de pantalla.

Recomendación: convertir la tarjeta en un `article` o enlace único y dejar un solo botón de acción. Si toda la tarjeta abre detalle, la CTA debe ser un enlace visual sin segundo control anidado, o la tarjeta no debe ser clicable.

### P1 — Inconsistencia en el resumen móvil

El encabezado dice “Hay una convocatoria abierta” mientras la misma pantalla muestra “3 nuevas” y tres tarjetas. Esto reduce confianza en el resumen principal.

Recomendación: derivar ambas frases del mismo contador y aplicar pluralización compartida.

### P1 — Entregas exige demasiado reconocimiento manual

La sección ofrece 11 instituciones en el primer grupo con tarjetas visualmente equivalentes. El estudiante debe recordar dónde cursó y recorrer una grilla larga.

Recomendación: destacar primero las instituciones asociadas a sus prácticas; agregar búsqueda por institución y mantener el selector de área como filtro secundario. Si sólo hay una coincidencia, mostrarla como “Tu entrega pendiente”.

### P1 — Semántica incompleta del selector de áreas

El DOM expone un `tablist`, pero sus controles aparecen como botones comunes y no se observa estado seleccionado semántico. Visualmente el estado activo existe, pero puede no comunicarse a tecnologías asistivas.

Recomendación: usar `role="tab"`, `aria-selected`, `aria-controls` y navegación por flechas; alternativamente, usar botones de filtro dentro de un grupo con etiqueta accesible.

### P2 — Contraste frágil en información secundaria

Etiquetas pequeñas, fechas, contadores y acciones en verde pastel tienen contraste visual bajo sobre fondos marfil o verde muy claro. El riesgo aumenta en pantallas con poco brillo.

Recomendación: oscurecer los tokens de texto secundario y de acento para contenido menor a 18 px; validar al menos WCAG AA con medición en navegador.

### P2 — El estado vacío de Solicitudes desperdicia la oportunidad de orientar

La pantalla tiene buenas acciones arriba, pero el gran bloque “Sin solicitudes” queda desconectado de ellas y ocupa la mayor parte del viewport.

Recomendación: reducir su altura y convertirlo en una explicación accionable: qué solicitud iniciar, cuándo corresponde acreditar y cuál es el siguiente requisito pendiente.

### P2 — Estados de convocatoria dependen demasiado del color

Las áreas y varias acciones cambian de verde, violeta o terracota. El texto ayuda, pero la diferenciación visual todavía depende bastante del color, especialmente en etiquetas pequeñas.

Recomendación: conservar texto explícito, sumar iconografía/forma consistente para estado y reservar el color por área como acento, no como señal principal.

## Dirección recomendada

No reemplazar el lenguaje visual actual. Evolucionarlo con tres intervenciones:

1. Corregir estructura interactiva y consistencia de datos en móvil.
2. Hacer Entregas y Solicitudes más orientadas al próximo paso personal.
3. Ajustar contraste, tamaños mínimos y estados de foco en todo el sistema estudiante.

## Límites de la evidencia

- La auditoría se hizo con datos simulados y no cubre todos los estados reales: errores, carga, consentimiento, inscripción completa, acreditación ni solicitudes en curso.
- El encabezado “Entorno de Simulación” no pertenece a la experiencia normal del estudiante y se excluyó de la evaluación visual del producto.
- Las capturas permiten identificar riesgos, pero no confirman cumplimiento WCAG. Falta probar teclado, lector de pantalla, zoom al 200 %, contraste medido y anuncios de cambios dinámicos.
