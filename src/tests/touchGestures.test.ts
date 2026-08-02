import { describe, expect, it } from "vitest";
import { clampGesturePan, createPinchSnapshot, updatePinchTransform } from "../editor/touchGestures";

describe("touch gestures", () => {
  it("calculates a stable pinch midpoint and distance", () => {
    expect(createPinchSnapshot({ x: 10, y: 20 }, { x: 50, y: 60 })).toEqual({
      distance: Math.hypot(40, 40),
      midpoint: { x: 30, y: 40 },
    });
  });

  it("zooms around the moving two-finger midpoint", () => {
    const previous = createPinchSnapshot({ x: 100, y: 200 }, { x: 200, y: 200 });
    const next = createPinchSnapshot({ x: 80, y: 220 }, { x: 280, y: 220 });
    const transform = updatePinchTransform(
      { scale: 1, x: 0, y: 0 },
      previous,
      next,
      { x: 200, y: 300 },
    );
    expect(transform.scale).toBe(2);
    expect(transform.x).toBe(80);
    expect(transform.y).toBe(120);
  });

  it("keeps an enlarged image within a recoverable pan range", () => {
    expect(clampGesturePan(
      { scale: 2, x: 999, y: -999 },
      { width: 300, height: 500 },
      { width: 390, height: 600 },
      20,
    )).toEqual({ scale: 2, x: 125, y: -220 });
  });
});
