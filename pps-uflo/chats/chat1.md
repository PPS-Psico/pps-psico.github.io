# Rediseño página

_Started 2026-05-27 10:33 UTC_

---

## User

te dejo primero la pagina que el proyecto de pagina nueva que estamos desarrollando y luego te dejo la pagina real que vamos a reemplazar. Estamos trabajando inspirados en estas habiliaddes: - impecable http://impeccable.style

- gusto http://tasteskill.dev
- capas http://layers.jamiemill.com
- superdiseño http://app.superdesign.dev

## Assistant

_[tool: local_ls]_

_[tool: local_read]_

Recibido. Veo la estructura del proyecto en la carpeta "Pagina PPS" — un panel administrativo para PPS UFLO con varias vistas (Admin Inicio, Lanzador), construido en React/JSX con un sistema visual editorial (Hanken Grotesk + Instrument Serif + paleta papel/tinta).

Antes de seguir, espero que me compartas:

1. **La página real que vamos a reemplazar** (URL, screenshots, o archivos)
2. **Qué pieza específica querés iterar** — ¿la Admin Inicio, el Lanzador, todo el flujo, o una vista nueva?

Mientras tanto, las referencias que mencionaste (impeccable, taste, layers, superdesign) me dan una dirección clara — interfaces densas, editoriales, con jerarquía tipográfica fuerte, mucho espacio en blanco, monospace para metadatos, y un tono "tool for professionals" más que "SaaS friendly". Eso ya está bien sembrado en lo que tenés.

Cuando me pases la página actual y qué querés hacer con ella, arranco.

## User

este es el proyecto real, analizalo con antencion, tomate tu tiempo. Vamos a seguir trabajando por ahora con admin, nos queda mucho tiempo. Cuando analizo inicio y luego lanzador, ciento que inicio esta mucho mas lindo, lanzador le falta un poco de color y estilo. Sino es posible que quede como inicio de bonito, tal vez tengamos que repensar el estilo, sobre todo con la proxima seccion que es gestion, ahi los colores van a ser importantes

## Assistant

_[tool: local_ls]_

_[tool: local_ls]_

_[tool: local_ls]_

_[tool: local_read]_

_[tool: local_ls]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: list_files]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_ls]_

Antes de seguir, una pausa breve — necesito acceso a los archivos del WIP que estábamos desarrollando.

**Lo que veo ahora:**

- ✅ `consulta-pps-uflo` está adjunto (el proyecto real)
- ❌ `Pagina PPS` ya no está adjunta (la carpeta con `Admin Inicio v2.html`, `Lanzador.html`, los `.jsx` que mencionaste como "Inicio" y "Lanzador")

**Necesito que vuelvas a adjuntar la carpeta `Pagina PPS`** desde el menú Import, así puedo:

1. Ver los HTML/JSX que vos sentís que "Inicio quedó bonito" y "Lanzador le falta color"
2. Entender el sistema visual actual del WIP (las variables `--paper`, `--ink`, `--accent` que vi en `index.html`)
3. Comparar lado a lado con la página real (`consulta-pps-uflo`) para proponer:
   - **Camino A:** subir el Lanzador al nivel del Inicio (más estilo dentro del mismo lenguaje editorial)
   - **Camino B:** repensar el sistema visual entero pensando en Gestión, donde los colores van a tener significado funcional (vencidas, demoradas, próximas a vencer, confirmadas — tipo semáforo)

**Mientras tanto, lo que tengo claro de la app real:**

| Vista                         | Estado actual en producción                                                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inicio (`AdminDashboard`)** | Cards con gradientes pastel + iconos coloreados (rosa/ámbar/esmeralda/azul) por categoría operativa. Bastante saturado, "SaaS friendly".                                                              |
| **Lanzador**                  | Sub-tabs (Nuevo / Seleccionador / Seguro / Historial). Funcional pero plano.                                                                                                                          |
| **Gestión**                   | Sub-tabs + `ConvocatoriaManager` + Agenda + Calendario 2026. Maneja estados con semántica fuerte (vencidas, demoradas, confirmadas, indefinidas) → **acá el color SÍ es información, no decoración.** |

Tu intuición de "los colores van a ser importantes en Gestión" es correcta — ahí los estados son el contenido principal. Si en el WIP estás trabajando con la paleta papel/tinta + acentos muy contenidos (azul tinta + terracota + verde), eso choca con Gestión salvo que diseñemos un sistema de **estado-color** explícito.

Re-adjuntá `Pagina PPS` y avanzo.

## User

ahi copie la carpeta de la pagina dentro del proyecto

## Assistant

_[tool: list_files]_

_[tool: local_ls]_

_[tool: local_ls]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_copy_to_project]_

Voy a copiar el WIP al proyecto para poder verlo renderizado y comparar.

_[tool: view_image]_

_[tool: show_html]_

_[tool: view_image]_

_[tool: show_html]_

_[tool: grep]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: read_file]_

Bueno, ya vi todo. Te paso mi lectura y te propongo cómo seguir.

## Diagnóstico

**Por qué Inicio canta:**

- Tiene **voz** — la prosa de Hermes con marks/itálicas + el "Buen día, Luis" enorme leen como una carta personal, no como un dashboard.
- Tiene **ritmo numérico** — los `01 02 03` de prioridades + los números grandes "4 · 3 · 2 · 7 · 2" del resumen actúan como pulso visual.
- Usa **color como semáforo discreto** — los dots `warn/accent/ok` señalizan sin gritar; las marks de fondo (`--accent-soft`, `--warn-soft`) resaltan sin saturar.
- Layout **editorial 2 columnas** (Agenda + Pulse) tipo diario.

**Por qué Lanzador queda chato:**

- No hay narrativa — entrás directo a un editor de formulario, sin "voz" que enmarque qué estás haciendo.
- El step indicator `1→2→3→4→5` es discreto y se pierde; no genera la sensación de momento que tienen los `01 02 03` de Inicio.
- El sidebar es una lista densa funcional pero sin jerarquía editorial (todo gris sobre gris).
- **No usa los colores que ya tiene definidos** — `--accent`, `--warn`, `--ok`, `--ai` están en CSS pero apenas aparecen en pantalla. Hermes/IA en particular está casi invisible cuando debería ser protagonista de "armar la convocatoria".
- El preview de WhatsApp es funcional pero plano — podría ser un "momento" (tipo: "así lo van a leer 12 estudiantes").

## La buena noticia

**El sistema no está roto. Está infrautilizado en Lanzador.** Las variables ya existen (`--accent`, `--warn`, `--ok`, `--ai`, `--accent-soft`...). Inicio las usa con disciplina; Lanzador casi no las toca. Eso es solucionable sin tocar tokens.

## Para Gestión (lo que viene)

Ahí sí necesitamos **un sistema explícito de estado-color**, porque los estados (vencida / demorada / en gestión / confirmada / archivada / indefinida) **son** el contenido principal. Mi propuesta:

| Estado                | Token actual            | Uso                           |
| --------------------- | ----------------------- | ----------------------------- |
| Vencida sin gestión   | `--warn` (rust)         | dot + eyebrow + mark de fondo |
| Demorada (2+ días)    | `--accent` (azul tinta) | dot + eyebrow                 |
| Confirmada / OK       | `--ok` (verde)          | dot + eyebrow                 |
| Indefinida / en pausa | `--ink-4` (gris)        | dot apagado                   |
| Hermes / IA sugiere   | `--ai` (lavanda)        | dot + eyebrow + chip suave    |

5 tokens, usados como dots/marks/eyebrows, NO como fills de tarjetas. Sigue siendo papel-tinta editorial; el color es información, no decoración.

