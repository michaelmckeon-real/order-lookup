import { describe, expect, it } from "vitest";
import { getRegionConfig } from "@/lib/region";

function withRegion(value: string | undefined, run: () => void): void {
  const original = process.env.ORDER_REGION;
  if (value === undefined) {
    delete process.env.ORDER_REGION;
  } else {
    process.env.ORDER_REGION = value;
  }
  try {
    run();
  } finally {
    if (original === undefined) {
      delete process.env.ORDER_REGION;
    } else {
      process.env.ORDER_REGION = original;
    }
  }
}

describe("getRegionConfig", () => {
  it("returns Ireland for IE", () => {
    withRegion("IE", () => {
      expect(getRegionConfig()).toEqual({
        region: "IE",
        name: "Ireland",
        titleSuffix: "Ireland",
        timeZone: "Europe/Dublin",
      });
    });
  });

  it("returns the United Kingdom for UK", () => {
    withRegion("UK", () => {
      expect(getRegionConfig()).toEqual({
        region: "UK",
        name: "United Kingdom",
        titleSuffix: "UK",
        timeZone: "Europe/London",
      });
    });
  });

  it("rejects lowercase ie", () => {
    withRegion("ie", () => {
      expect(() => getRegionConfig()).toThrow(
        "ORDER_REGION must be set to IE or UK",
      );
    });
  });

  it("rejects an invented value", () => {
    withRegion("FR", () => {
      expect(() => getRegionConfig()).toThrow(
        "ORDER_REGION must be set to IE or UK",
      );
    });
  });

  it("rejects an empty string", () => {
    withRegion("", () => {
      expect(() => getRegionConfig()).toThrow(
        "ORDER_REGION must be set to IE or UK",
      );
    });
  });

  it("rejects an unset variable", () => {
    withRegion(undefined, () => {
      expect(() => getRegionConfig()).toThrow(
        "ORDER_REGION must be set to IE or UK",
      );
    });
  });
});
