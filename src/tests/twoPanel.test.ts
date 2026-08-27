import { describe, expect, it } from "vitest";
import {
  coverImagePlacement,
  createPanelLayout,
  createPanelRects,
  imagePlacement,
  panelIndexAtPoint,
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

  it("uses parallel diagonal boundaries and keeps three panels selectable", () => {
    const layout = createPanelLayout(3, [0.34, 0.67], 60);
    const firstDelta = layout.boundaries[0].rightY - layout.boundaries[0].leftY;
    const secondDelta = layout.boundaries[1].rightY - layout.boundaries[1].leftY;
    expect(firstDelta).toBeGreaterThan(0);
    expect(secondDelta).toBeCloseTo(firstDelta);
    expect(panelIndexAtPoint(layout, 0, 100)).toBe(0);
    expect(panelIndexAtPoint(layout, 540, 960)).toBe(1);
    expect(panelIndexAtPoint(layout, 1080, 1800)).toBe(2);
  });

  it("keeps usable content areas at the steepest supported angle", () => {
    const layout = createPanelLayout(3, [0.15, 0.35], 100);
    expect(layout.panels.every((panel) => panel.contentRect.height > 0)).toBe(true);
    expect(layout.panels[1].contentRect.height).toBeGreaterThan(0.08 * 1920);
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
