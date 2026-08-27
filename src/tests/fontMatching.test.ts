import { describe, expect, it } from "vitest";
import { estimateMatchedFontSize, otsuThreshold, scoreBinaryMasks, type BinaryMask } from "../editor/fontMatching";

function mask(rows: string[]): BinaryMask {
  const width = rows[0].length;
  const height = rows.length;
  const data = new Uint8Array(width * height);
  let inkCount = 0;
  rows.forEach((row, y) => Array.from(row).forEach((value, x) => {
    if (value !== "#") return;
    data[y * width + x] = 1;
    inkCount += 1;
  }));
  return { width, height, data, bounds: { x: 0, y: 0, width, height }, inkCount };
}

describe("font matching", () => {
  it("finds a threshold between dark text and a light background", () => {
    const values = new Uint8Array([12, 18, 24, 230, 238, 245]);
    const threshold = otsuThreshold(values);
    expect(threshold).toBeGreaterThanOrEqual(24);
    expect(threshold).toBeLessThan(230);
  });

  it("scores matching glyph shapes above unrelated shapes", () => {
    const vertical = mask([".#.", ".#.", ".#.", ".#.", ".#."]);
    const same = mask(["..#..", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."]);
    const horizontal = mask(["#####", "#####"]);
    expect(scoreBinaryMasks(vertical, same)).toBeGreaterThan(scoreBinaryMasks(vertical, horizontal));
  });

  it("estimates the editor font size from the selected glyph bounds", () => {
    expect(estimateMatchedFontSize(
      { x: 0, y: 0, width: 48, height: 96 },
      { x: 0, y: 0, width: 24, height: 48 },
      36,
    )).toBe(72);
  });
});
