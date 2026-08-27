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
  anglePercent: number;
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
  anglePercents: number | number[],
  width = SHORTS_WIDTH,
  height = SHORTS_HEIGHT,
): PanelLayout {
  const safeWidth = clampOutputSize(width, SHORTS_WIDTH);
  const safeHeight = clampOutputSize(height, SHORTS_HEIGHT);
  const ratios = normalizeBoundaryRatios(panelCount, boundaryRatios);
  const panelShares = [ratios[0], ...ratios.slice(1).map((ratio, index) => ratio - ratios[index]), 1 - ratios[ratios.length - 1]];
  const angles = Array.isArray(anglePercents)
    ? ratios.map((_, index) => clampAnglePercent(anglePercents[index] ?? 0))
    : ratios.map(() => clampAnglePercent(anglePercents));
  const boundaries = ratios.map((ratio, index) => {
    const maxDeltaRatio = Math.min(0.22, Math.min(panelShares[index], panelShares[index + 1]) * 0.65);
    const verticalDelta = safeHeight * maxDeltaRatio * angles[index] / 100;
    return {
      ratio,
      anglePercent: angles[index],
      leftY: safeHeight * ratio - verticalDelta / 2,
      rightY: safeHeight * ratio + verticalDelta / 2,
    };
  });
  const edges: BoundaryLine[] = [
    { ratio: 0, anglePercent: 0, leftY: 0, rightY: 0 },
    ...boundaries,
    { ratio: 1, anglePercent: 0, leftY: safeHeight, rightY: safeHeight },
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

function edgePoint(start: PanelPoint, end: PanelPoint, ratio: number): PanelPoint {
  return {
    x: interpolate(start.x, end.x, ratio),
    y: interpolate(start.y, end.y, ratio),
  };
}

export function splitPanelGeometry(
  panel: PanelGeometry,
  count: SubpanelCount,
  ratios: number[],
  anglePercents: number[] = [],
): PanelGeometry[] {
  const normalized = normalizeSubpanelRatios(count, ratios);
  const dividerRatios = normalized.map((ratio, index) => {
    const shift = 0.05 * clampAnglePercent(anglePercents[index] ?? 0) / 100;
    return {
      top: ratio - shift,
      bottom: ratio + shift,
    };
  });
  const topPositions = [0, ...dividerRatios.map((divider) => divider.top), 1];
  const bottomPositions = [0, ...dividerRatios.map((divider) => divider.bottom), 1];

  return Array.from({ length: count }, (_, index) => {
    const topLeft = edgePoint(panel.polygon[0], panel.polygon[1], topPositions[index]);
    const topRight = edgePoint(panel.polygon[0], panel.polygon[1], topPositions[index + 1]);
    const bottomLeft = edgePoint(panel.polygon[3], panel.polygon[2], bottomPositions[index]);
    const bottomRight = edgePoint(panel.polygon[3], panel.polygon[2], bottomPositions[index + 1]);
    const minX = Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
    const maxX = Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);
    const maxY = Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y);
    const contentLeft = Math.max(topLeft.x, bottomLeft.x);
    const contentRight = Math.min(topRight.x, bottomRight.x);
    const contentTop = Math.max(topLeft.y, topRight.y);
    const contentBottom = Math.min(bottomLeft.y, bottomRight.y);
    return {
      index,
      polygon: [topLeft, topRight, bottomRight, bottomLeft],
      bounds: { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) },
      contentRect: {
        x: contentLeft,
        y: contentTop,
        width: Math.max(1, contentRight - contentLeft),
        height: Math.max(1, contentBottom - contentTop),
      },
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

function pointInPolygon(polygon: PanelPoint[], x: number, y: number): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crosses = (currentPoint.y > y) !== (previousPoint.y > y)
      && x < (previousPoint.x - currentPoint.x) * (y - currentPoint.y) / (previousPoint.y - currentPoint.y || 1) + currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function subpanelIndexAtPoint(
  panel: PanelGeometry,
  count: SubpanelCount,
  ratios: number[],
  anglePercents: number[],
  x: number,
  y: number,
): number {
  const cells = splitPanelGeometry(panel, count, ratios, anglePercents);
  const match = cells.find((cell) => pointInPolygon(cell.polygon, x, y));
  if (match) return match.index;
  return subpanelIndexAtX(panel, count, ratios, x);
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
