import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ingestExport } from "@/lib/ingest/ingest";
import { snapshotPath, writeSnapshot } from "@/lib/data/snapshot-store";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

const header =
  "ID,Name,Tags,Created At,Cancelled At,Line: Type,Line: ID,Line: Title,Line: SKU,Line: Quantity,Line: Current Quantity,Line: Fulfillable Quantity,Fulfillment: ID,Fulfillment: Status,Fulfillment: Created At,Fulfillment: Location,Fulfillment: Tracking Company,Fulfillment: Shipment Status";

function csvForOrders(
  orders: { id: string; name: string; created: string }[],
): string {
  const rows = [header];
  for (const order of orders) {
    rows.push(
      `${order.id},${order.name},,${order.created},,Line Item,L1,Item,SKU1,1,1,1,,,,,,`,
      `${order.id},${order.name},,${order.created},,Shipping Line,,Standard,,1,1,0,,,,,,`,
    );
  }
  return `${rows.join("\n")}\n`;
}

async function seedSnapshot(
  dir: string,
  asOf: string,
  orderCount: number,
): Promise<string> {
  const orders: Record<
    string,
    {
      name: string;
      createdAt: string;
      cancelledAt: null;
      locationTags: string[];
      shippingTitle: string;
      refund: "none";
      lines: [];
      fulfillments: [];
    }
  > = {};
  for (let i = 0; i < orderCount; i += 1) {
    const key = String(9903000 + i);
    orders[key] = {
      name: `#${key}`,
      createdAt: "2026-10-12T09:00:00+01:00",
      cancelledAt: null,
      locationTags: [],
      shippingTitle: "Standard",
      refund: "none",
      lines: [],
      fulfillments: [],
    };
  }
  await writeSnapshot(
    {
      version: 1,
      asOf,
      loadedAt: asOf,
      sourceFile: "order_lookup.csv",
      orderCount,
      orders,
    },
    dir,
  );
  return readFile(snapshotPath(dir), "utf8");
}

describe("ingestExport", () => {
  it("refuses missing columns without changing the snapshot", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "order-lookup-"));
    tempDirs.push(dir);
    const before = await seedSnapshot(dir, "2026-10-12T12:00:00.000Z", 4);

    const outcome = await ingestExport({
      sourceFile: "order_lookup.csv",
      asOf: "2026-10-13T12:00:00.000Z",
      text: "ID,Name\n1,#1\n",
      dataDir: dir,
    });

    expect(outcome.result).toBe("missing_columns");
    expect(await readFile(snapshotPath(dir), "utf8")).toBe(before);
  });

  it("refuses when not newer without changing the snapshot", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "order-lookup-"));
    tempDirs.push(dir);
    const before = await seedSnapshot(dir, "2026-10-13T12:00:00.000Z", 4);
    const text = csvForOrders([
      {
        id: "1",
        name: "#9903101",
        created: "2026-10-12 09:00:00 +0100",
      },
      {
        id: "2",
        name: "#9903102",
        created: "2026-10-12 10:00:00 +0100",
      },
      {
        id: "3",
        name: "#9903103",
        created: "2026-10-12 11:00:00 +0100",
      },
      {
        id: "4",
        name: "#9903104",
        created: "2026-10-12 12:00:00 +0100",
      },
    ]);

    const outcome = await ingestExport({
      sourceFile: "order_lookup.csv",
      asOf: "2026-10-13T11:00:00.000Z",
      text,
      dataDir: dir,
    });

    expect(outcome.result).toBe("not_newer");
    expect(await readFile(snapshotPath(dir), "utf8")).toBe(before);
  });

  it("refuses too_few_orders without changing the snapshot", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "order-lookup-"));
    tempDirs.push(dir);
    const before = await seedSnapshot(dir, "2026-10-12T12:00:00.000Z", 10);
    const text = csvForOrders([
      {
        id: "1",
        name: "#9903201",
        created: "2026-10-12 09:00:00 +0100",
      },
      {
        id: "2",
        name: "#9903202",
        created: "2026-10-12 10:00:00 +0100",
      },
      {
        id: "3",
        name: "#9903203",
        created: "2026-10-12 11:00:00 +0100",
      },
      {
        id: "4",
        name: "#9903204",
        created: "2026-10-12 12:00:00 +0100",
      },
    ]);

    const outcome = await ingestExport({
      sourceFile: "order_lookup.csv",
      asOf: "2026-10-13T12:00:00.000Z",
      text,
      dataDir: dir,
    });

    expect(outcome.result).toBe("too_few_orders");
    expect(await readFile(snapshotPath(dir), "utf8")).toBe(before);
  });

  it("loads and replaces the snapshot", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "order-lookup-"));
    tempDirs.push(dir);
    await seedSnapshot(dir, "2026-10-12T12:00:00.000Z", 2);
    const text = csvForOrders([
      {
        id: "1",
        name: "#9903301",
        created: "2026-10-12 09:00:00 +0100",
      },
      {
        id: "2",
        name: "#9903302",
        created: "2026-10-12 10:00:00 +0100",
      },
      {
        id: "3",
        name: "#9903303",
        created: "2026-10-12 11:00:00 +0100",
      },
    ]);

    const outcome = await ingestExport({
      sourceFile: "order_lookup.csv",
      asOf: "2026-10-13T12:00:00.000Z",
      text,
      dataDir: dir,
    });

    expect(outcome).toMatchObject({
      result: "loaded",
      orderCount: 3,
      previousOrderCount: 2,
    });
    const stored = JSON.parse(await readFile(snapshotPath(dir), "utf8")) as {
      orderCount: number;
      asOf: string;
    };
    expect(stored.orderCount).toBe(3);
    expect(stored.asOf).toBe("2026-10-13T12:00:00.000Z");
  });

  it("refuses no_orders without writing a snapshot", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "order-lookup-"));
    tempDirs.push(dir);
    await writeFile(path.join(dir, "marker.txt"), "x", "utf8");

    const text = csvForOrders([
      {
        id: "1",
        name: "#9903401",
        created: "2025-01-01 09:00:00 +0100",
      },
    ]);

    const outcome = await ingestExport({
      sourceFile: "order_lookup.csv",
      asOf: "2026-10-13T12:00:00.000Z",
      text,
      dataDir: dir,
    });

    expect(outcome.result).toBe("no_orders");
    await expect(readFile(snapshotPath(dir), "utf8")).rejects.toBeTruthy();
  });
});
