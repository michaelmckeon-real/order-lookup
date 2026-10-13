import { describe, expect, it } from "vitest";
import { normaliseOrderNumber } from "@/lib/lookup/normalise";

describe("normaliseOrderNumber", () => {
  it("accepts a hash-prefixed number", () => {
    expect(normaliseOrderNumber("#3601731")).toEqual({
      ok: true,
      key: "3601731",
    });
  });

  it("strips spaces and a leading hash", () => {
    expect(normaliseOrderNumber(" # 360 1731 ")).toEqual({
      ok: true,
      key: "3601731",
    });
  });

  it("rejects an empty value", () => {
    expect(normaliseOrderNumber("")).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("rejects a hash in the middle", () => {
    expect(normaliseOrderNumber("39#01")).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects a value longer than 20 characters", () => {
    expect(normaliseOrderNumber("123456789012345678901")).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});
