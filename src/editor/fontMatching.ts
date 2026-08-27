import { displayTextForWritingMode } from "../project/model/defaults";
import type { WritingMode } from "../project/model/types";

export type FontCandidate = {
  family: string;
  label: string;
  fallback: "sans-serif" | "serif" | "monospace";
  source: "preset" | "local";
};

export type FontMatchResult = {
  family: string;
  label: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  score: number;
  source: FontCandidate["source"];
};

export type MaskBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BinaryMask = {
  width: number;
  height: number;
  data: Uint8Array;
  bounds: MaskBounds;
  inkCount: number;
};

type LocalFontData = {
  family: string;
};

declare global {
  interface Window {
    queryLocalFonts?: () => Promise<LocalFontData[]>;
  }
}

const PRESET_FONTS: FontCandidate[] = [
  { family: "BIZ UDPGothic", label: "BIZ UDPゴシック", fallback: "sans-serif", source: "preset" },
  { family: "BIZ UDGothic", label: "BIZ UDゴシック", fallback: "sans-serif", source: "preset" },
  { family: "Yu Gothic", label: "游ゴシック", fallback: "sans-serif", source: "preset" },
  { family: "Yu Gothic UI", label: "游ゴシック UI", fallback: "sans-serif", source: "preset" },
  { family: "Meiryo", label: "メイリオ", fallback: "sans-serif", source: "preset" },
  { family: "MS PGothic", label: "MS Pゴシック", fallback: "sans-serif", source: "preset" },
  { family: "MS Gothic", label: "MS ゴシック", fallback: "monospace", source: "preset" },
  { family: "Hiragino Sans", label: "ヒラギノ角ゴ", fallback: "sans-serif", source: "preset" },
  { family: "Hiragino Kaku Gothic ProN", label: "ヒラギノ角ゴ ProN", fallback: "sans-serif", source: "preset" },
  { family: "Noto Sans JP", label: "Noto Sans JP", fallback: "sans-serif", source: "preset" },
  { family: "M PLUS 1p", label: "M PLUS 1p", fallback: "sans-serif", source: "preset" },
  { family: "M PLUS Rounded 1c", label: "M PLUS Rounded 1c", fallback: "sans-serif", source: "preset" },
  { family: "Kosugi Maru", label: "Kosugi Maru", fallback: "sans-serif", source: "preset" },
  { family: "Yu Mincho", label: "游明朝", fallback: "serif", source: "preset" },
  { family: "MS PMincho", label: "MS P明朝", fallback: "serif", source: "preset" },
  { family: "MS Mincho", label: "MS 明朝", fallback: "serif", source: "preset" },
  { family: "Hiragino Mincho ProN", label: "ヒラギノ明朝 ProN", fallback: "serif", source: "preset" },
  { family: "Noto Serif JP", label: "Noto Serif JP", fallback: "serif", source: "preset" },
  { family: "sans-serif", label: "標準ゴシック", fallback: "sans-serif", source: "preset" },
  { family: "serif", label: "標準明朝", fallback: "serif", source: "preset" },
  { family: "monospace", label: "標準等幅", fallback: "monospace", source: "preset" },
];

function fallbackForFamily(family: string): FontCandidate["fallback"] {
  const normalized = family.toLowerCase();
  if (/mincho|明朝|serif|ming|song/.test(normalized)) return "serif";
  if (/mono|等幅/.test(normalized)) return "monospace";
  return "sans-serif";
}

function localFontPriority(family: string): number {
  return /gothic|mincho|hiragino|noto|biz|meiryo|yu |m plus|kosugi|明朝|ゴシック/i.test(family) ? 0 : 1;
}

export async function collectFontCandidates(): Promise<{ candidates: FontCandidate[]; localCount: number; localAccess: "used" | "unavailable" | "denied" }> {
  const candidates = new Map<string, FontCandidate>();
  for (const font of PRESET_FONTS) candidates.set(font.family.toLowerCase(), font);

  if (typeof window === "undefined" || typeof window.queryLocalFonts !== "function") {
    return { candidates: Array.from(candidates.values()), localCount: 0, localAccess: "unavailable" };
  }

  try {
    const localFonts = await Promise.race([
      window.queryLocalFonts(),
      new Promise<LocalFontData[]>((_, reject) => window.setTimeout(() => reject(new Error("Local font access timed out")), 2500)),
    ]);
    const families = Array.from(new Set(localFonts.map((font) => font.family.trim()).filter(Boolean)))
      .sort((left, right) => localFontPriority(left) - localFontPriority(right) || left.localeCompare(right, "ja"))
      .slice(0, 180);
    for (const family of families) {
      const key = family.toLowerCase();
      const existing = candidates.get(key);
      candidates.set(key, existing ? { ...existing, source: "local" } : {
        family,
        label: family,
        fallback: fallbackForFamily(family),
        source: "local",
      });
    }
    return { candidates: Array.from(candidates.values()), localCount: families.length, localAccess: "used" };
  } catch {
    return { candidates: Array.from(candidates.values()), localCount: 0, localAccess: "denied" };
  }
}

