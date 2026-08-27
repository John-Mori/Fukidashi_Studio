import { describe, expect, it } from "vitest";
import { resizeCanvasObjects } from "../project/model/resizeCanvasObjects";
import type { ShapeObject } from "../project/model/types";

describe("resizeCanvasObjects", () => {
  it("preserves relative placement and scales when the composed canvas size changes", () => {
    const object: ShapeObject = {
      id: "shape-1",
      type: "shape",
      name: "矩形",
      kind: "rect",
      width: 120,
      height: 80,
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 2,
      transform: {
        x: 250,
        y: 400,
        scaleX: 1.5,
        scaleY: 0.75,
        rotation: 12,
        flipX: false,
        flipY: false,
      },
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 1,
    };

    const [resized] = resizeCanvasObjects([object], { width: 1000, height: 1000 }, { width: 2000, height: 1500 });

    expect(resized).not.toBe(object);
    expect(resized.transform).toMatchObject({
      x: 500,
      y: 600,
      scaleX: 3,
      scaleY: 1.125,
      rotation: 12,
    });
    expect(object.transform.x).toBe(250);
  });
});