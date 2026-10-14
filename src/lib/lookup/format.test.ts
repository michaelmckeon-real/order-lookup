import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatRefreshedAgo,
  toSnapshotInfo,
} from "@/lib/lookup/format";
import type { SnapshotMeta } from "@/lib/lookup/types";

describe("formatDateTime", () => {
  it("formats an ISO timestamp in Europe/Dublin", () => {
    expect(formatDateTime("2026-10-12T21:40:12+01:00")).toBe(
      "12 Oct 2026, 21:40",
    );
  });
});

describe("formatRefreshedAgo", () => {
  const asOf = "2026-10-14T12:00:00.000Z";
  const asOfMs = Date.parse(asOf);

  it('returns "just now" under 1 minute', () => {
    expect(formatRefreshedAgo(asOf, asOfMs + 30_000)).toBe("just now");
  });

  it('returns "1 minute ago" at 1 minute', () => {
    expect(formatRefreshedAgo(asOf, asOfMs + 60_000)).toBe("1 minute ago");
  });

  it('returns "59 minutes ago" at 59 minutes', () => {
    expect(formatRefreshedAgo(asOf, asOfMs + 59 * 60_000)).toBe(
      "59 minutes ago",
    );
  });

  it('returns "1 hour ago" at 60 minutes', () => {
    expect(formatRefreshedAgo(asOf, asOfMs + 60 * 60_000)).toBe("1 hour ago");
  });

  it('returns "1 hour ago" at 119 minutes', () => {
    expect(formatRefreshedAgo(asOf, asOfMs + 119 * 60_000)).toBe("1 hour ago");
  });

  it('returns "23 hours ago" at 23 hours 59 minutes', () => {
    expect(formatRefreshedAgo(asOf, asOfMs + (23 * 60 + 59) * 60_000)).toBe(
      "23 hours ago",
    );
  });

  it('returns "1 day ago" at 24 hours', () => {
    expect(formatRefreshedAgo(asOf, asOfMs + 24 * 60 * 60_000)).toBe(
      "1 day ago",
    );
  });

  it('returns "2 days ago" at 49 hours', () => {
    expect(formatRefreshedAgo(asOf, asOfMs + 49 * 60 * 60_000)).toBe(
      "2 days ago",
    );
  });

  it('returns "just now" when asOf is in the future', () => {
    expect(formatRefreshedAgo(asOf, asOfMs - 2 * 60_000)).toBe("just now");
  });
});

describe("toSnapshotInfo", () => {
  const meta: SnapshotMeta = {
    asOf: "2026-10-12T12:00:00.000Z",
    orderCount: 9,
  };

  it("is stale with a 9-hour age label", () => {
    const now = new Date("2026-10-12T21:00:00.000Z");
    const info = toSnapshotInfo(meta, now);
    expect(info.asOf).toBe(meta.asOf);
    expect(info.isStale).toBe(true);
    expect(info.ageLabel).toBe("9 hours");
  });

  it("is not stale at 1 hour old", () => {
    const now = new Date("2026-10-12T13:00:00.000Z");
    const info = toSnapshotInfo(meta, now);
    expect(info.asOf).toBe(meta.asOf);
    expect(info.isStale).toBe(false);
    expect(info.ageLabel).toBe("1 hour");
  });
});
