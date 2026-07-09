import type { BubbleObject, EditorObject, ShapeObject, TextObject, Transform, WritingMode } from "./types";

export type TextFrameObject = BubbleObject | (ShapeObject & { kind: "rect" | "ellipse" });

type FrameTextOptions = {
  existingText?: TextObject;
  fill?: string;
  writingMode?: WritingMode;
  fontSize?: number;
};

export type FrameTextLayout = {
  frame: TextFrameObject;
  framePatch?: Partial<TextFrameObject>;
  textPatch: Partial<TextObject>;
};

const DEFAULT_FRAME_TEXT = "セリフ";
const DEFAULT_LINE_HEIGHT = 1.08;
const DEFAULT_FRAME_FONT_SIZE = 42;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizedLines(text: string): string[] {
  const lines = text.length > 0 ? text.split("\n") : [DEFAULT_FRAME_TEXT];
  return lines.map((line) => line.length > 0 ? line : " ");
}

function mergeTransform(base: Transform, patch?: Partial<Transform>): Transform {
  return { ...base, ...patch };
}

function mergeFrame(frame: TextFrameObject, patch?: Partial<EditorObject>): TextFrameObject {
  if (!patch) return frame;
  return {
    ...frame,
    ...patch,
    transform: mergeTransform(frame.transform, patch.transform),
  } as TextFrameObject;
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

export function fitFrameTextFontSize(text: string, mode: WritingMode, innerWidth: number, innerHeight: number, maxFontSize = DEFAULT_FRAME_FONT_SIZE, lineHeight = DEFAULT_LINE_HEIGHT): number {
  const base = estimateTextSize(text, mode, maxFontSize, lineHeight);
  const scale = Math.min(1, innerWidth / Math.max(1, base.width), innerHeight / Math.max(1, base.height));
  return clamp(Math.floor(maxFontSize * scale), 10, maxFontSize);
}

export function createFrameTextLayout(frame: TextFrameObject, text: string, options: FrameTextOptions = {}): FrameTextLayout {
  const writingMode = options.writingMode ?? options.existingText?.writingMode ?? "vertical";
  const lineHeight = options.existingText?.lineHeight ?? DEFAULT_LINE_HEIGHT;
  const preferredFontSize = options.existingText?.fontSize ?? options.fontSize ?? DEFAULT_FRAME_FONT_SIZE;
  const originalBounds = objectDisplayBounds(frame);
  const initialTextSize = estimateTextSize(text, writingMode, preferredFontSize, lineHeight);
  const initialPadding = frameTextPadding(Math.max(originalBounds.width, initialTextSize.width), Math.max(originalBounds.height, initialTextSize.height));
  const requiredWidth = initialTextSize.width + initialPadding * 2;
  const requiredHeight = initialTextSize.height + initialPadding * 2;
  const scaleX = Math.max(0.01, Math.abs(frame.transform.scaleX));
  const scaleY = Math.max(0.01, Math.abs(frame.transform.scaleY));
  let framePatch: Partial<TextFrameObject> | undefined;

  if (frame.type === "shape" && (requiredWidth > originalBounds.width || requiredHeight > originalBounds.height)) {
    const nextDisplayWidth = Math.max(originalBounds.width, requiredWidth);
    const nextDisplayHeight = Math.max(originalBounds.height, requiredHeight);
    framePatch = {
      width: nextDisplayWidth / scaleX,
      height: nextDisplayHeight / scaleY,
      transform: {
        ...frame.transform,
        x: frame.transform.x - (nextDisplayWidth - originalBounds.width) / 2,
        y: frame.transform.y - (nextDisplayHeight - originalBounds.height) / 2,
      },
    } as Partial<TextFrameObject>;
  }

  const nextFrame = mergeFrame(frame, framePatch);
  const bounds = objectDisplayBounds(nextFrame);
  const padding = frameTextPadding(bounds.width, bounds.height);
  const innerWidth = Math.max(32, bounds.width - padding * 2);
  const innerHeight = Math.max(32, bounds.height - padding * 2);
  const fontSize = frame.type === "bubble"
    ? fitFrameTextFontSize(text, writingMode, innerWidth, innerHeight, preferredFontSize, lineHeight)
    : preferredFontSize;
  const textSize = estimateTextSize(text, writingMode, fontSize, lineHeight);
  const minY = bounds.y + padding;
  const maxY = bounds.y + bounds.height - padding - textSize.height;
  const centeredY = bounds.y + (bounds.height - textSize.height) / 2;
  const y = maxY >= minY ? clamp(centeredY, minY, maxY) : centeredY;

  return {
    frame: nextFrame,
    framePatch,
    textPatch: {
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
        rotation: nextFrame.transform.rotation,
        flipX: false,
        flipY: false,
      },
      opacity: options.existingText?.opacity ?? 1,
      visible: options.existingText?.visible ?? true,
      locked: options.existingText?.locked ?? false,
    },
  };
}

export function createFrameTextPatch(frame: TextFrameObject, text: string, options: FrameTextOptions = {}): Partial<TextObject> {
  return createFrameTextLayout(frame, text, options).textPatch;
}
