import { describe, expect, it } from "vitest";
import { coverImagePlacement, createPanelRects } from "../editor/twoPanel";

describe("two panel composer", () => {
  it("creates two gapless Shorts panels", () => {
    const panels = createPanelRects(0.55);
    expect(panels.top).toEqual({ x: 0, y: 0, width: 1080, height: 1056 });
    expect(panels.bottom).toEqual({ x: 0, y: 1056, width: 1080, height: 864 });
    expect(panels.top.height + panels.bottom.height).toBe(1920);
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

  it("clamps dragging so a panel cannot expose empty pixels", () => {
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
