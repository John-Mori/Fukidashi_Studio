import { describe, expect, it } from "vitest";
import { clientPointFromInput } from "../editor/inputPoint";

describe("input point", () => {
  it("reads mouse and pointer coordinates", () => {
    expect(clientPointFromInput({ clientX: 124, clientY: 388 })).toEqual({ x: 124, y: 388 });
  });

  it("reads active iPhone touch coordinates", () => {
    expect(clientPointFromInput({
      touches: [{ clientX: 210, clientY: 516 }],
      changedTouches: [],
    })).toEqual({ x: 210, y: 516 });
  });

  it("falls back to changedTouches for completed touches", () => {
    expect(clientPointFromInput({
      touches: [],
      changedTouches: [{ clientX: 42, clientY: 86 }],
    })).toEqual({ x: 42, y: 86 });
  });

  it("rejects missing and invalid coordinates", () => {
    expect(clientPointFromInput({ clientX: Number.NaN, clientY: 10 })).toBeNull();
    expect(clientPointFromInput({ touches: [] })).toBeNull();
  });
});
