export type ClientPoint = {
  x: number;
  y: number;
};

type PointLike = {
  clientX?: unknown;
  clientY?: unknown;
};

type InputLike = PointLike & {
  touches?: ArrayLike<PointLike>;
  changedTouches?: ArrayLike<PointLike>;
};

function pointFrom(value: PointLike | undefined): ClientPoint | null {
  if (!value || typeof value.clientX !== "number" || typeof value.clientY !== "number") return null;
  if (!Number.isFinite(value.clientX) || !Number.isFinite(value.clientY)) return null;
  return { x: value.clientX, y: value.clientY };
}

export function clientPointFromInput(input: unknown): ClientPoint | null {
  if (!input || typeof input !== "object") return null;
  const event = input as InputLike;
  return pointFrom(event)
    ?? pointFrom(event.touches?.[0])
    ?? pointFrom(event.changedTouches?.[0]);
}
