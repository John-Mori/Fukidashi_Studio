import type { CanvasSize, ViewState } from "../project/model/types";

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function fitToViewport(
  canvas: CanvasSize,
  viewport: CanvasSize,
  padding = 56,
): ViewState {
  if (canvas.width <= 0 || canvas.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return { zoom: 1, panX: 0, panY: 0 };
  }

  const usableWidth = Math.max(1, viewport.width - padding * 2);
  const usableHeight = Math.max(1, viewport.height - padding * 2);
  const zoom = clampZoom(Math.min(usableWidth / canvas.width, usableHeight / canvas.height));
  return {
    zoom,
    panX: (viewport.width - canvas.width * zoom) / 2,
    panY: (viewport.height - canvas.height * zoom) / 2,
  };
}

export function zoomAroundPoint(
  view: ViewState,
  nextZoom: number,
  point: { x: number; y: number },
): ViewState {
  const zoom = clampZoom(nextZoom);
  const logicalX = (point.x - view.panX) / view.zoom;
  const logicalY = (point.y - view.panY) / view.zoom;
  return {
    zoom,
    panX: point.x - logicalX * zoom,
    panY: point.y - logicalY * zoom,
  };
}