export function otsuThreshold(gray: Uint8Array): number {
  const histogram = new Uint32Array(256);
  for (const value of gray) histogram[value] += 1;
  const total = gray.length;
  if (total === 0) return 127;

  let sum = 0;
  for (let index = 0; index < histogram.length; index += 1) sum += index * histogram[index];
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let threshold = 127;

  for (let index = 0; index < histogram.length; index += 1) {
    backgroundWeight += histogram[index];
    if (backgroundWeight === 0) continue;
    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundSum += index * histogram[index];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = index;
    }
  }
  return threshold;
}

function boundsForMask(width: number, height: number, data: Uint8Array): MaskBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!data[y * width + x]) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < minX ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function createForegroundMask(imageData: ImageData): BinaryMask | null {
  const pixelCount = imageData.width * imageData.height;
  const gray = new Uint8Array(pixelCount);
  const opaque = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const alpha = imageData.data[offset + 3];
    opaque[index] = alpha > 16 ? 1 : 0;
    gray[index] = alpha > 16
      ? Math.round(imageData.data[offset] * 0.299 + imageData.data[offset + 1] * 0.587 + imageData.data[offset + 2] * 0.114)
      : 255;
  }

  const threshold = otsuThreshold(gray);
  let darkCount = 0;
  let lightCount = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    if (!opaque[index]) continue;
    if (gray[index] <= threshold) darkCount += 1;
    else lightCount += 1;
  }
  if (darkCount === 0 && lightCount === 0) return null;
  const useDark = darkCount > 0 && (lightCount === 0 || darkCount <= lightCount);
  const data = new Uint8Array(pixelCount);
  let inkCount = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    if (!opaque[index]) continue;
    const isInk = useDark ? gray[index] <= threshold : gray[index] > threshold;
    if (isInk) {
      data[index] = 1;
      inkCount += 1;
    }
  }
  const bounds = boundsForMask(imageData.width, imageData.height, data);
  return bounds && inkCount >= 8 ? { width: imageData.width, height: imageData.height, data, bounds, inkCount } : null;
}

function maskFromAlpha(imageData: ImageData): BinaryMask | null {
  const data = new Uint8Array(imageData.width * imageData.height);
  let inkCount = 0;
  for (let index = 0; index < data.length; index += 1) {
    if (imageData.data[index * 4 + 3] < 52) continue;
    data[index] = 1;
    inkCount += 1;
  }
  const bounds = boundsForMask(imageData.width, imageData.height, data);
  return bounds ? { width: imageData.width, height: imageData.height, data, bounds, inkCount } : null;
}

function cssFontFamily(candidate: FontCandidate): string {
  if (candidate.family === candidate.fallback) return candidate.family;
  return `"${candidate.family.replaceAll('"', "")}", ${candidate.fallback}`;
}

function renderCandidateMask(text: string, writingMode: WritingMode, candidate: FontCandidate, weight: "normal" | "bold", fontSize = 96): BinaryMask | null {
  const shownText = displayTextForWritingMode(text, writingMode).slice(0, 80);
  const lines = shownText.split("\n");
  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");
  if (!measureContext) return null;
  measureContext.font = `${weight} ${fontSize}px ${cssFontFamily(candidate)}`;
  const lineHeight = fontSize * 1.18;
  const measuredWidth = Math.max(fontSize, ...lines.map((line) => measureContext.measureText(line || " ").width));
  const padding = Math.ceil(fontSize * 0.3);
  measureCanvas.width = Math.min(2048, Math.max(8, Math.ceil(measuredWidth + padding * 2)));
  measureCanvas.height = Math.min(2048, Math.max(8, Math.ceil(lines.length * lineHeight + padding * 2)));
  const context = measureCanvas.getContext("2d");
  if (!context) return null;
  context.clearRect(0, 0, measureCanvas.width, measureCanvas.height);
  context.font = `${weight} ${fontSize}px ${cssFontFamily(candidate)}`;
  context.fillStyle = "#000000";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  lines.forEach((line, index) => {
    context.fillText(line || " ", measureCanvas.width / 2, padding + fontSize + index * lineHeight);
  });
  return maskFromAlpha(context.getImageData(0, 0, measureCanvas.width, measureCanvas.height));
}

