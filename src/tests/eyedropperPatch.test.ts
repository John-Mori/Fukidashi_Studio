import { describe, expect, it } from "vitest";
import { createEyedropperPatchShape } from "../editor/eyedropperPatch";

describe("eyedropper color patch", () => {
  it("creates a small movable shape centered on the sampled point", () => {
    const shape = createEyedropperPatchShape({ x: 540, y: 960 }, "#8a7b6c", { width: 1080, height: 1920 });

    expect(shape.name).toBe("色隠し");
    expect(shape.kind).toBe("rect");
    expect(shape.fill).toBe("#8a7b6c");
    expect(shape.strokeWidth).toBe(0);
    expect(shape.width).toBe(shape.height);
    expect(shape.width).toBeLessThan(1080 * 0.2);
    expect(shape.transform.x + shape.width / 2).toBeCloseTo(540);
    expect(shape.transform.y + shape.height / 2).toBeCloseTo(960);
    expect(shape.locked).toBe(false);
  });

  it("keeps the patch inside the image near an edge", () => {
    const shape = createEyedropperPatchShape({ x: 1, y: 1919 }, "#ffffff", { width: 1080, height: 1920 });

    expect(shape.transform.x).toBe(0);
    expect(shape.transform.y + shape.height).toBe(1920);
  });
});