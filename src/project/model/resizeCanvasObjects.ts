import type { CanvasSize, EditorObject } from "./types";

export function resizeCanvasObjects(
  objects: EditorObject[],
  from: CanvasSize,
  to: CanvasSize,
): EditorObject[] {
  const scaleX = to.width / Math.max(1, from.width);
  const scaleY = to.height / Math.max(1, from.height);

  return objects.map((object) => ({
    ...object,
    transform: {
      ...object.transform,
      x: object.transform.x * scaleX,
      y: object.transform.y * scaleY,
      scaleX: object.transform.scaleX * scaleX,
      scaleY: object.transform.scaleY * scaleY,
    },
  }));
}