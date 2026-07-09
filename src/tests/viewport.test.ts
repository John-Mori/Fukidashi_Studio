import { describe, expect, it } from "vitest";
import { fitToViewport, zoomAroundPoint } from "../editor/viewport";

describe("viewport", () => {
  it("fits a 852x1280 canvas into a desktop viewport", () => {
    const view = fitToViewport({ width: 852, height: 1280 }, { width: 1000, height: 800 }, 40);
    expect(view.zoom).toBeGreaterThan(0);
    expect(852 * view.zoom).toBeLessThanOrEqual(1000);
    expect(1280 * view.zoom).toBeLessThanOrEqual(800);
  });

  it("fits multiple vertical source sizes without fixed-size assumptions", () => {
    const sizes = [
      { width: 852, height: 1280 },
      { width: 1022, height: 1536 },
      { width: 1122, height: 1402 },
      { width: 900, height: 1600 },
    ];
    for (const size of sizes) {
      const view = fitToViewport(size, { width: 1200, height: 900 }, 48);
      expect(size.width * view.zoom).toBeLessThanOrEqual(1200);
      expect(size.height * view.zoom).toBeLessThanOrEqual(900);
      expect(Number.isFinite(view.panX)).toBe(true);
      expect(Number.isFinite(view.panY)).toBe(true);
    }
  });

  it("keeps the logical point under the cursor stable when zooming", () => {
    const original = { zoom: 1, panX: 100, panY: 50 };
    const point = { x: 400, y: 300 };
    const before = { x: (point.x - original.panX) / original.zoom, y: (point.y - original.panY) / original.zoom };
    const next = zoomAroundPoint(original, 2, point);
    const after = { x: (point.x - next.panX) / next.zoom, y: (point.y - next.panY) / next.zoom };
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
});
