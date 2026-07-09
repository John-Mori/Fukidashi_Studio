import { describe, expect, it } from "vitest";
import { createEmptyProject, createTextObject, displayTextForWritingMode } from "../project/model/defaults";

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
});