## Caminos que veo

**Camino A — Lifting de Lanzador dentro del lenguaje actual**
Aplicar los patrones que hacen cantar a Inicio: editorial intro arriba ("Estás armando una convocatoria para…"), step indicator con tamaño de momento, presencia clara de Hermes (lavanda) sugiriendo cosas, marks en la prosa del preview WhatsApp, mejor uso de los dots semánticos. Sin cambiar el sistema.

**Camino B — Camino A + capa de estado-color**
Igual que A, pero además introducimos la tabla de arriba como sistema explícito y la aplicamos en Lanzador (estados de convocatoria: borrador / inscripción abierta / por seleccionar / activa / finalizada). Esto deja todo listo para Gestión.

**Camino C — Repensar el sistema**
Si sentís que papel-tinta es demasiado monacal para Gestión, podríamos explorar variantes: fondo más oscuro, modo "operations" más saturado, o un sistema híbrido (Inicio sigue editorial, Gestión adopta un lenguaje más "panel de control"). Yo personalmente NO lo recomiendo todavía — el sistema actual puede aguantar Gestión si lo usamos bien — pero es opción.

---

**Mi recomendación:** Camino B. Tenemos tiempo, dejarlo cocinado para Gestión es mucho más barato hacerlo ahora que después, y Lanzador queda al nivel de Inicio en el camino.

¿Te tira por ahí, o querés que explore en paralelo A + B + variantes oscuras para que las veas lado a lado antes de comprometernos?

## User

vos podes instalar esto? https://impeccable.style -- capaz te ayuda a definir que podemos hacer mejor

## Assistant

No puedo instalar nada en mi entorno, pero sí puedo traer el contenido del sitio. El problema es que solo me llega como texto — para una referencia visual como esa, lo más útil sería que vos me mandes 3-4 screenshots de las páginas/patrones específicos de impeccable que te llamaron la atención, y los uso como brújula concreta.

Igual probemos primero qué saca:

_[tool: web_fetch]_

No puedo "instalarlo" en mi entorno — Impeccable es un skill package para harnesses tipo Cursor/Claude Code/Gemini CLI/Codex (vía `npx skills add pbakaus/impeccable`). Mi entorno no tiene ese mecanismo de skill loader; yo tengo un set fijo de habilidades.

**Pero la página me sirvió un montón.** Y lo que dice Impeccable es directamente relevante para nuestra discusión. Te resumo la lectura aplicada a nuestro WIP.

---

## Lo que Impeccable codifica como "AI slop tells" (y qué tenemos nosotros)

Impeccable mantiene una lista de patrones que delatan diseño generado por IA. Mirando nuestro WIP contra esa lista:

| Patrón flagueado por Impeccable                                                                         | ¿Lo tenemos?                                                            |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Italic serif hero** (Fraunces, Recoleta, Playfair, **Instrument Serif**, Cormorant) como h1 principal | ✅ Sí. "Buen día, Luis" en Instrument Serif.                            |
| **Hero eyebrow chips** — label uppercase letter-spaced arriba del h1                                    | ✅ Sí. "ADMIN · INICIO" / "HERMES · BRIEFING DEL DÍA"                   |
| **Geist / Hanken Grotesk / Inter / etc.** como sans default                                             | 🟡 Usamos Hanken Grotesk (en la lista de fuentes sobreutilizadas)       |
| **Cream/paper editorial background** como default                                                       | ✅ Sí. `#F7F5F0`                                                        |
| **Em dashes everywhere**                                                                                | ✅ Sí (lo veo en la prosa de Hermes y… en mis propias respuestas, jaja) |
| Cards on cards, gradient text, low contrast                                                             | ❌ Bien, no caemos en esos                                              |

Lo más punzante de toda la página, textual:

> **"Editorial-typographic"** es el primer item de la "reflex-reject aesthetic lanes" — un patrón reflejo donde toda salida del default SaaS-cream cae automáticamente en estética magazine-cover.

Traducido: **el look que tenemos en Inicio es la "salida prestigiosa" estándar de IA**. No es feo — es _previsible_ en su no-previsibilidad.

---

## Pero — y esto importa — ¿es slop en NUESTRO caso?

Impeccable distingue dos registros: **brand** (diseño = producto, ej. landing pages) y **product** (diseño sirve al producto, ej. dashboards). Y advierte que cuando un dashboard adopta lenguaje editorial sin razón funcional, eso ES slop.

**Mi diagnóstico honesto del WIP:**

- **Inicio**: el look editorial está _casi_ justificado — Hermes es una voz narrativa diaria, el "briefing matutino" es un ritual, no un dashboard. Pero la decoración (eyebrow chips, italic serif hero, prose con marks) es **demasiado** para algo que se ve todos los días. Tenés razón en que se ve "bonito", pero el costo es que también es **reconociblemente AI-coded**.

- **Lanzador**: el problema no es que "le falte color/estilo". El problema es que **está usando el mismo lenguaje de brand-register** (papel, italic serif para títulos de convocatoria, eyebrows) **para una superficie que es 100% product-register** (un editor de formulario con preview). Por eso se siente "chato": el lenguaje no le pertenece. Lanzador no necesita ser más bonito en clave editorial — necesita ser más _herramienta confiada_.

- **Gestión** (que viene): es 100% product-register también — operaciones, estados, semáforos, listas, filtros. Si la forzamos al lenguaje editorial, va a sentirse igual de "deformada" que Lanzador.

---

## Lo que esto me sugiere replantear

Las inspiraciones que vos mismo me diste muestran este split, no por casualidad:

- **impeccable.style** — registro brand, editorial confiado (marketing del propio skill)
- **tasteskill.dev** — probablemente similar, brand/marketing
- **layers.jamiemill.com** — probablemente product/tool register, más utilitario
- **app.superdesign.dev** — product register, claramente "app/tool"

El menú que te propongo, refinado, es:

**Dirección 1 — "Two registers, one system"** _(mi recomendación fuerte ahora)_

- **Inicio** se queda como ritual editorial, pero más **disciplinado**: un solo "momento" serif por día, eyebrows usados con criterio (no en cada sección), menos em-dashes. Ownear la decisión, no acumular ornamentos.
- **Lanzador y Gestión** adoptan un **product register diferenciado**: mismo paper/ink, misma familia tipográfica (Hanken), pero **sin** italic serif hero, **sin** eyebrows decorativos, **con** color funcional (estado-semáforo), **con** densidad de información mayor. Más cerca de un buen Linear / Plane / Height que de una revista.
- El cambio de registro es **una feature**, no un bug: cuando entrás a Inicio entrás a "leer el día"; cuando entrás a Lanzador/Gestión entrás a "operar".

**Dirección 2 — "Drop the editorial reflex entirely"**

- Aceptar que el look editorial es AI-tell y rehacer Inicio en lenguaje product también. Misma paleta papel-tinta, pero sin serif hero ni eyebrows. Inicio se vuelve un panel de control claro y sereno, sin pretender ser una carta de la mañana.
- Más honesto, más rápido de operar, menos "diseñado". Costo: perdemos la calidez/ritual matutino.

**Dirección 3 — "Lean hard into editorial, ownearlo"**

- Doblar la apuesta: Inicio + Lanzador + Gestión todos en lenguaje editorial confiado, pero hechos con tanto criterio que dejan de ser reflex. Esto requiere mucho oficio (cada italic, cada eyebrow, cada em-dash debe estar _ganado_).
- Riesgo: agotador de operar día a día. Probable.

---