function normalizeMask(mask: BinaryMask, size = 72): Uint8Array {
  const output = new Uint8Array(size * size);
  const scale = Math.min((size - 6) / mask.bounds.width, (size - 6) / mask.bounds.height);
  const drawWidth = Math.max(1, Math.round(mask.bounds.width * scale));
  const drawHeight = Math.max(1, Math.round(mask.bounds.height * scale));
  const offsetX = Math.floor((size - drawWidth) / 2);
  const offsetY = Math.floor((size - drawHeight) / 2);

  for (let y = 0; y < drawHeight; y += 1) {
    const sourceY = mask.bounds.y + Math.min(mask.bounds.height - 1, Math.floor(y / scale));
    for (let x = 0; x < drawWidth; x += 1) {
      const sourceX = mask.bounds.x + Math.min(mask.bounds.width - 1, Math.floor(x / scale));
      output[(offsetY + y) * size + offsetX + x] = mask.data[sourceY * mask.width + sourceX];
    }
  }
  return output;
}

function dilate(mask: Uint8Array, size: number): Uint8Array {
  const output = new Uint8Array(mask.length);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!mask[y * size + x]) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX >= 0 && nextX < size && nextY >= 0 && nextY < size) output[nextY * size + nextX] = 1;
        }
      }
    }
  }
  return output;
}

function maskSignature(mask: BinaryMask): string {
  const normalized = normalizeMask(mask, 32);
  let hash = 2166136261;
  for (const value of normalized) {
    hash ^= value;
    hash = Math.imul(hash, 16777619);
  }
  return `${mask.bounds.width}:${mask.bounds.height}:${(hash >>> 0).toString(36)}`;
}

export function scoreBinaryMasks(target: BinaryMask, candidate: BinaryMask): number {
  const size = 72;
  const targetMask = normalizeMask(target, size);
  const candidateMask = normalizeMask(candidate, size);
  const dilatedTarget = dilate(targetMask, size);
  const dilatedCandidate = dilate(candidateMask, size);
  let targetInk = 0;
  let candidateInk = 0;
  let targetMatched = 0;
  let candidateMatched = 0;
  for (let index = 0; index < targetMask.length; index += 1) {
    if (targetMask[index]) {
      targetInk += 1;
      if (dilatedCandidate[index]) targetMatched += 1;
    }
    if (candidateMask[index]) {
      candidateInk += 1;
      if (dilatedTarget[index]) candidateMatched += 1;
    }
  }
  if (targetInk === 0 || candidateInk === 0) return 0;
  const precision = candidateMatched / candidateInk;
  const recall = targetMatched / targetInk;
  const shapeScore = 2 * precision * recall / Math.max(0.0001, precision + recall);
  const targetAspect = target.bounds.width / target.bounds.height;
  const candidateAspect = candidate.bounds.width / candidate.bounds.height;
  const aspectScore = Math.exp(-Math.abs(Math.log(targetAspect / candidateAspect)) * 1.2);
  const targetDensity = target.inkCount / (target.bounds.width * target.bounds.height);
  const candidateDensity = candidate.inkCount / (candidate.bounds.width * candidate.bounds.height);
  const densityScore = Math.max(0, 1 - Math.abs(targetDensity - candidateDensity) * 2.5);
  return shapeScore * 0.72 + aspectScore * 0.2 + densityScore * 0.08;
}

export function estimateMatchedFontSize(target: MaskBounds, candidate: MaskBounds, renderedFontSize = 96): number {
  const widthScale = target.width / Math.max(1, candidate.width);
  const heightScale = target.height / Math.max(1, candidate.height);
  const scale = Math.sqrt(widthScale * heightScale);
  return Math.max(8, Math.min(180, Math.round(renderedFontSize * scale)));
}

export async function analyzeFontMatches(imageData: ImageData, text: string, writingMode: WritingMode, candidates: FontCandidate[]): Promise<FontMatchResult[]> {
  const target = createForegroundMask(imageData);
  if (!target) throw new Error("文字の輪郭を見つけられませんでした。");
  const normalizedText = text.trim();
  if (!normalizedText) throw new Error("見本文字を入力してください。");

  const results: FontMatchResult[] = [];
  const seenSignatures = new Set<string>();
  for (const candidate of candidates) {
    for (const fontWeight of ["normal", "bold"] as const) {
      const rendered = renderCandidateMask(normalizedText, writingMode, candidate, fontWeight);
      if (!rendered) continue;
      const signature = `${fontWeight}:${maskSignature(rendered)}`;
      if (seenSignatures.has(signature)) continue;
      seenSignatures.add(signature);
      results.push({
        family: candidate.family,
        label: candidate.label,
        fontFamily: cssFontFamily(candidate),
        fontSize: estimateMatchedFontSize(target.bounds, rendered.bounds),
        fontWeight,
        score: scoreBinaryMasks(target, rendered),
        source: candidate.source,
      });
    }
  }

  return results.sort((left, right) => right.score - left.score).slice(0, 6);
}
