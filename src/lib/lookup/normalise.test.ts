import { describe, expect, it } from "vitest";
import {
  normaliseOrderNumber,
  orderKeyFromName,
} from "@/lib/lookup/normalise";

describe("normaliseOrderNumber", () => {
  it("keys SFP names by their digits", () => {
    expect(normaliseOrderNumber("SFP#3601234")).toEqual({
      ok: true,
      key: "3601234",
    });
  });

  it("accepts a hash-prefixed number", () => {
    expect(normaliseOrderNumber("#3601731")).toEqual({
      ok: true,
      key: "3601731",
    });
  });

  it("strips spaces without a hash", () => {
    expect(normaliseOrderNumber(" 3601 731 ")).toEqual({
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

  it("rejects a non-digit key after the hash", () => {
    expect(normaliseOrderNumber("SFP#36A1")).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects a value longer than 12 digits", () => {
    expect(normaliseOrderNumber("1234567890123")).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});

describe("orderKeyFromName", () => {
  it("returns the digit key or null", () => {
    expect(orderKeyFromName("#3601731")).toBe("3601731");
    expect(orderKeyFromName("SFP#3601234")).toBe("3601234");
    expect(orderKeyFromName("SFP#36A1")).toBeNull();
  });
});