¿Para qué lado te tira? Yo sigo recomendando **Dirección 1** — diferenciar registros es la solución correcta y nos da espacio para que Gestión respire con color funcional sin sentir que rompe el sistema. Lanzador deja de competir con Inicio en "ser bonito" y pasa a ganar en "ser confiable".

## User

vamos con la direccion 1

## Assistant

_[tool: update_todos]_

Excelente. Vamos.

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: update_todos]_

Voy a hacer esto sin reescribir 2300 líneas. Estrategia:

1. **Nuevo HTML** con un sistema CSS extendido (tokens de estado + reglas product-register que sobreescriben los `.serif` y eyebrows en este surface)
2. **Edición quirúrgica** de los JSX (sidebar + views) para sacar los reflejos editoriales y mostrar color funcional
3. Mantenemos el `data.jsx` y `topbar.jsx` como están

_[tool: copy_files]_

_[tool: write_file]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: str_replace_edit]_

Buen progreso. Vamos por el resto — sacar el eyebrow decorativo arriba del hero y reemplazarlo por el chip de estado prominente, y darle muscle al step indicator.

_[tool: str_replace_edit]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: grep]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: grep]_

_[tool: eval_js_user_view]_

_[tool: str_replace_edit]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: save_screenshot]_

Veamos cómo se ve en otro estado — Inscripción abierta:

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: update_todos]_

Excelente, Lanzador está cantando ahora. Marco progreso y voy por la limpieza de Inicio.

_[tool: grep]_

_[tool: done]_

Voy a hacer un checkpoint acá antes de tocar Inicio — quiero que veas el cambio en Lanzador y me digas si tira por ahí, antes de meter mano en la otra superficie.Tirá la moneda mirando lo que abrí en tu vista (es `wip/v3/Lanzador.html`). Probá moverte por los estados con el Tweaks (botón "Tweaks" en la toolbar → "Demo: cambiar estado") — Borrador, Inscripción abierta, A seleccionar, A asegurar, Activa, Archivada. El chip de estado y la pipeline arriba van a cambiar de color en cada uno.

**Lo que cambié en concreto** (sin tocar el sistema de tokens):

- **Sans en lugar de italic-serif** para todos los títulos de Lanzador (hero, secciones, big numbers). El `.serif em` ahora rinde como bold + indigo accent → la palabra que antes era italic ahora es la "palabra clave" coloreada
- **Chip de estado prominente** arriba del título, con el color del estado como fill suave (`--state-borrador-soft`, `--state-abierta-soft`, etc.)
- **Pipeline** reemplaza al step indicator chiquito: 5 segmentos llenos, el activo en negro sólido tipo "you are here"
- **Meta tool-style** en mono: `ID C2 · editada hoy · 10:32`
- **Eyebrow decorativo arriba del hero eliminado** — ahora todo el contexto lo carga el chip + el strip de meta
- **Sidebar** sin eyebrow "LANZADOR" arriba — el título "Convocatorias" en bold sans tiene su propio peso

**Lo que NO toqué** (a propósito):

- Las eyebrows que llevan información real (etiquetas de campo tipo "INSTITUCIÓN", "NOMBRE PPS · VISIBLE PARA ESTUDIANTES", labels de horarios) — eso es info, no decoración
- El layout general (sidebar + canvas + preview tabs)
- Los textos y la data
- Inicio — sin tocar

**Preguntas para vos:**

1. ¿La pipeline de 5 segmentos te gusta así, o querés algo más sutil?
2. El chip de estado ahora es visual-loud — ¿bien, o demasiado?
3. El uso del `em → bold+indigo` para destacar palabras ("Salud por franja horaria", "Quiénes ya se inscribieron") — ¿lo mantenemos, o preferís texto plano sin highlight?
4. ¿Querés que ahora pase a la limpieza disciplinada de Inicio (sacar eyebrows decorativos, dejar solo el hero serif "Buen día, Luis" como momento ganado), o lo dejamos como está?

Cuando respondas avanzo. Si querés, también puedo armar un canvas con las dos versiones lado a lado para comparar.

## User

necesito un poco de color, desde lo mas basico, las orientaiciones tienen sus colores, podemos usar unos adaptados a esta version, pero que mantenga lo represntativo. Fijate si lo podes dejar u npoco mas colorido, detalles, pero que sumen

## Assistant

_[tool: snip]_

_[tool: grep]_

_[tool: str_replace_edit]_

Buenísimo — agarrar los colores de orientación es el lugar correcto para meter información cromática. Voy a:

1. Adaptar la paleta de orientaciones al lenguaje paper-ink (menos saturada, más natural sobre `#F7F5F0`)
2. Usarla en los chips del header + en el form + en el mix de inscriptos
3. Agregar un acento de color (filete vertical de orientación) en las filas del sidebar

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: read_file]_

_[tool: grep]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: done]_

Listo — tirate por todos los estados con el Tweaks. Lo que agregué:

## Sistema de color de orientación

Adapté la paleta original (`#3B82F6 / #10B981 / #F59E0B / #8B5CF6`) al lenguaje paper-ink — mismas familias de tono, menos saturadas para que respiren sobre el `#F7F5F0`:

| Orientación | Antes     | Ahora     | Token                  |
| ----------- | --------- | --------- | ---------------------- |
| Clínica     | `#3B82F6` | `#2E5BA8` | `--orient-clinica`     |
| Educacional | `#10B981` | `#3D7A4B` | `--orient-educacional` |
| Laboral     | `#F59E0B` | `#A66626` | `--orient-laboral`     |
| Comunitaria | `#8B5CF6` | `#6E429E` | `--orient-comunitaria` |

## Dónde se ve

1. **Chips del header** — antes eran negros sólidos, ahora cada orientación con su color de relleno suave + dot + texto del mismo hue
2. **Form picker** (sección "Orientaciones") — los chips no-seleccionados se prenden con su color en hover; el seleccionado queda con su tinte permanente
3. **Sidebar** — cada fila ahora muestra dots chiquitos de orientación junto al porcentaje/inscriptos. En una sola mirada ves "esta es Clínica" o "ésta es Clínica + Educacional"
4. **Mix bar de inscriptos** (cuando entrás a `Inscripción abierta`) — el bar de "Orientación" ahora va coloreado por hue, no en escala de grises. Distingue de un saque cuántos clínicos vs. educacionales se anotaron
5. **Tarjeta preview del estudiante** — el badge de orientación usa los tokens nuevos

## Lo que NO toqué a propósito

- Los números grandes ("23 inscriptos", "Cierra en 3 días") — esos siguen siendo tinta para mantener jerarquía
- El step pipeline activo — sigue negro sólido ("you are here" indeleble)
- El IA/Hermes lavanda — ya estaba bien presente, lo dejé

Probá moverte por los estados (`Borrador → Abierta → A seleccionar → ...`) — vas a ver que el chip del estado y los chips de orientación coexisten sin pelearse, porque uno es **rol** (qué fase es) y otro es **tipo** (qué clase de PPS es).

Si querés podemos ir más con color — por ejemplo, tintar las secciones del formulario con la orientación primaria, o agregar un filete de orientación al costado del canvas. Decime hasta dónde tirar.

## User

bueno, vamos con gestion, que es una pantalla a rediseñar y dejar mcuho mejor.

## Assistant

_[tool: snip]_

_[tool: snip]_

_[tool: local_read]_

Antes de arrancar, exploro qué hay en producción para entender qué tengo que rediseñar.

_[tool: local_read]_

_[tool: local_read]_

_[tool: grep]_

_[tool: grep]_

_[tool: local_grep]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_read]_

## User

ademas de investigar que hace en la pagina, te dejo una referencia de lo que deberia hacer, pero es igual una referencia, se puede mejorar o cambiar:

