import { describe, expect, it } from "vitest";
import { allow } from "@/lib/rate-limit";

describe("allow", () => {
  it("refuses the 301st request inside 5 minutes and allows again after the window", () => {
    const start = new Date("2026-06-01T12:00:00.000Z");
    const key = "198.51.100.20";

    for (let count = 0; count < 300; count += 1) {
      expect(allow(key, start)).toEqual({ allowed: true });
    }

    const refused = allow(key, start);
    expect(refused.allowed).toBe(false);
    if (!refused.allowed) {
      expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    }

    const stillInside = new Date(start.getTime() + 5 * 60 * 1000 - 1);
    expect(allow(key, stillInside).allowed).toBe(false);

    expect(allow("198.51.100.21", start)).toEqual({ allowed: true });

    const afterWindow = new Date(start.getTime() + 5 * 60 * 1000);
    expect(allow(key, afterWindow)).toEqual({ allowed: true });
  });
});
