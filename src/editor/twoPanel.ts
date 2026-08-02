export const SHORTS_WIDTH = 1080;
export const SHORTS_HEIGHT = 1920;

export type PanelCrop = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export type PanelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImagePlacement = PanelRect & {
  scale: number;
};

export const DEFAULT_PANEL_CROP: PanelCrop = { zoom: 1, offsetX: 0, offsetY: 0 };

export function clampSplitRatio(value: number): number {
  if (!Number.isFinite(value)) return 0.55;
  return Math.min(0.7, Math.max(0.3, value));
}

export function createPanelRects(splitRatio: number, width = SHORTS_WIDTH, height = SHORTS_HEIGHT) {
  const split = Math.round(height * clampSplitRatio(splitRatio));
  return {
    top: { x: 0, y: 0, width, height: split },
    bottom: { x: 0, y: split, width, height: height - split },
  } satisfies Record<"top" | "bottom", PanelRect>;
}

export function coverImagePlacement(
  source: { width: number; height: number },
  panel: PanelRect,
  crop: PanelCrop,
): ImagePlacement {
  const safeWidth = Math.max(1, source.width);
  const safeHeight = Math.max(1, source.height);
  const zoom = Math.min(4, Math.max(1, crop.zoom));
  const scale = Math.max(panel.width / safeWidth, panel.height / safeHeight) * zoom;
  const width = safeWidth * scale;
  const height = safeHeight * scale;
  const maxOffsetX = Math.max(0, (width - panel.width) / 2);
  const maxOffsetY = Math.max(0, (height - panel.height) / 2);
  const offsetX = Math.min(maxOffsetX, Math.max(-maxOffsetX, crop.offsetX));
  const offsetY = Math.min(maxOffsetY, Math.max(-maxOffsetY, crop.offsetY));
  return {
    x: panel.x + (panel.width - width) / 2 + offsetX,
    y: panel.y + (panel.height - height) / 2 + offsetY,
    width,
    height,
    scale,
  };
}