## Assistant

_[tool: snip]_

Buenísimo — esa referencia ordena todo. Reflejo lo que entendí + propongo arquitectura + tiro preguntas para no especular.

## Lo que entendí del modelo de datos actual

El hook ya genera estas 6 categorías:

- **`porContactar`** — finalizadas sin gestión inicial (urgency=high si <30d)
- **`contactadasEsperandoRespuesta`** — contactaste, esperás respuesta (con `daysWaiting`)
- **`respondidasPendienteDecision`** — respondieron, falta decidir
- **`relanzamientosConfirmados`** — ya hay sí + fecha
- **`activasPorFinalizar`** — todavía corren pero terminan en ≤45d
- **`activasIndefinidas`** — sin fechas, hay que limpiar datos

La página actual los muestra como secciones colapsables en un `ConvocatoriaManager`. Eso es la "tabla" que tu referencia critica.

## La pregunta de la página, traducida

Inicio te dice **"hoy importan estas 5 cosas"** (briefing narrativo).
Gestión te dice **"hoy hacé estas 5 cosas, y acá tenés todo a mano para hacerlas"** (workshop operativo).

Mismo DNA, otra densidad y otro registro. Es el siguiente paso de la cadena: leíste el briefing, ahora abrís el escritorio.

## Arquitectura propuesta — tres zonas, tipo mail client

```
┌───────────────────────────────────────────────────────────────┐
│ Topbar existente                                              │
├──────────────┬──────────────────────────────┬─────────────────┤
│              │                              │                 │
│  RAIL        │   BANDEJA                    │   FICHA VIVA    │
│              │                              │                 │
│  · Hoy (12)  │   Default:                   │   (panel der.)  │
│  · Esta sem. │   "Hoy conviene esto"        │                 │
│  · Vencidas  │   priorizado por urgencia,   │   institución   │
│    (rust)    │   mezclando categorías:      │   seleccionada: │
│  · Reinsist. │                              │                 │
│    (rust)    │   01 Contactar Borda         │   Estado chip   │
│  · Esperando │      (vencida 14d)           │   Próxima acc.  │
│    (azul)    │      [WA] [Mail] [Copiar]    │   Timeline ↓    │
│  · Decisión  │                              │   · contactado  │
│    (lavanda) │   02 Reinsistir Manantiales  │   · respondió   │
│  · Confirm.  │      (sin resp. 7 días)      │   · pidió docs  │
│    (verde)   │      [WA] [Mail] ...         │                 │
│  · Activas   │                              │   Estudiantes   │
│  · Indefin.  │   03 Definir Hospital Ital.  │   PPS histor.   │
│  · Archiv.   │      (Hermes sugiere relanz.)│                 │
│              │                              │   Hermes:       │
│  + Buscar    │   ...                        │   "Esta resp.   │
│              │                              │   lento, conv.  │
│              │   Sort: vencido > reinsist > │   contactar     │
│              │   por finalizar > definir    │   antes"        │
│              │                              │                 │
└──────────────┴──────────────────────────────┴─────────────────┘
```

**Sub-vistas accesibles desde arriba de la bandeja:**

- **Bandeja** (default — la del "hoy")
- **Instituciones** (browseable, búsqueda como protagonista)
- **Calendario** (vista de timeline 2026)

## Sistema de color que esto desbloquea

Extiendo lo de Lanzador. Cada estado tiene rol semántico:

| Estado                  | Token                      | Por qué                |
| ----------------------- | -------------------------- | ---------------------- |
| Por contactar / Vencida | `--warn` rust              | "tenés que actuar, ya" |
| Reinsistir 5+ días      | `--warn` + pulse           | igual pero escalado    |
| Esperando respuesta     | `--accent` indigo          | monitoreando           |
| Pendiente decisión      | `--ai` lavanda             | Hermes puede ayudar    |
| Confirmadas             | `--ok` verde               | listo                  |
| Por finalizar pronto    | `--accent` + eyebrow ámbar | atención próxima       |
| Indefinida / falta dato | `--ink-4` mute + flag rojo | limpieza               |
| Archivada               | `--ink-4` mute             | histórico              |

Falta-dato como **flag chiquito** (sin teléfono, sin mail, sin referente, sin convenio) — no como categoría aparte sino como **insignia** sobre la card de esa institución. Eso convierte "Falta dato clave" de filtro a información visible en cada lugar.

## Preguntas para no especular

1. **Layout**: ¿Te tira el "tres paneles tipo mail client" como arriba, o preferís algo más vertical estilo Inicio extendido (sin ficha lateral, la ficha se expande inline al click)?
2. **La pregunta de apertura**: La bandeja "Hoy" mezcla todas las urgencias en una pila ordenada. ¿Mantenemos la mezcla, o separamos por banda (`Vencidas → Reinsistir → Por finalizar → Pendiente decisión`)?
3. **Contactar**: Click en `[WA]` o `[Mail]` desde una card — ¿abre **modal con preview editable** (asunto/mensaje/destinatario, botón enviar después de revisar), **side-sheet** desde la derecha, o copia al portapapeles y abre la app externa?
4. **Cambio de estado**: Cuando contactaste, ¿el sistema lo cambia solo a "Esperando respuesta" después de enviar, o lo cambiás manualmente con un dropdown en la card?
5. **Hermes proactivo**: ¿Hermes te muestra sugerencias **siempre** en la ficha, o solo cuando hace falta (institución demorada, falta dato, decisión pendiente)?
6. **Una sola más**: ¿La ficha lateral derecha la querés **siempre abierta** (con un placeholder cuando no hay institución seleccionada), o **solo aparece** al seleccionar (más espacio para la bandeja por defecto)?

Decime y arranco. Si querés que avance con mis defaults (3 paneles / bandeja mezclada / modal preview / cambio manual con auto-sugerencia / Hermes solo cuando hace falta / ficha siempre abierta con placeholder), te lo armo y ajustamos.

## User

<pasted_text name="Pasted text (107 lines)">
Sí, avancemos con tus defaults, pero con dos ajustes importantes.

1. Layout
   Vamos con tres paneles tipo mail client.

Es el formato correcto para Gestión porque esta sección no es informativa, es operativa. Necesito poder ver:

filtros/categorías a la izquierda,
cola de trabajo en el centro,
ficha institucional viva a la derecha.
Eso hace que Gestión se sienta como un escritorio de coordinación, no como una página con tarjetas sueltas.

2. Bandeja “Hoy”
   Quiero bandeja mezclada y priorizada, no separada por secciones.

La lógica debería ser:

vencido / contactar ahora,
reinsistir,
PPS por finalizar,
pendiente decisión,
falta dato clave,
esperando respuesta,
confirmadas.
Igual está bien que el rail izquierdo permita filtrar por cada categoría, pero la vista default tiene que ser una pila única: “hoy hacé esto en este orden”.

3. Contactar
   Click en WA o Mail debe abrir modal de preview editable.

Para mail:

destinatario,
asunto,
mensaje,
plantilla usada,
botón enviar.
Para WhatsApp:

teléfono,
mensaje editable,
botón abrir WhatsApp.
No quiero envío directo sin revisar.

4. Cambio de estado
   Después de enviar o abrir contacto, el sistema puede sugerir pasar a Esperando respuesta, pero prefiero confirmar con una acción visible.

Ejemplo:
“Mensaje preparado/enviado. ¿Marcar como Esperando respuesta?”
Botones:

Sí, marcar
No, dejar igual
Así automatiza sin sacarme control.

5. Hermes
   Hermes solo cuando hace falta, no todo el tiempo.

Tiene que aparecer como ayuda contextual:

