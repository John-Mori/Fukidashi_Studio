export const SHORTS_WIDTH = 1080;
export const SHORTS_HEIGHT = 1920;
export const MIN_OUTPUT_SIZE = 320;
export const MAX_OUTPUT_SIZE = 4096;

export type PanelCount = 2 | 3;
export type SubpanelCount = 1 | 2 | 3;
export type PanelFit = "cover" | "contain" | "custom";

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

export type PanelPoint = {
  x: number;
  y: number;
};

export type BoundaryLine = {
  leftY: number;
  rightY: number;
  ratio: number;
};

export type PanelGeometry = {
  index: number;
  polygon: [PanelPoint, PanelPoint, PanelPoint, PanelPoint];
  bounds: PanelRect;
  contentRect: PanelRect;
};

export type PanelLayout = {
  width: number;
  height: number;
  boundaries: BoundaryLine[];
  panels: PanelGeometry[];
};

export type ImagePlacement = PanelRect & {
  scale: number;
};

export const DEFAULT_PANEL_CROP: PanelCrop = { zoom: 1, offsetX: 0, offsetY: 0 };
export const DEFAULT_BOUNDARY_RATIOS: Record<PanelCount, number[]> = {
  2: [0.55],
  3: [0.34, 0.67],
};
export const DEFAULT_SUBPANEL_RATIOS: Record<SubpanelCount, number[]> = {
  1: [],
  2: [0.5],
  3: [0.34, 0.67],
};

export function clampOutputSize(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(Math.min(MAX_OUTPUT_SIZE, Math.max(MIN_OUTPUT_SIZE, value)));
}

export function clampSplitRatio(value: number): number {
  if (!Number.isFinite(value)) return 0.55;
  return Math.min(0.8, Math.max(0.2, value));
}

export function clampAnglePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(100, Math.max(-100, value)));
}

export function normalizeBoundaryRatios(panelCount: PanelCount, values: number[]): number[] {
  if (panelCount === 2) return [clampSplitRatio(values[0] ?? DEFAULT_BOUNDARY_RATIOS[2][0])];
  const first = Math.min(0.65, Math.max(0.15, values[0] ?? DEFAULT_BOUNDARY_RATIOS[3][0]));
  const second = Math.min(0.85, Math.max(0.35, values[1] ?? DEFAULT_BOUNDARY_RATIOS[3][1]));
  if (second - first >= 0.15) return [first, second];
  const center = (first + second) / 2;
  return [Math.max(0.15, center - 0.075), Math.min(0.85, center + 0.075)];
}

export function normalizeSubpanelRatios(count: SubpanelCount, values: number[]): number[] {
  if (count === 1) return [];
  if (count === 2) {
    const value = Number.isFinite(values[0]) ? values[0] : DEFAULT_SUBPANEL_RATIOS[2][0];
    return [Math.min(0.8, Math.max(0.2, value))];
  }
  const first = Math.min(0.65, Math.max(0.15, values[0] ?? DEFAULT_SUBPANEL_RATIOS[3][0]));
  const second = Math.min(0.85, Math.max(0.35, values[1] ?? DEFAULT_SUBPANEL_RATIOS[3][1]));
  if (second - first >= 0.15) return [first, second];
  const center = (first + second) / 2;
  return [Math.max(0.15, center - 0.075), Math.min(0.85, center + 0.075)];
}

export function createPanelLayout(
  panelCount: PanelCount,
  boundaryRatios: number[],
  anglePercent: number,
  width = SHORTS_WIDTH,
  height = SHORTS_HEIGHT,
): PanelLayout {
  const safeWidth = clampOutputSize(width, SHORTS_WIDTH);
  const safeHeight = clampOutputSize(height, SHORTS_HEIGHT);
  const ratios = normalizeBoundaryRatios(panelCount, boundaryRatios);
  const panelShares = [ratios[0], ...ratios.slice(1).map((ratio, index) => ratio - ratios[index]), 1 - ratios[ratios.length - 1]];
  const maxDeltaRatio = Math.min(0.25, Math.min(...panelShares) * 0.75);
  const verticalDelta = safeHeight * maxDeltaRatio * clampAnglePercent(anglePercent) / 100;
  const boundaries = ratios.map((ratio) => ({
    ratio,
    leftY: safeHeight * ratio - verticalDelta / 2,
    rightY: safeHeight * ratio + verticalDelta / 2,
  }));
  const edges: BoundaryLine[] = [
    { ratio: 0, leftY: 0, rightY: 0 },
    ...boundaries,
    { ratio: 1, leftY: safeHeight, rightY: safeHeight },
  ];
  const panels = Array.from({ length: panelCount }, (_, index): PanelGeometry => {
    const top = edges[index];
    const bottom = edges[index + 1];
    const minY = Math.min(top.leftY, top.rightY);
    const maxY = Math.max(bottom.leftY, bottom.rightY);
    const contentTop = Math.max(top.leftY, top.rightY);
    const contentBottom = Math.min(bottom.leftY, bottom.rightY);
    return {
      index,
      polygon: [
        { x: 0, y: top.leftY },
        { x: safeWidth, y: top.rightY },
        { x: safeWidth, y: bottom.rightY },
        { x: 0, y: bottom.leftY },
      ],
      bounds: { x: 0, y: minY, width: safeWidth, height: Math.max(1, maxY - minY) },
      contentRect: { x: 0, y: contentTop, width: safeWidth, height: Math.max(1, contentBottom - contentTop) },
    };
  });
  return { width: safeWidth, height: safeHeight, boundaries, panels };
}

