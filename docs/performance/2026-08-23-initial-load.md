# Rendimiento de carga inicial — 2026-08-23

## Resultado

La carga fría del login móvil mejoró de forma medible sin cambiar el flujo funcional ni la base de datos.

| Métrica                           |      Antes |  Después | Variación |
| --------------------------------- | ---------: | -------: | --------: |
| JavaScript de entrada, raw        | 1.045,0 KB | 656,7 KB |    −37,2% |
| JavaScript de entrada, gzip       |   315,9 KB | 194,6 KB |    −38,4% |
| CSS inicial, raw                  |   443,0 KB | 256,9 KB |    −42,0% |
| Transferencia de recursos         |   394,7 KB | 241,5 KB |    −38,8% |
| DOMContentLoaded, mediana         |   2.779 ms | 1.834 ms |    −34,0% |
| First Contentful Paint, mediana   |   3.212 ms | 2.216 ms |    −31,0% |
| Largest Contentful Paint, mediana |   3.596 ms | 2.688 ms |    −25,3% |
| Total Blocking Time, mediana      |     734 ms |   493 ms |    −32,8% |
| Cumulative Layout Shift           |     0,0008 |   0,0008 |   estable |
| Solicitudes de red                |          8 |        7 |    −12,5% |

## Método reproducible

- Ruta: `/#/login` del build productivo servido por `vite preview`.
- Chromium headless, viewport móvil `390 × 844 @2x`.
- Caché fría y service workers bloqueados para aislar cada ejecución.
- CPU ralentizada 4×.
- Red: 150 ms de latencia, 1,6 Mbps de descarga y 750 Kbps de subida.
- Espera de 4 segundos después de `DOMContentLoaded` para capturar LCP, CLS y tareas largas.
- Línea base: 5 ejecuciones. Resultado final: 7 ejecuciones.
- Los valores de tiempo son medianas; el script también informa mínimo, máximo y p75.

Comandos:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
npm run perf:benchmark -- --url http://127.0.0.1:4173/#/login --iterations 5 --label local
```

## Cuellos de botella encontrados

1. El chunk común cargaba pantallas que no pertenecen al arranque: detalle de convocatoria, formulario de inscripción y edición administrativa de estudiantes.
2. La ruta administrativa de estudiante importaba desde `App.tsx` providers de Moodle, validaciones Zod y servicios de datos para todas las rutas.
3. Firebase Messaging se importaba de forma estática aunque la mayoría de las sesiones no usa la configuración de push durante el arranque.
4. React Query Devtools formaba parte del build productivo.
5. El header legacy y su árbol de `framer-motion` se evaluaban incluso en login y en vistas con topbar propia.
6. El aviso PWA utilizaba `framer-motion` para una única transición que ya existía como animación CSS compartida.

## Cambios aplicados

- Code splitting para el detalle de convocatoria, el modal de datos incompletos y la ruta administrativa de estudiante.
- Aislamiento de `StudentPanelProvider` y `MoodleGradeSyncProvider` dentro de la única ruta que los necesita.
- Imports dinámicos y cacheados de Firebase App/Messaging; la descarga ocurre al inicializar FCM.
- React Query Devtools limitado a desarrollo mediante import dinámico eliminable por Vite.
- Header legacy lazy-loaded y sólo solicitado cuando la ruta realmente lo muestra.
- Reutilización de `animate-fade-in-up` en el aviso PWA, eliminando su dependencia directa de `framer-motion`.

## Verificación

- `npm run type-check`: correcto.
- ESLint focalizado en todos los archivos modificados: correcto.
- Prettier focalizado: correcto.
- `npm run build`: correcto.
- Login renderizado en 390 × 844 y 1440 × 900: sin regresiones visuales observadas.
- Consola del login con service worker habilitado: sin errores.
- Detector mecánico de interfaz de Impeccable: sin hallazgos.

El lint global sigue incluyendo un worktree ajeno bajo `.claude/worktrees/` y falla por cientos de archivos que no pertenecen a este cambio. Por eso la validación de lint se ejecutó de forma focalizada sobre los archivos tocados.

## Alcance y trabajo futuro

La mejora reduce el costo común que afecta a todas las rutas. No se modificaron consultas, RLS ni schema de Supabase, porque el perfil inicial mostró que el cuello dominante era descarga y ejecución de frontend.

Los mayores artefactos restantes (`pdf.worker`, React PDF/fuentes y `exceljs`) ya están diferidos y sólo se descargan al abrir las funciones correspondientes. Para optimizarlos con rigor hace falta un benchmark separado de exportación PDF, previsualización y generación de Excel con datos representativos.