institución demorada,
falta dato,
decisión pendiente,
respuesta lenta,
próxima a finalizar,
historial confuso.
No quiero ruido permanente. Quiero que sea útil cuando detecta algo.

6. Ficha lateral
   Ficha siempre abierta con placeholder.

Si no seleccioné nada, que diga algo tipo:
“Seleccioná una institución para ver historial, estudiantes, contactos y sugerencias.”

Cuando selecciono, muestra:

estado actual,
próxima acción,
teléfono/mail/referente,
timeline,
estudiantes vinculados,
PPS históricas,
notas,
sugerencia Hermes si aplica. 7. Falta dato
Coincido: falta dato no debería ser solo categoría. Tiene que ser flag visible en cada card:

sin teléfono,
sin mail,
sin referente,
sin convenio,
sin fecha fin.
Y también filtro desde el rail.

8. Registro
   Cada acción debería dejar rastro:

fecha,
tipo de contacto,
canal,
estado previo,
estado sugerido/cambiado,
nota breve.
Mi frase guía sería:

Gestión tiene que abrir como una bandeja diaria de trabajo: qué hago primero, con quién me contacto, por qué, qué mensaje uso y cómo queda registrado.

Con eso, que avance.
</pasted_text>

## Assistant

_[tool: write_file]_

Voy a armar Gestión con esos defaults. Estructura mínima:

- `wip/v3/Gestion.html` — entry con CSS extendido (mismo product register, tokens nuevos para flags)
- `wip/v3/gestion-data.jsx` — instituciones + PPS + timeline + recordatorios mockeados
- `wip/v3/gestion-app.jsx` — shell de 3 paneles
- `wip/v3/gestion-views.jsx` — rail, bandeja, ficha, modal de contacto

Reuso `lanzador-topbar.jsx` y `tweaks-panel.jsx`.

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: done]_

Listo el primer pase. Te lo abro.Listo, andá probando. Resumo qué construí, dónde se ve en la página, y lo que falta.

## Arquitectura — tres paneles tipo mail client

```
┌──────────┬───────────────────────────┬────────────────┐
│  RAIL    │   BANDEJA                  │   FICHA VIVA   │
│  240px   │   center · flexible        │   380px        │
│          │                            │                │
│  Vistas  │   "Hoy conviene esto"      │  Hospital      │
│  · Hoy   │   priorizado, mezclado     │  + Hermes nota │
│          │                            │  + flags rojos │
│  Cat.    │   01 Reinsistir Manant.    │  + contactos   │
│  ● PC 2  │      [WA] [Mail]           │  + cambiar     │
│  ● RE 1  │   02 Definir Austral       │    estado      │
│  ● PF 2  │      flags rojos           │  + crear       │
│  ● PD 2  │      [Hermes]              │    recordat.   │
│  ● FD 3  │   03 Contactar Borda       │  + timeline    │
│  ● ER 1  │   04 Hospital Italiano…    │  + estud.      │
│  ● CO 1  │   ...                      │  + PPS history │
│          │                            │  + notas       │
└──────────┴───────────────────────────┴────────────────┘
```

## Lo que funciona

**Rail (izquierda)**

- "Gestión" + "Escritorio de coordinación"
- Search "Buscar institución…"
- Vistas: "Hoy"
- Categorías: cada una con dot del color del estado (rust/azul/lavanda/verde/mute) + count en mono
- "Sincronizado" + versión abajo

**Bandeja (centro)**

- Header: eyebrow "BANDEJA DEL DÍA · MARTES 26 MAY" + título "Hoy conviene **esto**" + count
- 9 items mezclados ordenados por urgencia: reinsistir → por contactar → por finalizar → pendiente decisión → resto
- Cada card tiene: número (01, 02…) · chip-status · flags rojos de falta-dato (sin tel/mail/referente/convenio) · orientación · título de acción · razón (el "por qué") · detalle · → next step
- Acciones inline a la derecha: WhatsApp (verde), Mail (azul). Si no hay datos, botón Hermes.
- Botón "Pedirle a Hermes" en el header — Hermes solo cuando vos lo invocás o cuando la institución tiene caso (no en cada card)

**Ficha viva (derecha)**

- Placeholder cuando no seleccionás nada ("Seleccioná una institución para ver…")
- Cuando seleccionás: header con tipo + localidad + nombre bold + chips de orientación
- **Hermes nota** (lavanda) — solo cuando la institución tiene caso (Borda, Manantiales, Italiano, Ameghino, Austral, Liens lo tienen; Gutiérrez/INEBA/CESAC/Pensar no)
- **Falta dato clave** — bloque rust dashed con los flags + "Cargar datos faltantes"
- **Contactos** — referente + rol + tel + mail + convenio, con botones copiar
- **Cambiar estado** — chips clickeables: Esperando respuesta / Pendiente decisión / Confirmada / Archivada
- **Crear recordatorio**
- **Historial · línea de gestión** — timeline con dots de canal (mail/whatsapp/state) + "auto" para eventos del sistema
- **Estudiantes vinculados** (cuando hay)
- **PPS por cohorte** — historial
- **Notas** — texto libre

**Modal de contacto**

- Click en WA/Mail abre preview editable
- Mail: destinatario / asunto editable / mensaje editable / plantilla declarada
- WhatsApp: teléfono visible / mensaje editable / "Abrir WhatsApp"
- "Pedir reescritura a Hermes" en el footer (placeholder pero conceptualmente listo)
- **Después de enviar** → segundo modal: "¿Marcar como Esperando respuesta? · Sí, marcar / No, dejar igual"

**Tweaks**

- Cambiar categoría desde el panel (incluye atajos a cada filtro del rail para demo)
- Tema claro/oscuro
- Acento

## Sistema de color funcional

| Categoría                           | Color     | Tokens                   |
| ----------------------------------- | --------- | ------------------------ |
| Por contactar / Reinsistir          | rust      | `--warn`                 |
| Esperando respuesta / Por finalizar | indigo    | `--accent`               |
| Pendiente decisión                  | lavanda   | `--ai` (Hermes-friendly) |
| Confirmada / Activa                 | verde     | `--ok`                   |
| Indefinida / Archivada              | gris      | `--ink-4`                |
| Falta dato (flag)                   | rust pill | sobre cualquier card     |

Las orientaciones (Clínica/Educacional/Laboral/Comunitaria) coexisten en chips separados — sin chocar con el estado.

## Lo que NO está en este pase (lo charlamos si tira)

- **Vista "Instituciones"** browsable separada (ahora todo va via bandeja + ficha; el search del rail filtra; pero no hay un "ver todas las instituciones como tabla")
- **Calendario 2026** — la pestaña ya existe en el código pero acá no la armé todavía
- **Crear recordatorio** abre un formulario inline (ahora solo muestra toast)
- **"Cargar datos faltantes"** debería abrir el modal de edición del institución (placeholder)
- **Registro de acciones** persistente — toda acción tira toast pero no se guarda

## Para vos: lo que pediría revisar primero

1. **Densidad de la bandeja** — ¿9 cards mezclados es la cantidad correcta para "hoy"? ¿O preferís mostrar solo top 5-7 con un "ver más"?
2. **Ficha viva por defecto** — ahora abre con la institución del primer item (Manantiales si elegís "Hoy"). ¿Bien, o preferís que arranque con placeholder hasta que vos hagas clic?
3. **Cambio de estado** — los chips clickeables en la ficha funcionan como "shortcut" para cambiar estado sin pasar por contactar. ¿Tiene sentido, o lo sacamos para forzar el flujo correcto (contactar primero, después confirmar el cambio)?
4. **El modal de "Pedir reescritura a Hermes"** — todavía no hace nada. ¿Lo armo en el siguiente pase?
5. **"Falta dato"** como categoría del rail — la dejé pero tu intuición original era "flag visible en cada card, no categoría". El rail la incluye como filtro porque puede ser útil para "limpiar datos" como sesión dedicada. ¿La mantenemos o la sacamos del rail?

