import { describe, expect, it } from "vitest";
import {
  coverImagePlacement,
  createPanelLayout,
  createPanelRects,
  imagePlacement,
  panelIndexAtPoint,
  splitPanelGeometry,
  subpanelIndexAtPoint,
  subpanelIndexAtX,
} from "../editor/twoPanel";

describe("multi panel composer", () => {
  it("creates two gapless Shorts panels", () => {
    const panels = createPanelRects(0.55);
    expect(panels.top).toEqual({ x: 0, y: 0, width: 1080, height: 1056 });
    expect(panels.bottom).toEqual({ x: 0, y: 1056, width: 1080, height: 864 });
    expect(panels.top.height + panels.bottom.height).toBe(1920);
  });

  it("creates three gapless panels with two boundaries", () => {
    const layout = createPanelLayout(3, [0.34, 0.67], 0);
    expect(layout.panels).toHaveLength(3);
    expect(layout.boundaries).toHaveLength(2);
    expect(layout.panels[0].polygon[2].y).toBe(layout.panels[1].polygon[1].y);
    expect(layout.panels[1].polygon[2].y).toBe(layout.panels[2].polygon[1].y);
  });

  it("angles each horizontal boundary independently and keeps panels selectable", () => {
    const layout = createPanelLayout(3, [0.34, 0.67], [60, -35]);
    const firstDelta = layout.boundaries[0].rightY - layout.boundaries[0].leftY;
    const secondDelta = layout.boundaries[1].rightY - layout.boundaries[1].leftY;
    expect(firstDelta).toBeGreaterThan(0);
    expect(secondDelta).toBeLessThan(0);
    expect(layout.boundaries[0].anglePercent).toBe(60);
    expect(layout.boundaries[1].anglePercent).toBe(-35);
    expect(panelIndexAtPoint(layout, 0, 100)).toBe(0);
    expect(panelIndexAtPoint(layout, 540, 960)).toBe(1);
    expect(panelIndexAtPoint(layout, 1080, 1800)).toBe(2);
  });

  it("keeps usable content areas at the steepest supported angle", () => {
    const layout = createPanelLayout(3, [0.15, 0.35], 100);
    expect(layout.panels.every((panel) => panel.contentRect.height > 0)).toBe(true);
    expect(layout.panels[1].contentRect.height).toBeGreaterThan(0.08 * 1920);
  });

  it("splits a diagonal zone into adjustable gapless columns", () => {
    const zone = createPanelLayout(3, [0.34, 0.67], 60).panels[1];
    const cells = splitPanelGeometry(zone, 3, [0.28, 0.74]);
    expect(cells).toHaveLength(3);
    expect(cells[0].polygon[1]).toEqual(cells[1].polygon[0]);
    expect(cells[1].polygon[1]).toEqual(cells[2].polygon[0]);
    expect(cells[0].bounds.width).toBeCloseTo(1080 * 0.28);
    expect(cells[1].bounds.width).toBeCloseTo(1080 * 0.46);
    expect(subpanelIndexAtX(zone, 3, [0.28, 0.74], 200)).toBe(0);
    expect(subpanelIndexAtX(zone, 3, [0.28, 0.74], 500)).toBe(1);
    expect(subpanelIndexAtX(zone, 3, [0.28, 0.74], 1000)).toBe(2);
  });

  it("angles each vertical divider independently and selects the slanted cells", () => {
    const zone = createPanelLayout(2, [0.55], [45]).panels[0];
    const cells = splitPanelGeometry(zone, 3, [0.32, 0.7], [100, -60]);
    expect(cells[0].polygon[1]).toEqual(cells[1].polygon[0]);
    expect(cells[1].polygon[1]).toEqual(cells[2].polygon[0]);
    expect(cells[0].polygon[1].x).not.toBe(cells[0].polygon[2].x);
    expect(cells[1].polygon[1].x).not.toBe(cells[1].polygon[2].x);
    const firstCenter = cells[0].contentRect;
    const thirdCenter = cells[2].contentRect;
    expect(subpanelIndexAtPoint(zone, 3, [0.32, 0.7], [100, -60], firstCenter.x + firstCenter.width / 2, firstCenter.y + firstCenter.height / 2)).toBe(0);
    expect(subpanelIndexAtPoint(zone, 3, [0.32, 0.7], [100, -60], thirdCenter.x + thirdCenter.width / 2, thirdCenter.y + thirdCenter.height / 2)).toBe(2);
  });

  it("contain mode keeps the entire image inside the diagonal panel", () => {
    const panel = createPanelLayout(2, [0.5], 100).panels[0];
    const placement = imagePlacement(
      { width: 750, height: 1060 },
      panel,
      { zoom: 1, offsetX: 0, offsetY: 0 },
      "contain",
    );
    expect(placement.x).toBeGreaterThanOrEqual(panel.contentRect.x);
    expect(placement.y).toBeGreaterThanOrEqual(panel.contentRect.y);
    expect(placement.x + placement.width).toBeLessThanOrEqual(panel.contentRect.x + panel.contentRect.width);
    expect(placement.y + placement.height).toBeLessThanOrEqual(panel.contentRect.y + panel.contentRect.height);
  });

  it("custom mode supports fine shrinking and enlargement", () => {
    const panel = splitPanelGeometry(createPanelLayout(2, [0.5], 0).panels[0], 2, [0.5])[0];
    const normal = imagePlacement({ width: 1000, height: 1000 }, panel, { zoom: 1, offsetX: 0, offsetY: 0 }, "custom");
    const smaller = imagePlacement({ width: 1000, height: 1000 }, panel, { zoom: 0.5, offsetX: 0, offsetY: 0 }, "custom");
    const larger = imagePlacement({ width: 1000, height: 1000 }, panel, { zoom: 2, offsetX: 0, offsetY: 0 }, "custom");
    expect(smaller.width).toBeCloseTo(normal.width / 2);
    expect(larger.width).toBeCloseTo(normal.width * 2);
  });

  it("cover-crops without leaving blank space", () => {
    const panel = { x: 0, y: 0, width: 1080, height: 960 };
    const placement = coverImagePlacement(
      { width: 750, height: 1060 },
      panel,
      { zoom: 1, offsetX: 0, offsetY: 0 },
    );
    expect(placement.width).toBeGreaterThanOrEqual(panel.width);
    expect(placement.height).toBeGreaterThanOrEqual(panel.height);
  });

  it("clamps dragging so a cover panel cannot expose empty pixels", () => {
    const panel = { x: 0, y: 0, width: 1080, height: 960 };
    const placement = coverImagePlacement(
      { width: 1080, height: 1920 },
      panel,
      { zoom: 1, offsetX: 9999, offsetY: -9999 },
    );
    expect(placement.x).toBe(0);
    expect(placement.y + placement.height).toBe(960);
  });
});
