import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readSnapshot,
  writeSnapshot,
  type SnapshotFile,
} from "@/lib/data/snapshot-store";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("snapshot-store", () => {
  it("round-trips a write and leaves no tmp file", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "order-lookup-"));
    tempDirs.push(dir);

    const snapshot: SnapshotFile = {
      version: 1,
      asOf: "2026-10-13T12:00:00.000Z",
      loadedAt: "2026-10-13T12:05:00.000Z",
      sourceFile: "order_lookup.csv",
      orderCount: 1,
      minOrderNumber: 9902001,
      maxOrderNumber: 9902001,
      orders: {
        "9902001": {
          name: "#9902001",
          createdAt: "2026-10-12T09:14:00+01:00",
          cancelledAt: null,
          locationTags: [],
          shippingTitle: "Standard",
          lines: [],
          fulfillments: [],
        },
      },
    };

    await writeSnapshot(snapshot, dir);
    const read = await readSnapshot(dir);
    expect(read).toEqual(snapshot);

    const names = await readdir(dir);
    expect(names).toEqual(["snapshot.json"]);
  });
});
