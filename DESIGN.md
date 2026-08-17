---
name: "Mi Panel Académico"
description: "Sistema institucional Paper & Ink para operar y comprender las PPS de Psicología."
colors:
  paper: "#f7f5f0"
  paper-muted: "#eeece5"
  paper-strong: "#e5e2d8"
  ink: "#14130f"
  ink-soft: "#3f3d36"
  ink-muted: "#6d6a61"
  ink-faint: "#99958a"
  rule: "#d9d5ca"
  accent: "#1f3a8a"
  success: "#2f5f3a"
  warning: "#a85a23"
  critical: "#a6293a"
typography:
  display:
    fontFamily: "Manrope, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "clamp(44px, 6.2vw, 82px)"
    fontWeight: 760
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  page-title:
    fontFamily: "Manrope, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "clamp(42px, 5.2vw, 68px)"
    fontWeight: 760
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    letterSpacing: "-0.035em"
  lead:
    fontFamily: "Manrope, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "clamp(17px, 1.7vw, 23px)"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Manrope, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  context:
    fontFamily: "Manrope, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "0"
  control:
    fontFamily: "Manrope, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
  action:
    fontFamily: "Manrope, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 750
    lineHeight: 1.2
  label:
    fontFamily: "Manrope, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.12em"
  data:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  flat: "0"
  bar: "2px"
  indicator: "4px"
  brand: "7px"
  control: "9px"
  floating: "10px"
  pill: "999px"
spacing:
  micro: "4px"
  compact: "8px"
  control: "10px"
  row: "18px"
  region: "20px"
  section: "24px"
  grid: "42px"
  block: "56px"
  separation: "64px"
  page-bottom: "96px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "34px"
  grade-select:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 32px 0 11px"
    height: "36px"
  status-warning:
    backgroundColor: "color-mix(in oklab, {colors.warning} 8%, transparent)"
    textColor: "{colors.warning}"
    typography: "{typography.data}"
    rounded: "{rounded.pill}"
    padding: "5px 9px"
  report-row:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.flat}"
    padding: "15px 12px 15px 20px"
  data-band-cell:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.flat}"
    padding: "22px 20px"
---

# Design System: Mi Panel Académico

## Overview

**Creative North Star: "Paper & Ink"**

El sistema se comporta como una mesa de trabajo institucional: papel cálido, tinta firme, reglas finas y color reservado para decisiones y estados. La jerarquía nace de la escala tipográfica, el orden de lectura y la alineación de los datos; no de una grilla de tarjetas decorativas.

El panel Jefe es la expresión operativa de referencia. Abre con riesgo y carga de trabajo, continúa con una cola individual ordenada y recién después muestra el panorama anual. Las acciones permanecen pegadas a la fila que modifican y toda cifra institucional conserva contexto de período, corte y fuente.

**Key Characteristics:**

- Jerarquía editorial con títulos grandes y lectura descendente.
- Una cola operativa plana antes del panorama agregado.
- Superficies separadas por reglas y cambios de papel, no por tarjetas apiladas.
- Datos compactos en JetBrains Mono y cifras protagonistas en Manrope.
- Color semántico siempre acompañado por texto explícito.

## Colors

La paleta clara usa tres papeles cálidos y cuatro densidades de tinta. El azul institucional identifica acción o selección; verde, ámbar y rojo comunican resolución, proximidad y criticidad.

### Primary

