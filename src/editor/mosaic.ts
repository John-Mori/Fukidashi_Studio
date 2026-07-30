export type MosaicMode = "pixelate" | "blur";

export type MosaicPoint = {
  x: number;
  y: number;
};

export type MosaicStroke = {
  mode: MosaicMode;
  brushSize: number;
  strength: number;
  points: MosaicPoint[];
};

export function clampMosaicValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function shouldAppendMosaicPoint(previous: MosaicPoint, next: MosaicPoint, brushSize: number): boolean {
  const minimumDistance = Math.max(1, brushSize * 0.08);
  return Math.hypot(next.x - previous.x, next.y - previous.y) >= minimumDistance;
}

export function mosaicSampleSize(width: number, height: number, mode: MosaicMode, strength: number) {
  const factor = mode === "pixelate"
    ? clampMosaicValue(Math.round(strength), 3, 80)
    : clampMosaicValue(Math.round(strength / 2), 2, 24);
  return {
    width: Math.max(1, Math.ceil(width / factor)),
    height: Math.max(1, Math.ceil(height / factor)),
  };
}
