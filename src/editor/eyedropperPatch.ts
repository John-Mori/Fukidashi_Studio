import { createColorPatch } from "./colorPatch";
import { createShapeObject } from "../project/model/defaults";
import type { CanvasSize, ShapeObject } from "../project/model/types";

export function createEyedropperPatchShape(
  point: { x: number; y: number },
  color: string,
  canvas: CanvasSize,
): ShapeObject {
  const patch = createColorPatch("eyedropper-preview", point.x, point.y, color, canvas.width, canvas.height);
  const shape = createShapeObject("rect", canvas, color, color);

  return {
    ...shape,
    name: "色隠し",
    width: patch.width,
    height: patch.height,
    fill: color,
    stroke: color,
    strokeWidth: 0,
    transform: {
      ...shape.transform,
      x: patch.x,
      y: patch.y,
    },
  };
}