- **Azul institucional** (`accent`, #1f3a8a): foco, selección y estados corregidos; no funciona como relleno decorativo.

### Secondary

- **Verde resuelto** (`success`, #2f5f3a): saludos confirmatorios, estados en plazo y marcadores positivos.
- **Ámbar preventivo** (`warning`, #a85a23): entregas que llegan al plazo durante la semana.
- **Rojo crítico** (`critical`, #a6293a): informes que superaron el seguimiento interno y errores persistentes.

### Neutral

- **Papel base** (`paper`, #f7f5f0): lienzo y fondo de controles.
- **Papel secundario** (`paper-muted`, #eeece5): hover sutil, skeleton y separación tonal.
- **Papel profundo** (`paper-strong`, #e5e2d8): tercer nivel de superficie cuando una separación adicional es imprescindible.
- **Tinta principal** (`ink`, #14130f): títulos, cifras y acciones primarias.
- **Tinta secundaria** (`ink-soft`, #3f3d36): texto explicativo con alta relevancia.
- **Tinta atenuada** (`ink-muted`, #6d6a61): metadatos y controles inactivos.
- **Tinta tenue** (`ink-faint`, #99958a): notas, rótulos de tabla y evidencia secundaria.
- **Regla cálida** (`rule`, #d9d5ca): divisores de un píxel y contornos de controles.

El modo oscuro remapea los mismos roles, sin cambiar su significado: papeles #171713 / #20201b / #292922; tintas #f4f1e8 / #d4d0c5 / #aaa69a / #76736b; regla #38372f; azul #9bb4ff; verde #7fbc8b; ámbar #e3a26f; rojo #ee8493.

**The Semantic Redundancy Rule.** Todo estado combina marcador, palabra y descripción; el color nunca carga el significado por sí solo.

**The Rare Accent Rule.** Azul, verde, ámbar y rojo se reservan para acción, selección o estado verificable; la estructura cotidiana permanece en papel y tinta.

## Typography

**Display Font:** Manrope, con Hanken Grotesk y `system-ui` como respaldo.  
**Body Font:** Manrope, con la misma pila de respaldo.  
**Data Font:** JetBrains Mono, con `ui-monospace` y `monospace` como respaldo.

**Character:** Manrope aporta una voz institucional contemporánea y permite que títulos, cuerpo, controles y grandes cifras pertenezcan al mismo sistema. JetBrains Mono introduce precisión sólo en la capa compacta de medición.

### Hierarchy

- **Display** (760, `clamp(44px, 6.2vw, 82px)`, 0.98): saludo de Inicio; baja a 43px en mobile.
- **Page Title** (760, `clamp(42px, 5.2vw, 68px)`, 0.98): Informes y Panorama; baja a 43px en mobile.
- **Headline** (700, 22px, tracking -0.035em): encabezados de sección y módulos editoriales.
- **Lead** (400, `clamp(17px, 1.7vw, 23px)`, 1.55): síntesis de carga y riesgo; baja a 16px en mobile.
- **Body** (400, 14px, 1.55): explicaciones institucionales y contexto de superficie.
- **Context** (650, 11px, tracking 0, sentence case): fecha, área y descriptor breve de sección; reemplaza la repetición de eyebrows y kickers.
- **Control** (700, 11px): selects, acciones compactas y pestañas.
- **Action** (750, 10px): acción primaria compacta dentro de una fila.
- **Label** (800, 8.5–10px, tracking 0.12–0.14em, uppercase): cabeceras de ledger y rótulos de estado; no se usa como subtítulo repetido de sección.
- **Data** (600, 8–11px): fechas, vencimientos, contadores de filtros, meses, registros y celdas tabulares.

Las cifras protagonistas de 24–54px permanecen en Manrope; JetBrains Mono pertenece a la anotación tabular compacta, no a todos los números de la pantalla. El tracking negativo nunca supera -0.04em: display y cifras grandes llegan a ese piso, mientras los títulos de sección quedan en -0.035em.

**The Data Annotation Rule.** JetBrains Mono identifica fechas, plazos, ejes, contadores y valores de tabla; títulos, lectura y KPI editoriales siguen en Manrope.

## Layout

El lienzo principal mide hasta 1280px con gutters de 28px y padding vertical de 62px / 96px. El hero se limita a 1100px y su resumen a 960px. La pantalla Inicio usa una columna operativa flexible y un rail de 245px separados por 42px; Panorama usa una columna de lectura y un rail de 330px separados por 46px.

Las filas de informe siguen una grilla de cuatro zonas: identidad, fecha, seguimiento y acciones. Las bandas de datos comparten bordes y reparten cuatro o cinco métricas sin convertirlas en tarjetas independientes.

A 980px, los rails bajan debajo del contenido, la fecha deja de ocupar una columna y las listas auxiliares pasan de tres a dos columnas. A 720px, la cabecera de escritorio se reemplaza por una barra compacta y una navegación inferior de cinco destinos; las filas se resuelven en identidad + acciones, y las bandas pasan a dos columnas. Los gutters se reducen a 18px en tablet y 16px en mobile.

**The Queue Before Panorama Rule.** Riesgo y próxima corrección aparecen antes que cualquier resumen anual; la operación guía la primera lectura.

## Elevation & Depth

El panel es plano por defecto. Bordes de un píxel, railes laterales, fondos de papel y subrayados activos crean profundidad suficiente. La única sombra propia de la superficie es el toast flotante (`0 14px 34px rgba(0, 0, 0, 0.16)`); los controles y las filas no se elevan al hacer hover.

La barra mobile puede usar papel translúcido con blur porque permanece fija durante el scroll. Esa transparencia responde a una necesidad de navegación y no se extiende a las superficies de contenido.

**The Flat-by-Default Rule.** Si un elemento pertenece al flujo del documento, se separa con regla, espacio o tono; la sombra queda reservada para contenido verdaderamente flotante.

## Shapes

La geometría es recta y editorial. Filas, bandas, tablas y secciones usan esquinas planas. Los radios aparecen sólo donde ayudan a reconocer una función: barras de gráfico (2px), indicadores (4px), marca mobile (7px), botones y selects (9px), toast (10px) y chips o controles circulares (999px).

El espaciado recurrente parte de 4px y 8px para microalineación, 10–20px dentro de controles y filas, 24px entre encabezados y contenido, 42–56px entre regiones y 64px entre secciones mayores. El cierre de página reserva 96px para evitar que la navegación inferior o el final del viewport compriman el contenido.

## Components

### Buttons

- **Shape:** rectángulo compacto de 9px, 34px de alto y padding horizontal de 11px.
- **Primary:** tinta sólida sobre papel; se usa para abrir el informe externo y para reintentar un error.
- **Hover / Focus:** el hover reduce la opacidad a 0.82; el foco visible usa un contorno de 2px con azul institucional y offset de 2px.
- **Text action:** queda sin fondo ni borde, con 12px y peso 700; acompaña encabezados y nunca compite con la acción primaria de una fila.

### Chips

- **Style:** pill de 999px, padding 5px 9px y texto JetBrains Mono de 9.5px.
- **State:** crítico y próximo agregan una tinta de fondo al 8% y borde mezclado al 45%; en plazo conserva fondo plano. El texto describe siempre el vencimiento.

### Cards / Containers

- **Corner Style:** plano; el panel Jefe no usa tarjetas redondeadas para agrupar métricas.
- **Background:** papel base, con papel secundario al 65% sólo en hover de filas.
- **Shadow Strategy:** ninguna sombra en el flujo.
- **Border:** reglas horizontales de un píxel; los rails suman una regla vertical.
- **Internal Padding:** filas de escritorio 15px 12px 15px 20px; celdas de banda 22px 20px.

### Inputs / Fields

- **Grade Select:** 36px de alto, radio de 9px, regla cálida y padding 0 32px 0 11px; usa Manrope de 11px y peso 700.
- **Search:** campo transparente de 38px con una sola regla inferior; ocupa hasta 300px y se vuelve full-width en mobile.
- **Focus:** el select usa outline azul de 2px con offset de 2px. El estado guardando deshabilita el select y hace girar el indicador.

### Navigation

En escritorio, una barra sticky de 60px mantiene navegación textual y marca la vista activa con un subrayado de 2px. A 720px, una topbar de 56px y una barra inferior de cinco columnas reemplazan la navegación de escritorio; el destino activo combina tinta y una regla superior de 2px.

### Report Ledger

Cada informe es una fila plana de al menos 78px. Una barra vertical de 3px expresa urgencia, la identidad queda a la izquierda, los microdatos ocupan el centro y las acciones se alinean a la derecha. En mobile la fila crece a 92px y las acciones se apilan sin separar el control de la persona afectada.

### Data Bands and Status Rails

Los KPI se muestran como cifras grandes alineadas dentro de una banda compartida. El rail lateral resume crítico, esta semana y en plazo con una cifra y una explicación por estado. Ambos patrones evitan el mosaico de cards y preservan una lectura comparativa inmediata.

## Do's and Don'ts

### Do:

- **Do** usar Manrope para toda la voz principal y JetBrains Mono para microdatos tabulares.
- **Do** usar una única línea de contexto en sentence case para fecha, área o descriptor de sección.
- **Do** mantener fecha de corte, período, universo y fuente junto a las métricas institucionales.
- **Do** ordenar los informes desde la fecha individual de entrega y explicar la regla de 30 días corridos.
- **Do** combinar color, marcador y texto en todo estado de urgencia.
- **Do** conservar las acciones dentro de la fila y alineadas al extremo derecho.
- **Do** replegar rails, columnas de fecha y navegación según los quiebres de 980px y 720px.

### Don't:

- **Don't** convertir la cola, los KPI o las instituciones en un mosaico de tarjetas redondeadas.
- **Don't** usar JetBrains Mono para títulos, párrafos o grandes cifras editoriales.
- **Don't** mezclar la foto operativa actual con el resultado anual; cada una conserva su corte y fuente.
- **Don't** comunicar criticidad sólo con rojo, ámbar o verde.
- **Don't** agregar sombras, vidrio o color si una regla, un cambio de papel o el espacio ya resuelven la jerarquía.
- **Don't** separar el control de calificación del informe y estudiante que modifica.