Decime y avanzo.

## User

Sí, yo le respondería con defaults claros para avanzar:

Bandeja del día
Mejor top 7 como máximo. Si hay más, mostrar Ver 2 más. Nueve cards ya empieza a sentirse como lista y no como “hoy hacé esto”.

Ficha viva por defecto
Que arranque con la primera acción seleccionada está bien. Para trabajo real ayuda más que un placeholder. Solo usar placeholder si no hay acciones.

Cambio de estado
Mantendría los chips, pero como acción secundaria con confirmación breve. No los sacaría. Sirven cuando hablaste por teléfono o resolviste algo fuera del sistema. Pero al hacer click debería pedir algo tipo: “Registrar cambio a Esperando respuesta”.

Hermes reescritura
Sí, armarlo en el siguiente pase. Pero con algo concreto: que abra un modal con el texto actual, opciones simples (más formal, más breve, más cálido, reinsistencia) y resultado editable.

Falta dato clave
Mantenerlo en el rail, pero sin tratarlo como prioridad principal. Coincido con la IA: es útil para una sesión de limpieza. En las cards debe seguir apareciendo como flag visible.

Instituciones
Sí o sí después agregaría vista Instituciones. La bandeja sirve para operar el día, pero necesitás una base navegable tipo CRM para buscar, auditar y ordenar contactos.

Calendario
Importante, pero no primero. Lo pondría después de que la bandeja funcione bien. El calendario debe mostrar PPS por finalizar, reinsistencias y cierres.

Persistencia
Esto es clave: toda acción debería guardar historial. Aunque sea en una tabla simple: fecha, institucion, accion, canal, estado anterior, estado nuevo, nota.

## Assistant

_[tool: snip]_

_[tool: str_replace_edit]_

Vamos. Implemento los 4 cambios concretos:

1. Bandeja cap 7 + "ver más"
2. Cambio de estado → confirmar "Registrar cambio a X"
3. Modal reescritura Hermes (más formal / más breve / más cálido / reinsistencia)
4. Registro de acciones persistente (sesión)

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: done]_

Listo el segundo pase. Resumo qué cambió:

## 1. Bandeja con cap

**"Hoy"** ahora muestra **máximo 7 cards** ordenadas por urgencia. Si hay más (en este caso, 9), aparece al final un botón **"Ver N más"** con borde dashed. El header del centro lo refleja: _"7 acciones priorizadas · 9 cosas en gestión"_.

Las otras vistas (Por contactar, Reinsistir, etc.) muestran todo sin cap — porque ahí no estás operando, estás revisando una categoría.

## 2. Cambio de estado con confirmación

Click en cualquier chip de **"Cambiar estado"** dentro de la ficha (Esperando respuesta / Pendiente decisión / Confirmada / Archivada) abre un modal de confirmación:

- Header: _"Registrar cambio de estado"_ · nombre de institución
- **Pill de transición**: `[Estado actual]` → `[Estado nuevo]` — usa los chips de color de cada uno
- **Nota breve opcional** — campo de texto para anotar contexto ("hablé con María por teléfono, confirma para julio")
- Aviso meta: _"Se va a registrar en el historial con fecha · hora · estado anterior"_
- Botones: **Cancelar** / **Registrar cambio**

Después de confirmar, el ítem cambia de estado en la bandeja (lo ves moverse de categoría) y la acción aparece en el historial de la ficha con badge **"este turno"** verde.

## 3. Modal de reescritura Hermes

Dentro del modal de contacto (Mail o WhatsApp), el botón **"Pedir reescritura a Hermes"** ahora abre un modal con:

- 4 tarjetas de estilo:
  - **Más formal** — institucional, vocabulario cuidado
  - **Más breve** — mismo mensaje, mitad de palabras
  - **Más cálido** — empático, personal
  - **Reinsistencia** — recordatorio cortés sin insistir feo
- Al clickear una, muestra el shimmer "Hermes está reescribiendo…" durante ~1s
- Después aparece el texto propuesto en un textarea **editable**
- Botones: **Cancelar** / **Aplicar al mensaje**
- Al aplicar, vuelve al modal de mail/wa con el mensaje reescrito ya en el body — y vos podés seguir editando antes de mandar

Cada estilo tiene un mock pre-armado distinto. En producción ese `setTimeout` se reemplaza por una llamada a Claude.

## 4. Historial persistente de la sesión

Toda acción se registra y aparece arriba del historial existente en la ficha:

- **Enviar mail/wa** → entrada con canal + cambio de estado si confirmaste
- **Cambiar estado manual** → entrada con `prev → next` + nota opcional
- **Crear recordatorio** → entrada con descripción

Las entradas del turno tienen un badge **"este turno"** verde para distinguirlas del historial pre-existente. Si refrescás la página se pierden (no persisten a disk en este prototipo), pero la estructura está lista para mapear directo a una tabla `gestion_log` con `fecha · institución · acción · canal · estado_anterior · estado_nuevo · nota`.

## Probá específicamente esto

1. Abrí cualquier card en la bandeja → seleccioná la ficha de la derecha
2. Click en un chip de "Cambiar estado" (ej. "Esperando respuesta") → te abre el confirm modal con la transición visible
3. Confirmá con una nota — fijate cómo aparece en el historial con badge "este turno"
4. Click en WhatsApp o Mail en cualquier card → modal preview editable
5. Dentro del modal, click en "Pedir reescritura a Hermes" → probá los 4 estilos
6. Aplicá uno → volvés al mail con el nuevo texto
7. Mandalo → confirm "¿Marcar como Esperando respuesta?" → si decís sí, ves en el historial dos entradas nuevas (envío + cambio)

## Próximos pases que tengo identificados

Cuando me digas:

- **Vista "Instituciones"** como CRM browseable (lista navegable, filtros, vista de tabla, no solo por bandeja)
- **Calendario 2026** con PPS por finalizar, reinsistencias y cierres
- **Persistencia real** del log a backend (cuando definamos esquema)
- **Crear recordatorio** con formulario inline (ahora es directo, solo toast)
- **"Cargar datos faltantes"** abre form de edición de institución

Decime qué viene.

## User

donde esta ubicada gestion.html? no lo veo en : C:\Users\Blas\_\Downloads\Mi Panel Antigravity\consulta-pps-uflo\Pagina PPS

## Assistant

_[tool: snip]_

Está adentro de **este proyecto** (la sandbox donde estamos trabajando), no en tu carpeta local.

**Ruta dentro del proyecto:** `wip/v3/Gestion.html`

La carpeta `Pagina PPS` que tenés en `C:\Users\Blas_\Downloads\Mi Panel Antigravity\consulta-pps-uflo\Pagina PPS` es la que **vos** me copiaste al principio (con el `Inicio v2.html`, `Lanzador.html`, etc.). Cuando empecé a iterar, armé una nueva versión en `wip/v3/` para no pisar tus archivos originales y poder comparar.

## Para llevarte estos archivos a tu local

Te genero un zip con toda la carpeta `wip/v3` (incluye los 3 HTML — Lanzador rediseñado, Gestion nuevo, y los JSX que dependen de cada uno):

_[tool: present_fs_item_for_download]_

Bajalo, descomprimilo dentro de tu carpeta `Pagina PPS` (o donde prefieras), y abrí `Gestion.html` directo en el navegador.

