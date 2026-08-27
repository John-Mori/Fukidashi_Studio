import { describe, expect, it } from "vitest";
import { createColorPatch, rgbToHex, transformColorPatch } from "../editor/colorPatch";

describe("color patch", () => {
  it("converts sampled pixels to a CSS color", () => {
    expect(rgbToHex(12, 128, 255)).toBe("#0c80ff");
  });

  it("creates a small square inside the canvas", () => {
    const patch = createColorPatch("patch-1", 2, 2, "#ffffff", 1080, 1920);
    expect(patch.x).toBe(0);
    expect(patch.y).toBe(0);
    expect(patch.width).toBe(patch.height);
  });

  it("moves and stretches a patch without leaving the canvas", () => {
    const patch = createColorPatch("patch-1", 540, 960, "#111111", 1080, 1920);
    const stretched = transformColorPatch(patch, "southeast", 200, 400, 1080, 1920);
    expect(stretched.width).toBeGreaterThan(patch.width);
    expect(stretched.height).toBeGreaterThan(patch.height);
    const moved = transformColorPatch(stretched, "move", 5000, 5000, 1080, 1920);
    expect(moved.x + moved.width).toBeLessThanOrEqual(1080);
    expect(moved.y + moved.height).toBeLessThanOrEqual(1920);
  });
});
