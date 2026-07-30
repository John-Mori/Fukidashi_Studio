import { describe, expect, it } from "vitest";
import { clampMosaicValue, mosaicSampleSize, shouldAppendMosaicPoint } from "../editor/mosaic";

describe("mosaic editor model", () => {
  it("clamps brush settings to a safe range", () => {
    expect(clampMosaicValue(-10, 4, 48)).toBe(4);
    expect(clampMosaicValue(80, 4, 48)).toBe(48);
    expect(clampMosaicValue(Number.NaN, 4, 48)).toBe(4);
  });

  it("creates coarser pixel samples than soft blur samples", () => {
    const pixel = mosaicSampleSize(1200, 1800, "pixelate", 24);
    const blur = mosaicSampleSize(1200, 1800, "blur", 24);
    expect(pixel.width).toBeLessThan(blur.width);
    expect(pixel.height).toBeLessThan(blur.height);
  });

  it("filters overly dense pointer samples", () => {
    expect(shouldAppendMosaicPoint({ x: 10, y: 10 }, { x: 11, y: 11 }, 100)).toBe(false);
    expect(shouldAppendMosaicPoint({ x: 10, y: 10 }, { x: 30, y: 30 }, 100)).toBe(true);
  });
});
