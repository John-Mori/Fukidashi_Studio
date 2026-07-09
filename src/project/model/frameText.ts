import type { BubbleObject, EditorObject, ShapeObject, TextObject, WritingMode } from "./types";

export type TextFrameObject = BubbleObject | (ShapeObject & { kind: "rect" | "ellipse" });

type FrameTextOptions = {
  existingText?: TextObject;
  fill?: string;
  writingMode?: WritingMode;
};

const DEFAULT_FRAME_TEXT = "セリフ";
const DEFAULT_LINE_HEIGHT = 1.08;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizedLines(text: string): string[] {
  const lines = text.length > 0 ? text.split("\n") : [DEFAULT_FRAME_TEXT];
  return lines.map((line) => line.length > 0 ? line : " ");
}

export function isTextFrameObject(object?: EditorObject): object is TextFrameObject {
  return Boolean(object && (object.type === "bubble" || (object.type === "shape" && object.kind !== "line")));
}

export function objectDisplaySize(object: EditorObject): { width: number; height: number } {
  if (object.type === "text") {
    const size = estimateTextSize(object.text, object.writingMode, object.fontSize, object.lineHeight);
    return {
      width: Math.max(object.width, size.width) * Math.abs(object.transform.scaleX),
      height: size.height * Math.abs(object.transform.scaleY),
    };
  }
  return {
    width: object.width * Math.abs(object.transform.scaleX),
    height: object.height * Math.abs(object.transform.scaleY),
  };
}

export function objectDisplayBounds(object: EditorObject): { x: number; y: number; width: number; height: number } {
  const size = objectDisplaySize(object);
  return {
    x: object.transform.x,
    y: object.transform.y,
    width: size.width,
    height: size.height,
  };
}

export function objectDisplayCenter(object: EditorObject): { x: number; y: number } {
  const bounds = objectDisplayBounds(object);
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

export function findPairedFrameText(objects: EditorObject[], frame: TextFrameObject): TextObject | undefined {
  return objects.find((object): object is TextObject => object.type === "text" && (object.id === frame.pairId || object.pairId === frame.id));
}

export function frameTextPadding(width: number, height: number): number {
  return clamp(Math.min(width, height) * 0.12, 14, 42);
}

export function estimateTextSize(text: string, mode: WritingMode, fontSize: number, lineHeight = DEFAULT_LINE_HEIGHT): { width: number; height: number } {
  const lines = normalizedLines(text);
  if (mode === "vertical") {
    const columns = Math.max(1, lines.length);
    const maxChars = Math.max(1, ...lines.map((line) => Array.from(line).length));
    return {
      width: columns * fontSize * 1.18,
      height: maxChars * fontSize * lineHeight,
    };
  }

  const maxChars = Math.max(1, ...lines.map((line) => Array.from(line).length));
  return {
    width: maxChars * fontSize * 0.72,
    height: lines.length * fontSize * lineHeight,
  };
}

export function fitFrameTextFontSize(text: string, mode: WritingMode, innerWidth: number, innerHeight: number, maxFontSize = 42, lineHeight = DEFAULT_LINE_HEIGHT): number {
  const base = estimateTextSize(text, mode, maxFontSize, lineHeight);
  const scale = Math.min(1, innerWidth / Math.max(1, base.width), innerHeight / Math.max(1, base.height));
  return clamp(Math.floor(maxFontSize * scale), 10, maxFontSize);
}

export function createFrameTextPatch(frame: TextFrameObject, text: string, options: FrameTextOptions = {}): Partial<TextObject> {
  const bounds = objectDisplayBounds(frame);
  const padding = frameTextPadding(bounds.width, bounds.height);
  const innerWidth = Math.max(32, bounds.width - padding * 2);
  const innerHeight = Math.max(32, bounds.height - padding * 2);
  const writingMode = options.writingMode ?? options.existingText?.writingMode ?? "vertical";
  const lineHeight = options.existingText?.lineHeight ?? DEFAULT_LINE_HEIGHT;
  const fontSize = fitFrameTextFontSize(text, writingMode, innerWidth, innerHeight, 42, lineHeight);
  const textSize = estimateTextSize(text, writingMode, fontSize, lineHeight);
  const minY = bounds.y + padding;
  const maxY = bounds.y + bounds.height - padding - textSize.height;
  const centeredY = bounds.y + (bounds.height - textSize.height) / 2;
  const y = maxY >= minY ? clamp(centeredY, minY, maxY) : centeredY;

  return {
    name: options.existingText?.name ?? "枠内文字",
    text,
    writingMode,
    fontFamily: options.existingText?.fontFamily ?? "BIZ UDPGothic, Yu Gothic UI, Meiryo, sans-serif",
    fontSize,
    fill: options.existingText?.fill ?? options.fill ?? "#111111",
    strokeEnabled: false,
    stroke: options.existingText?.stroke ?? "#ffffff",
    strokeWidth: 0,
    fontWeight: options.existingText?.fontWeight ?? "normal",
    fontStyle: options.existingText?.fontStyle ?? "normal",
    textAlign: "center",
    lineHeight,
    charSpacing: options.existingText?.charSpacing ?? 0,
    width: innerWidth,
    pairId: frame.id,
    transform: {
      x: bounds.x + padding,
      y,
      scaleX: 1,
      scaleY: 1,
      rotation: frame.transform.rotation,
      flipX: false,
      flipY: false,
    },
    opacity: options.existingText?.opacity ?? 1,
    visible: options.existingText?.visible ?? true,
    locked: options.existingText?.locked ?? false,
  };
}