Adentro del zip vas a encontrar:

```
wip/v3/
├── Lanzador.html           ← Lanzador rediseñado (product register)
├── Gestion.html            ← Gestión nueva (3 paneles)
├── gestion-data.jsx        ← Mock de instituciones, items, plantillas
├── gestion-views.jsx       ← Rail, Bandeja, Ficha, modales
├── gestion-app.jsx         ← Shell + state + log
├── lanzador-app.jsx        ← Lanzador shell
├── lanzador-data.jsx       ← Mock de convocatorias
├── lanzador-sidebar.jsx    ← Sidebar editado
├── lanzador-topbar.jsx     ← Topbar (compartido con Gestión)
├── lanzador-views.jsx      ← Vistas del Lanzador
└── tweaks-panel.jsx        ← Panel de tweaks
```

Importante: los HTML cargan los `.jsx` con rutas **relativas**, así que mantenelos todos juntos en la misma carpeta. Si los movés, asegurate de que estén al mismo nivel que el HTML que querés abrir.

## User

la barra de gestion tiene que replegarse igual que la de lanzador si quiero

## Assistant

_[tool: snip]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: eval_js_user_view]_

Listo. La barra de Gestión ahora se repliega igual que la del Lanzador.

## Cómo funciona

- **Botón de chevron** arriba a la derecha del título "Gestión" → la pliega a un rail slim de 56px
- En modo plegado: el botón es un `chevron_right` arriba que la vuelve a abrir
- **Persiste en localStorage** entre sesiones (`gestion-rail-collapsed`)

## Qué se ve en modo plegado

- Botón de expandir arriba
- Cada categoría como **dot del color del estado + count** (similar al Lanzador)
- "Hoy" usa el icono `today` en vez de un dot porque es vista, no estado
- La categoría activa queda con fondo gris + filete negro a la izquierda
- Tooltip al hover con `Categoría · count`
- Dot verde de "sincronizado" al fondo

## Y el ficha hace lo mismo?

La ficha de la derecha por ahora no se repliega — pero si querés, le sumo el mismo gesto (chevron arriba del nombre de la institución, plegada queda como una columna slim con avatar/iniciales + dot del estado). Decime si lo agrego.

## User

Yo le respondería:

Avancemos primero con Vista Instituciones como CRM browseable.

Motivo: Gestión ya funciona como bandeja diaria, pero falta la base navegable para buscar cualquier institución aunque no tenga acción urgente. Esa vista debería permitir limpiar datos, ver historial, detectar faltantes y abrir la ficha viva sin depender de la bandeja.

Orden que propongo:

Instituciones CRM
Lista/tabla con búsqueda fuerte, filtros por orientación, estado, convenio, faltantes, última actividad y próxima acción.

Cargar datos faltantes
Desde card o ficha, abrir form de edición de institución.

Crear recordatorio
Form inline con fecha, tipo, nota y vínculo a institución/PPS.

Persistencia real
Definir esquema para log, recordatorios y cambios de estado.

Calendario 2026
Cuando ya existan recordatorios y fechas confiables, mostrar PPS por finalizar, reinsistencias y cierres.

## Assistant

_[tool: snip]_

_[tool: str_replace_edit]_

Vamos por Instituciones CRM.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: sleep]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: done]_

Listo el primer punto del orden que propusiste.

## Vista Instituciones — CRM browseable

**Cómo accederla:** arriba de la bandeja hay un tab strip nuevo: `Bandeja` / `Instituciones` / `Calendario` (este último marcado como "PRONTO"). Click en Instituciones cambia el centro al CRM, dejando el rail izquierdo y la ficha derecha igual.

**Lo que ves:**

- **Header** del CRM con count total + filtros activos visibles
- **Búsqueda fuerte** en una sola caja: nombre / referente / localidad / tel / mail
- **Filter chips** al lado de la búsqueda: Orientación (con dot del color) y Convenio (Vigente / Por renovar / Vencido). Cada filtro abre dropdown
- **Tabla** con 6 columnas, headers sortables (click en cualquier columna ordena, segunda click invierte):
  | Columna | Qué muestra |
  |---|---|
  | **Institución** | Nombre + orientación chips (con color) + localidad |
  | **Estado actual** | Chip del estado de gestión actual, o `—` si no hay item activo |
  | **Última actividad** | Último evento del log o del historial · fecha |
  | **Próxima acción** | El `nextStep` del item de bandeja si existe |
  | **Faltantes** | Iconos chiquitos por cada flag faltante (sin tel/mail/ref/convenio) o "completo" en verde |
  | **Acciones** | WhatsApp/Mail directo + más |

**Coordinación con el resto:**

- **El rail sigue funcionando como filtro**: si tenés activo "Por contactar" en el rail, el CRM se filtra a esas instituciones. Aparece un chip negro arriba que dice "Por contactar ×" para sacarlo
- **Click en una fila** abre la ficha de esa institución a la derecha (el panel persistente)
- **Cambiar a Bandeja** mantiene la institución seleccionada — la ficha sigue mostrando la misma
- El badge del tab "Instituciones (10)" muestra el total; "Bandeja (7)" muestra el conteo de hoy

**Datos en cada institución (computados en runtime):**

- `currentState` — derivado del item de bandeja matching (con overrides aplicados si cambiaste estado en sesión)
- `_lastActivity` — entrada más reciente del log de sesión, o si no hay, el primer evento del historial pre-existente
- `_nextAction` — el `nextStep` del item asociado en la bandeja

## Lo que pediste y NO está todavía

- **#2 Cargar datos faltantes** — el flag "Sin teléfono / sin mail / etc" se ve, pero clickearlo no abre form (lo armo en el siguiente pase)
- **#3 Crear recordatorio** — sigue siendo toast, no form inline
- **#4 Persistencia real** — schema definido pero log vive en memoria de la sesión
- **#5 Calendario 2026** — tab "PRONTO"

## Probá específicamente

1. Click en tab "Instituciones" — el centro cambia, el rail+ficha siguen
2. Buscá "borda" o "neuquén" — filtra al instante
3. Click en filtro "Orientación" → elegí Clínica → solo quedan las clínicas
4. Click en "Faltantes" en el header (columna) — ordena por cantidad de campos faltantes (asc/desc)
5. Click en una fila — se abre la ficha de esa institución a la derecha. Cambiá su estado desde la ficha → cambio aparece en CRM y en bandeja
6. Volvé a "Bandeja" — la institución sigue seleccionada en la ficha

¿Avanzo con #2 (form de cargar datos faltantes), o querés ajustar algo del CRM primero?

## User

dale, avanza con esos pasos y te doy una correccion antes de que me olvide, el color de clinica es el verde (el que psusite en educacional) y el de eduacional es el azul (el que pusiste en clinica) hay que intercambiarlos

## Assistant

_[tool: snip]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Colores swapeados. Voy con #2 (form de cargar datos), #3 (recordatorio inline) y #4 (esquema de persistencia).

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: write_file]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: save_screenshot]_

_[tool: show_html]_

_[tool: sleep]_

_[tool: done]_

Listo, 4 cambios en este pase:

## 1. Colores de orientación swapeados ✓

- **Clínica**: ahora verde (`#3D7A4B`)
- **Educacional**: ahora azul (`#2E5BA8`)
- Laboral y Comunitaria sin cambio
- Aplicado en **Gestión y Lanzador** (light + dark)

## 2. Cargar datos faltantes — form de edición

Click en **"Cargar datos faltantes"** dentro del bloque rust de la ficha (o en cualquier institución desde el CRM) abre un modal de edición:

