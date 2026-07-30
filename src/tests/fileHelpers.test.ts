import { describe, expect, it } from "vitest";
import { dataUrlToBlob, isAppleMobileDevice } from "../platform/browser/fileHelpers";

describe("browser file helpers", () => {
  it("converts a base64 data URL into an image blob", async () => {
    const blob = dataUrlToBlob("data:image/png;base64,AQID");
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(3);
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.readAsArrayBuffer(blob);
    });
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it("detects iPhone and iPadOS devices for the share sheet", () => {
    expect(isAppleMobileDevice(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      "iPhone",
      5,
    )).toBe(true);
    expect(isAppleMobileDevice(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      "MacIntel",
      5,
    )).toBe(true);
    expect(isAppleMobileDevice(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Win32",
      0,
    )).toBe(false);
  });
});