function interpolate(start: number, end: number, ratio: number): number {
  return start + (end - start) * ratio;
}

export function splitPanelGeometry(panel: PanelGeometry, count: SubpanelCount, ratios: number[]): PanelGeometry[] {
  const normalized = normalizeSubpanelRatios(count, ratios);
  const left = panel.polygon[0].x;
  const right = panel.polygon[1].x;
  const width = Math.max(1, right - left);
  const positions = [0, ...normalized, 1];
  return Array.from({ length: count }, (_, index) => {
    const startRatio = positions[index];
    const endRatio = positions[index + 1];
    const x1 = left + width * startRatio;
    const x2 = left + width * endRatio;
    const topLeft = interpolate(panel.polygon[0].y, panel.polygon[1].y, startRatio);
    const topRight = interpolate(panel.polygon[0].y, panel.polygon[1].y, endRatio);
    const bottomLeft = interpolate(panel.polygon[3].y, panel.polygon[2].y, startRatio);
    const bottomRight = interpolate(panel.polygon[3].y, panel.polygon[2].y, endRatio);
    const contentTop = Math.max(topLeft, topRight);
    const contentBottom = Math.min(bottomLeft, bottomRight);
    return {
      index,
      polygon: [
        { x: x1, y: topLeft },
        { x: x2, y: topRight },
        { x: x2, y: bottomRight },
        { x: x1, y: bottomLeft },
      ],
      bounds: { x: x1, y: Math.min(topLeft, topRight), width: x2 - x1, height: Math.max(1, Math.max(bottomLeft, bottomRight) - Math.min(topLeft, topRight)) },
      contentRect: { x: x1, y: contentTop, width: x2 - x1, height: Math.max(1, contentBottom - contentTop) },
    };
  });
}

export function panelIndexAtPoint(layout: PanelLayout, x: number, y: number): number {
  const normalizedX = Math.min(layout.width, Math.max(0, x)) / layout.width;
  for (let index = 0; index < layout.boundaries.length; index += 1) {
    const boundary = layout.boundaries[index];
    const boundaryY = boundary.leftY + (boundary.rightY - boundary.leftY) * normalizedX;
    if (y < boundaryY) return index;
  }
  return layout.panels.length - 1;
}

export function subpanelIndexAtX(panel: PanelGeometry, count: SubpanelCount, ratios: number[], x: number): number {
  const normalized = normalizeSubpanelRatios(count, ratios);
  const ratio = (x - panel.bounds.x) / Math.max(1, panel.bounds.width);
  for (let index = 0; index < normalized.length; index += 1) {
    if (ratio < normalized[index]) return index;
  }
  return count - 1;
}

export function imagePlacement(
  source: { width: number; height: number },
  panel: PanelGeometry,
  crop: PanelCrop,
  fit: PanelFit,
): ImagePlacement {
  const safeWidth = Math.max(1, source.width);
  const safeHeight = Math.max(1, source.height);
  const target = fit === "cover" ? panel.bounds : panel.contentRect;
  const minZoom = fit === "custom" ? 0.25 : 1;
  const zoom = Math.min(4, Math.max(minZoom, crop.zoom));
  const baseScale = fit === "cover"
    ? Math.max(target.width / safeWidth, target.height / safeHeight)
    : Math.min(target.width / safeWidth, target.height / safeHeight);
  const scale = baseScale * zoom;
  const width = safeWidth * scale;
  const height = safeHeight * scale;
  const maxOffsetX = Math.abs(width - target.width) / 2;
  const maxOffsetY = Math.abs(height - target.height) / 2;
  const offsetX = Math.min(maxOffsetX, Math.max(-maxOffsetX, crop.offsetX));
  const offsetY = Math.min(maxOffsetY, Math.max(-maxOffsetY, crop.offsetY));
  return {
    x: target.x + (target.width - width) / 2 + offsetX,
    y: target.y + (target.height - height) / 2 + offsetY,
    width,
    height,
    scale,
  };
}

export function createPanelRects(splitRatio: number, width = SHORTS_WIDTH, height = SHORTS_HEIGHT) {
  const layout = createPanelLayout(2, [splitRatio], 0, width, height);
  return {
    top: layout.panels[0].bounds,
    bottom: layout.panels[1].bounds,
  } satisfies Record<"top" | "bottom", PanelRect>;
}

export function coverImagePlacement(
  source: { width: number; height: number },
  panel: PanelRect,
  crop: PanelCrop,
): ImagePlacement {
  const geometry: PanelGeometry = {
    index: 0,
    polygon: [
      { x: panel.x, y: panel.y },
      { x: panel.x + panel.width, y: panel.y },
      { x: panel.x + panel.width, y: panel.y + panel.height },
      { x: panel.x, y: panel.y + panel.height },
    ],
    bounds: panel,
    contentRect: panel,
  };
  return imagePlacement(source, geometry, crop, "cover");
}
