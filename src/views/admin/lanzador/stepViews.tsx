/**
 * lanzador/stepViews — Barrel de las vistas por estado del pipeline del Lanzador.
 *
 * Cada vista vive en su propio archivo (relocalización del antiguo monolito) y
 * se re-exporta acá para que el orquestador (`LanzadorView`) las importe desde
 * un único punto.
 */
export { default as BorradorView } from "./BorradorView";
export { default as SeleccionView } from "./SeleccionView";
export { default as SeguroView } from "./SeguroView";
export { default as ActivaView } from "./ActivaView";
export { default as ArchivadaView } from "./ArchivadaView";
export { default as ConfirmacionView } from "./ConfirmacionView";
