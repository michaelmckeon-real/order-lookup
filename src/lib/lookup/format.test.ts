import { describe, expect, it } from "vitest";
import { formatDateTime, toSnapshotInfo } from "@/lib/lookup/format";
import type { SnapshotMeta } from "@/lib/lookup/types";

describe("formatDateTime", () => {
  it("formats an ISO timestamp in Europe/Dublin", () => {
    expect(formatDateTime("2026-10-12T21:40:12+01:00")).toBe(
      "12 Oct 2026, 21:40",
    );
  });
});

describe("toSnapshotInfo", () => {
  const meta: SnapshotMeta = {
    asOf: "2026-10-12T12:00:00.000Z",
    orderCount: 9,
    minOrderNumber: 9901001,
    maxOrderNumber: 9901010,
  };

  it("is stale with a 9-hour age label", () => {
    const now = new Date("2026-10-12T21:00:00.000Z");
    const info = toSnapshotInfo(meta, now);
    expect(info.isStale).toBe(true);
    expect(info.ageLabel).toBe("9 hours");
  });

  it("is not stale at 1 hour old", () => {
    const now = new Date("2026-10-12T13:00:00.000Z");
    const info = toSnapshotInfo(meta, now);
    expect(info.isStale).toBe(false);
    expect(info.ageLabel).toBe("1 hour");
  });
});
