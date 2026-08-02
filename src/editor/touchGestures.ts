export type GesturePoint = {
  x: number;
  y: number;
};

export type PinchSnapshot = {
  distance: number;
  midpoint: GesturePoint;
};

export type GestureTransform = {
  scale: number;
  x: number;
  y: number;
};

export function createPinchSnapshot(first: GesturePoint, second: GesturePoint): PinchSnapshot {
  return {
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
    midpoint: {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    },
  };
}

export function updatePinchTransform(
  current: GestureTransform,
  previous: PinchSnapshot,
  next: PinchSnapshot,
  viewportCenter: GesturePoint,
  minScale = 1,
  maxScale = 8,
): GestureTransform {
  const ratio = next.distance / Math.max(1, previous.distance);
  const scale = Math.min(maxScale, Math.max(minScale, current.scale * ratio));
  if (scale <= minScale + 0.0001) return { scale: minScale, x: 0, y: 0 };

  const logicalX = (previous.midpoint.x - viewportCenter.x - current.x) / current.scale;
  const logicalY = (previous.midpoint.y - viewportCenter.y - current.y) / current.scale;
  return {
    scale,
    x: next.midpoint.x - viewportCenter.x - logicalX * scale,
    y: next.midpoint.y - viewportCenter.y - logicalY * scale,
  };
}

export function clampGesturePan(
  transform: GestureTransform,
  content: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 24,
): GestureTransform {
  if (transform.scale <= 1.0001) return { scale: 1, x: 0, y: 0 };
  const maxX = Math.max(0, (content.width * transform.scale - viewport.width) / 2 + margin);
  const maxY = Math.max(0, (content.height * transform.scale - viewport.height) / 2 + margin);
  return {
    ...transform,
    x: Math.min(maxX, Math.max(-maxX, transform.x)),
    y: Math.min(maxY, Math.max(-maxY, transform.y)),
  };
}
