export type ColorPatch = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

export type PatchTransform = "move" | "north" | "south" | "east" | "west" | "southeast";

export function rgbToHex(red: number, green: number, blue: number): string {
  const channel = (value: number) => Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

export function createColorPatch(id: string, x: number, y: number, color: string, canvasWidth: number, canvasHeight: number): ColorPatch {
  const size = Math.min(480, Math.max(48, Math.round(Math.min(canvasWidth, canvasHeight) * 0.11)));
  return {
    id,
    x: Math.min(canvasWidth - size, Math.max(0, x - size / 2)),
    y: Math.min(canvasHeight - size, Math.max(0, y - size / 2)),
    width: size,
    height: size,
    color,
  };
}

export function transformColorPatch(
  patch: ColorPatch,
  transform: PatchTransform,
  deltaX: number,
  deltaY: number,
  canvasWidth: number,
  canvasHeight: number,
): ColorPatch {
  const minSize = Math.max(12, Math.round(Math.min(canvasWidth, canvasHeight) * 0.012));
  let { x, y, width, height } = patch;
  if (transform === "move") {
    x += deltaX;
    y += deltaY;
  }
  if (transform === "east" || transform === "southeast") width += deltaX;
  if (transform === "south" || transform === "southeast") height += deltaY;
  if (transform === "west") {
    x += deltaX;
    width -= deltaX;
  }
  if (transform === "north") {
    y += deltaY;
    height -= deltaY;
  }
  width = Math.min(canvasWidth, Math.max(minSize, width));
  height = Math.min(canvasHeight, Math.max(minSize, height));
  x = Math.min(canvasWidth - width, Math.max(0, x));
  y = Math.min(canvasHeight - height, Math.max(0, y));
  return { ...patch, x, y, width, height };
}