- **Campos**: Nombre, Tipo, Localidad, Referente, Rol, Teléfono, Mail, Convenio, Notas
- Los campos que están faltantes **se marcan con un badge rojo "faltante"** y border rojizo
- Teléfono y Mail van en mono (es info de contacto, no prosa)
- Al guardar: la institución se actualiza en sesión + se loguea como acción `edit` con la lista de campos modificados ("Actualizados: telefono, mail")
- En la ficha, los flags rojos desaparecen y el badge "este turno" aparece en el historial

## 3. Crear recordatorio — form inline

Click en **"Crear recordatorio"** en la ficha abre un modal con:

- **Tipo**: 4 tarjetas grandes con icono + hint
  - Contactar · Llamar o WhatsApp
  - Seguimiento · Continuar gestión activa
  - Vencimiento · Antes de cierre
  - Acreditación · Tras finalizar PPS
- **¿Cuándo?**: 5 chips presets (Mañana, En 5 días, En 1 semana, En 2 semanas, En 1 mes) **+** campo de fecha custom
- **Preview** abajo: "→ Te aviso el **viernes 30 de mayo** · en 4 días"
- **PPS asociada** (opcional): dropdown con las cohortes de esa institución
- **Nota** (obligatoria — botón disabled si está vacía)
- Al guardar: se agrega a `reminders[]` en sesión + se loguea como `reminder` + toast

## 4. Persistencia · esquema

Te dejé el documento de spec en **`wip/v3/SCHEMA_PERSISTENCIA.md`**. Resumen:

- **`gestion_log`** — tabla nueva. Cada acción de la app (`sent`, `state`, `edit`, `reminder`) se persiste con `institucion_id`, `usuario_id`, `payload jsonb`, `estado_anterior/nuevo`, `nota`, `pps_id` opcional, `created_at`
- **`gestion_recordatorios`** — recordatorios programados con `tipo`, `vencimiento`, `estado` (pendiente/completado/descartado)
- Sin tocar `lanzamientos_pps` ni `instituciones` — solo agregamos log + program

El doc también propone cómo Hermes consume `gestion_log` para derivar "tiempos típicos de respuesta", "patrones de día/hora", "tasa de respuesta por plantilla" — alimento para la nota proactiva en la ficha.

## Próximo pase

Te quedan estos pendientes del orden original:

- **Calendario 2026** — el tab "PRONTO" → vista con PPS por finalizar, recordatorios próximos, cierres de inscripción
- (Y cualquier ajuste sobre lo de hoy)

¿Avanzo con Calendario, o querés revisar primero estos 4?

## User

Sí, sigamos con Calendario 2026. Ya veo sólida la base de Gestión: bandeja, ficha, edición, recordatorios y log. Ahora el calendario tiene sentido porque puede mostrar acciones reales: PPS por finalizar, recordatorios próximos, cierres de inscripción, relanzamientos confirmados y vencimientos de convenio.

Me gustaría que Calendario no sea una agenda decorativa, sino una vista operativa por semanas/meses con foco en “qué se viene” y que cada evento abra la ficha de institución/PPS correspondiente.

Primero vista mensual/agenda simple, después filtros por tipo de evento y recién después detalles más finos.

## Assistant

_[tool: snip]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: sleep]_

_[tool: get_webview_logs]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: show_html]_

_[tool: sleep]_

_[tool: done]_

Listo el Calendario. Hacé click en el tab **Calendario** arriba del bandeja (ya no dice "PRONTO", ahora tiene un badge con la cantidad de eventos futuros).

## Estructura

**Header**

- Eyebrow: `Calendario operativo · 2026`
- Título: nombre del mes en bold ("Mayo 2026")
- Subtítulo: cuántos eventos hay este mes
- Botones de navegación: `←`, `Hoy`, `→`
- **Leyenda** con 6 tipos de evento + sus colores

**Grid mensual** (6 filas × 7 columnas, Lun-Dom)

- Cada celda muestra el día + hasta 3 eventos como mini-chips coloreados
- Si hay más de 3 eventos, "+N más" abajo
- **Hoy** se distingue con celda negra sólida (alto contraste)
- Días del mes anterior/siguiente quedan atenuados
- Días pasados con menor opacidad
- Click en una celda la selecciona; click en un chip de evento abre la ficha de esa institución a la derecha

**Agenda — Próximos eventos** (debajo del grid)

- Fondo gris claro para diferenciarlo
- Los próximos 14 eventos a partir de hoy, agrupados por fecha
- Cada grupo de fecha tiene: día (capitalizado) + "hoy" / "mañana" / "en N días"
- Cada evento es una **card clickeable** con icono coloreado, título, badge del tipo, detalle, y flecha → para abrir ficha

## Tipos de evento + colores

| Tipo                       | Color   | Cuándo aparece                                |
| -------------------------- | ------- | --------------------------------------------- |
| **PPS termina**            | azul    | activas que entran en los próximos 30-45 días |
| **Cierre inscripción**     | rust    | convocatorias que cierran                     |
| **Recordatorio**           | lavanda | los que creás vos en la ficha                 |
| **Inicio / relanzamiento** | verde   | cohortes confirmadas que arrancan             |
| **Convenio vence**         | rust    | fechas críticas de convenio                   |
| **Acreditación**           | verde   | SAC, plazos finales de acreditación           |

## Datos

15 eventos pre-cargados distribuidos en May-Agosto 2026:

- May 27 — Cierra inscripción CESAC 8
- May 29 — Cierra inscripción INEBA
- May 31 — Hospital Italiano termina
- Jun 02 — Reinsistir Manantiales
- Jun 05 — Confirmar fechas Liens
- Jun 10 — Abre inscripción PPS Pediátrica
- Jun 15 — Confirmar Borda
- Jun 20 — Convenio Austral vence
- Jun 25 — Cierra inscripción Pediátrica
- Jun 28 — INEBA encuentro inicial
- Jul 01 — Inicio Pensar ASER
- Jul 15 — Pensar ASER encuentro inicial
- Jul 28 — Encuentro inicial PPS Pediátrica
- Ago 01 — Inicio PPS Pediátrica
- Ago 15 — Acreditación SAC Italiano

**Y** — los recordatorios que crees en sesión desde la ficha **se agregan automáticamente** al calendario con tipo "recordatorio" en lavanda.

## Probá

1. Click en **Calendario** — abrí mayo
2. Mirá el grid: 27, 29, 31 may tienen chips, 26 (hoy) está en negro
3. Hacé click en cualquier chip de evento → la ficha de esa institución se abre a la derecha
4. Scrolleá hasta la agenda abajo → los próximos eventos con "hoy", "mañana", "en N días"
5. Cambiá a junio con la flecha → ves la ola de Junio (8 eventos)
6. Volvé con "Hoy"
7. Bonus: andá a **Bandeja**, abrí la ficha de cualquier institución, clickeá **"Crear recordatorio"**, generá uno para "en 5 días" → volvé al **Calendario** y vas a ver tu recordatorio aparecer ese día en lavanda

## Lo que falta (próximo pase si querés)

- **Filtros por tipo** (chips clickeables en la leyenda: ocultar/mostrar PPS termina, cierres, recordatorios, etc.) — tu nota era "después filtros por tipo de evento"
- **Vista semanal** o **vista lista solamente**
- **Eventos abarcando múltiples días** (PPS que empieza y termina — se podrían ver como una barra horizontal)
- **Persistir vista activa** (que recuerde si estabas en bandeja/inst/calendario)

¿Avanzo con filtros + persistir vista activa en el próximo pase, o querés tocar algo de lo que acabamos de hacer?
