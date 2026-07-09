import { describe, expect, it } from "vitest";
import { createEmptyProject, createShapeObject, createTextObject, displayTextForWritingMode } from "../project/model/defaults";
import { createFrameTextPatch, frameTextPadding, isTextFrameObject } from "../project/model/frameText";

describe("project model", () => {
  it("creates a variable-size project document", () => {
    const project = createEmptyProject({ width: 1022, height: 1536 });
    expect(project.canvas.width).toBe(1022);
    expect(project.canvas.height).toBe(1536);
    expect(project.objects).toEqual([]);
  });

  it("defaults text objects to vertical Japanese-friendly writing", () => {
    const text = createTextObject({ text: "こんにちは" });
    expect(text.writingMode).toBe("vertical");
    expect(displayTextForWritingMode(text.text, text.writingMode)).toBe("こ\nん\nに\nち\nは");
  });

  it("defaults rectangle objects to a portrait frame", () => {
    const rect = createShapeObject("rect", { width: 852, height: 1280 });
    expect(rect.kind).toBe("rect");
    expect(rect.height).toBeGreaterThan(rect.width);
    expect(rect.name).toBe("縦長四角");
  });

  it("creates frame text with symmetrical inner padding", () => {
    const rect = createShapeObject("rect", { width: 852, height: 1280 });
    if (!isTextFrameObject(rect)) throw new Error("Expected text frame");
    const patch = createFrameTextPatch(rect, "こんにちは");
    const padding = frameTextPadding(rect.width, rect.height);
    expect(patch.width).toBeCloseTo(rect.width - padding * 2);
    expect(patch.transform?.x).toBeCloseTo(rect.transform.x + padding);
    expect(patch.pairId).toBe(rect.id);
    expect(patch.strokeEnabled).toBe(false);
  });
});
