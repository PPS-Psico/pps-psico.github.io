# Manifiesto de artefactos del repositorio — 2026-09-03

## Retirados del índice, conservados en disco

Se retiraron del índice de Git 162 archivos generados en `tmp/` y
`output/` (16.356.381 bytes), además de
`tsconfig.node.tsbuildinfo`. No se borró ningún archivo local y no se reescribió
el historial. Todos siguen recuperables desde el commit anterior.

| Grupo                                                                        | Archivos |     Bytes |
| ---------------------------------------------------------------------------- | -------: | --------: |
| `output/pdf/informe-direccion-pps-agostina-reale-berrueta-2026-fixture.pdf/` |        1 |    48.764 |
| `output/pdf/informe-gestion-pps-sede-comahue-2024-2026-fixture.pdf/`         |        1 |    31.086 |
| `output/pdf/informe-pps-sede-comahue-2024-fixture.pdf/`                      |        1 |    50.805 |
| `output/pdf/informe-pps-sede-comahue-2025-fixture.pdf/`                      |        1 |    30.646 |
| `output/pdf/informe-pps-sede-comahue-2026-fixture.pdf/`                      |        1 |    59.490 |
| `output/pdf/rendered/`                                                       |       10 |   909.656 |
| `tmp/pdfs/capacity-alignment-qa/`                                            |        1 |    90.594 |
| `tmp/pdfs/director-active-demand/`                                           |        6 |   733.656 |
| `tmp/pdfs/director-report-final/`                                            |        7 |   983.058 |
| `tmp/pdfs/director-report-final-2/`                                          |        6 |   954.416 |
| `tmp/pdfs/director-report-qa/`                                               |        7 |   902.218 |
| `tmp/pdfs/director-report-qa-2/`                                             |        7 |   919.731 |
| `tmp/pdfs/director-report-qa-3/`                                             |        6 |   882.592 |
| `tmp/pdfs/director-report-qa-4/`                                             |        3 |   561.590 |
| `tmp/pdfs/professional-report-2024/`                                         |        8 | 1.009.570 |
| `tmp/pdfs/professional-report-2025-comparison-qa/`                           |        1 |   141.235 |
| `tmp/pdfs/professional-report-2026-final/`                                   |        8 |   670.021 |
| `tmp/pdfs/professional-report-management/`                                   |        5 |   505.772 |
| `tmp/pdfs/professional-report-type-qa/`                                      |        4 |   392.496 |
| `tmp/pdfs/report-2026-final/`                                                |        4 |   198.200 |
| `tmp/pdfs/report-2026-review/`                                               |        7 |   631.052 |
| `tmp/pdfs/report-2026-review-2/`                                             |        7 |   631.237 |
| `tmp/pdfs/report-2026-review-3/`                                             |        4 |   300.586 |
| `tmp/pdfs/report-2026-review-4/`                                             |        4 |   228.283 |
| `tmp/pdfs/report-2026-review-5/`                                             |        7 |   198.717 |
| `tmp/pdfs/report-2026-review-6/`                                             |        4 |   190.140 |
| `tmp/pdfs/uflo-brand-manual/`                                                |       41 | 4.100.770 |

Política: `tmp/` y `output/` ya estaban ignorados; `*.tsbuildinfo` queda
ignorado como caché regenerable de TypeScript.

## Conservados y todavía rastreados

| Ruta                                          | Decisión                                                          |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `pps-uflo/`                                   | Conservar: prototipo y referencias del flujo de diseño.           |
| `design.tar.gz`                               | Conservar hasta confirmar que el prototipo extraído lo reemplaza. |
| `design_new.tar.gz`                           | Conservar por la misma razón.                                     |
| `design_response.bin`                         | Conservar hasta documentar su procedencia/formato.                |
| `resguardo-panel-estudiante-2026-07-02.patch` | Conservar como resguardo explícito.                               |
| `Pagina PPS/`                                 | Conservar fuera de Git según la regla existente de `.gitignore`.  |

Los tres paquetes de diseño suman aproximadamente 4,3 MB, pero su regeneración
no está documentada. Por eso no se retiraron automáticamente.
