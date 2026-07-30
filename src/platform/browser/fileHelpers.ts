import type { CanvasSize } from "../../project/model/types";

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function loadImageSize(dataUrl: string): Promise<CanvasSize> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Image decode failed"));
    image.src = dataUrl;
  });
}

export function rgbaToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const separator = dataUrl.indexOf(",");
  if (separator < 0) throw new Error("Invalid data URL");
  const metadata = dataUrl.slice(0, separator);
  const payload = dataUrl.slice(separator + 1);
  const mimeType = metadata.match(/^data:([^;,]+)/)?.[1] ?? "application/octet-stream";
  const bytes = metadata.includes(";base64")
    ? Uint8Array.from(atob(payload), (character) => character.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(payload));
  return new Blob([bytes], { type: mimeType });
}

export function isAppleMobileDevice(
  userAgent = navigator.userAgent,
  platform = navigator.platform,
  maxTouchPoints = navigator.maxTouchPoints,
): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

export type ImageSaveResult = "shared" | "downloaded" | "cancelled";

export async function saveImageDataUrl(
  dataUrl: string,
  fileName: string,
  preferShare = isAppleMobileDevice(),
): Promise<ImageSaveResult> {
  const blob = dataUrlToBlob(dataUrl);
  const file = new File([blob], fileName, { type: blob.type || "image/png" });
  const shareData = { files: [file], title: fileName };

  if (preferShare && typeof navigator.share === "function") {
    const canShareFiles = typeof navigator.canShare !== "function" || navigator.canShare(shareData);
    if (canShareFiles) {
      try {
        await navigator.share(shareData);
        return "shared";
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      }
    }
  }

  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  return "downloaded";
}
