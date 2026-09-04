# Carga tipográfica y CSS de Métricas — 2026-09-03

## Alcance

Medición local y sin datos productivos de dos cambios reversibles:

1. render inmediato con fuentes de sistema mientras Google Fonts carga de forma no bloqueante;
2. extracción semánticamente equivalente de `metricasV3Styles.ts` a un asset CSS asociado al chunk lazy de Métricas.

Perfil del benchmark: Chromium, viewport 390×844, DPR 2, CPU 4×, latencia 150 ms y 1,6 Mbps. Cada mediana usa tres corridas frías.

## Resultados de carga

| Variante                                          | FCP mediano | LCP mediano | DCL mediano | TBT mediano | Requests | Transferencia |
| ------------------------------------------------- | ----------: | ----------: | ----------: | ----------: | -------: | ------------: |
| Bootstrap anterior                                |     2308 ms |     2636 ms |   1886,7 ms |      592 ms |        7 |      242414 B |
| Render inmediato + hoja consolidada, confirmación |     3000 ms |     3176 ms |     2178 ms |     1291 ms |        4 |      240146 B |

La segunda serie reduce tres requests y 2268 bytes, pero la mediana temporal empeoró en una máquina con carga concurrente. El entry chunk y sus bytes propios se mantuvieron idénticos, por lo que la serie no permite atribuir la regresión al cambio de fuentes. El gate temporal de WP-02 quedó **inconcluso** en esa corrida y se repitió más tarde el mismo día.

## Repetición sobre host estable — 2026-09-03, 22:00

La primera serie se tomó con el host al 49 % de CPU y 0,81 GB libres de 15,4 GB, con el commit en 25,84 GB sobre un límite de 30,35 GB. Antes de repetir se cerró Opera y el preflight dio CPU 25,8 % de promedio (desvío 6,4) y 6,28 GB libres de promedio.

La comparación se rehízo aislando una sola variable. La variante «antes» es el árbol actual con el bootstrap tipográfico restaurado —bloque anti-FOUC, script de `fonts-loading`, regla de visibilidad asociada y las cuatro hojas separadas— pero **sin** reintroducir el import map ni los permisos `esm.sh`, que pertenecen a WP-01. Ambos builds se verificaron sobre el HTML emitido: la variante «antes» conserva seis ocurrencias de `fonts-loading` y cuatro hojas; la actual, cero y una. Ninguna de las dos contiene import map.

Las corridas se intercalaron en bloques A-B-A-B de cinco iteraciones cada uno, cinco de cada variante por bloque, para que una deriva del host afecte a ambas por igual. Total: diez corridas frías por variante, mismo perfil de throttling.

| Métrica       | Antes (bootstrap) | Después (actual) |   Delta | Permutación |
| ------------- | ----------------: | ---------------: | ------: | ----------: |
| FCP mediano   |           2312 ms |          2342 ms |  +1,3 % |    p = 0,36 |
| LCP mediano   |           2658 ms |          2674 ms |  +0,6 % |    p = 0,76 |
| DCL mediano   |         1891,9 ms |        1865,1 ms |  −1,4 % |    p = 0,39 |
| TBT mediano   |            582 ms |         649,5 ms | +11,6 % |    p = 0,22 |
| Requests      |                 7 |                4 | −42,9 % |           — |
| Transferencia |         242 131 B |        239 863 B |  −0,9 % |           — |

Los rangos se superponen casi por completo: FCP entre 2244 y 2448 ms antes, entre 2184 y 2456 ms después; LCP entre 2592 y 2840 ms antes, entre 2548 y 3512 ms después. La prueba de permutación sobre la diferencia de medianas, con 200 000 remuestreos, no distingue ninguna de las cuatro métricas temporales del ruido.

La conclusión es que la regresión de +30 % en FCP de la primera serie era carga del host, no el cambio de fuentes. Sobre un host estable el cambio no mejora ni empeora FCP/LCP de forma medible, y conserva la reducción de tres requests y 2268 bytes. **El gate temporal de WP-02 queda satisfecho**: no hay regresión medible, y el cambio se sostiene por accesibilidad, tolerancia a fallos de red y menos requests, no por una mejora de tiempo que la evidencia no respalda.

Los JSON crudos quedan en `tmp/performance/2026-09-03-ab-{after,before}-block{1,2}.json`, evidencia local ignorada.

La prueba de resiliencia sí fue determinista: bloqueando Google Fonts durante `DOMContentLoaded`, el `body` permaneció visible, sin la clase `fonts-loading`, y ya contenía `Mi Panel`. El bootstrap anterior podía ocultar toda la aplicación hasta 1,2 segundos.

## Paridad visual

Se compararon seis capturas antes/después: desktop 1440×900, tablet 1024×768 y mobile 390×844, en light y dark.

- desktop y tablet: SSIM 1,000000;
- mobile light: SSIM 0,997830;
- mobile dark: SSIM 0,997981;
- CLS observado: aproximadamente 0,00076;
- no se observaron iconos convertidos en texto ni contenido oculto.

Los PNG y JSON crudos permanecen bajo `tmp/performance/` y `tmp/visual/`: son evidencia local ignorada, no artefactos versionados.

## CSS estático de Métricas

| Artefacto de la superficie |                     Antes |                   Después |
| -------------------------- | ------------------------: | ------------------------: |
| JS `MetricsView`           | 152,05 kB / 44,86 kB gzip | 128,74 kB / 39,53 kB gzip |
| CSS lazy dedicado          |                         — |   17,96 kB / 3,82 kB gzip |
| Total superficie           | 152,05 kB / 44,86 kB gzip | 146,70 kB / 43,35 kB gzip |

El CSS deja de viajar como string JavaScript, conserva el namespace `.metricas-v3` y Vite lo emite junto con la superficie lazy. La reducción combinada es de aproximadamente 5,35 kB raw y 1,51 kB gzip. El build final no presenta errores de sintaxis CSS.

## Decisión

Se conserva el render inmediato por accesibilidad y tolerancia a fallos de red, y la extracción CSS por su mejora verificable de empaquetado. La repetición sobre host estable descartó la regresión temporal, así que WP-02 queda cerrado. Si en algún momento se quiere una cota más fina que «indistinguible del ruido», hay que medir en CI con un runner dedicado: este host no baja de un desvío de ±100 ms en FCP.

## Code-splitting del visor PDF

El build detectó que `PdfViewer` se importaba dinámicamente desde `FilePreview`, pero también se reexportaba de forma estática desde el barrel `preview/index.ts`. No había consumidores de esa reexportación, por lo que se retiró.

| Artefacto               |                      Antes |                    Después |
| ----------------------- | -------------------------: | -------------------------: |
| `SolicitudesManager` JS | 561,70 kB / 163,86 kB gzip |  131,30 kB / 36,49 kB gzip |
| `PdfViewer` JS lazy     |            incluido arriba | 429,19 kB / 127,23 kB gzip |

La funcionalidad no cambia, pero aproximadamente 429 kB raw / 127 kB gzip dejan de cargarse hasta que se abre un PDF. El warning de importación estática y dinámica desapareció del build final.
