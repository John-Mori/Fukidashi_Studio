import type { CanvasSize, ProjectDocument, ShapeKind, TemplateAsset, TextObject, WritingMode } from "./types";

export const DEFAULT_CANVAS: CanvasSize = { width: 852, height: 1280 };

export function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createEmptyProject(size: CanvasSize = DEFAULT_CANVAS): ProjectDocument {
  const timestamp = nowIso();
  return {
    schemaVersion: 1,
    projectId: createId("project"),
    name: "Untitled Fukidashi Project",
    createdAt: timestamp,
    updatedAt: timestamp,
    canvas: {
      width: size.width,
      height: size.height,
    },
    assets: {
      templates: [],
    },
    objects: [],
    settings: {
      exportFormat: "png",
      exportQuality: 1,
      layout: {
        previewPosition: "right",
      },
    },
  };
}

export function createDefaultTransform(x: number, y: number) {
  return {
    x,
    y,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
  };
}

export function createTextObject(partial: Partial<TextObject> = {}): TextObject {
  const timestampId = createId("text");
  return {
    id: partial.id ?? timestampId,
    type: "text",
    name: partial.name ?? "文字",
    text: partial.text ?? "セリフ",
    writingMode: partial.writingMode ?? "vertical",
    fontFamily: partial.fontFamily ?? "BIZ UDPGothic, Yu Gothic UI, Meiryo, sans-serif",
    fontSize: partial.fontSize ?? 36,
    fill: partial.fill ?? "#111111",
    strokeEnabled: partial.strokeEnabled ?? true,
    stroke: partial.stroke ?? "#ffffff",
    strokeWidth: partial.strokeWidth ?? 3,
    fontWeight: partial.fontWeight ?? "normal",
    fontStyle: partial.fontStyle ?? "normal",
    textAlign: partial.textAlign ?? "center",
    lineHeight: partial.lineHeight ?? 1.08,
    charSpacing: partial.charSpacing ?? 0,
    width: partial.width ?? 180,
    transform: partial.transform ?? createDefaultTransform(120, 120),
    opacity: partial.opacity ?? 1,
    visible: partial.visible ?? true,
    locked: partial.locked ?? false,
    zIndex: partial.zIndex ?? 1,
    pairId: partial.pairId,
  };
}

export function createShapeObject(kind: ShapeKind, canvas: CanvasSize, fill = "#ffffff", stroke = "#111111") {
  const isRect = kind === "rect";
  const width = kind === "line" ? Math.min(260, canvas.width * 0.35) : isRect ? Math.min(170, canvas.width * 0.22) : Math.min(220, canvas.width * 0.3);
  const height = kind === "line" ? 0 : isRect ? Math.min(340, canvas.height * 0.28) : Math.min(120, canvas.height * 0.12);
  return {
    id: createId("shape"),
    type: "shape" as const,
    kind,
    name: kind === "rect" ? "縦長四角" : kind === "ellipse" ? "楕円" : "直線",
    width,
    height,
    fill: kind === "line" ? "transparent" : fill,
    stroke,
    strokeWidth: 4,
    transform: createDefaultTransform(canvas.width * 0.5 - width / 2, canvas.height * 0.34 - height / 2),
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 1,
  };
}

export function createBubbleObject(asset: TemplateAsset, canvas: CanvasSize) {
  const maxWidth = Math.min(canvas.width * 0.5, 360);
  const scale = asset.width > 0 ? Math.min(1, maxWidth / asset.width) : 1;
  return {
    id: createId("bubble"),
    type: "bubble" as const,
    assetId: asset.id,
    name: asset.name,
    width: asset.width,
    height: asset.height,
    transform: {
      ...createDefaultTransform(canvas.width * 0.2, canvas.height * 0.2),
      scaleX: scale,
      scaleY: scale,
    },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 1,
  };
}

function verticalGlyphs(line: string): string[] {
  const glyphs: string[] = [];
  for (let index = 0; index < line.length;) {
    if (line.startsWith("...", index)) {
      glyphs.push("︙");
      index += 3;
      continue;
    }
    const char = line[index];
    if (char === "…" || char === "⋯") {
      glyphs.push("︙");
      index += 1;
      continue;
    }
    glyphs.push(...Array.from(char));
    index += char.length;
  }
  return glyphs;
}

export function displayTextForWritingMode(text: string, mode: WritingMode): string {
  if (mode === "horizontal") return text;
  return text
    .split("\n")
    .map((line) => verticalGlyphs(line).join("\n"))
    .join("\n\n");
}
