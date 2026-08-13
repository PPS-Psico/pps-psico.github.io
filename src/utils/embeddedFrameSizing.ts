export interface EmbeddedPanelMessage {
  ppsPanel: true;
  height?: number;
}

interface BuildEmbeddedPanelMessageInput {
  hash: string;
  bodyOverflow: string;
  contentHeight: number;
}

/**
 * Las vistas operativas usan layouts ligados al viewport (`100vh`/`100dvh`).
 * Si su iframe replica el alto del contenido, el viewport crece con cada
 * medición y se genera una realimentación infinita con Moodle.
 */
export function isViewportBoundedPanelRoute(hash: string): boolean {
  return /^#\/(?:admin|jefe|directivo|reportero|testing)(?:\/|$)/.test(hash);
}

/**
 * Sin `height`, el puente de Moodle aplica su altura estable de panel. El
 * autoalto se conserva para las superficies estudiantiles basadas en contenido.
 */
export function buildEmbeddedPanelMessage({
  hash,
  bodyOverflow,
  contentHeight,
}: BuildEmbeddedPanelMessageInput): EmbeddedPanelMessage {
  const hasBlockingLayer = bodyOverflow === "hidden";

  if (hasBlockingLayer || isViewportBoundedPanelRoute(hash)) {
    return { ppsPanel: true };
  }

  return { ppsPanel: true, height: Math.max(0, Math.ceil(contentHeight)) };
}
