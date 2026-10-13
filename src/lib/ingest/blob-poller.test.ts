import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeSnapshot, snapshotPath } from "@/lib/data/snapshot-store";
import {
  startBlobPoller,
  type BlobSource,
  type Clock,
} from "@/lib/ingest/blob-poller";

const tempDirs: string[] = [];
const originalDataDir = process.env.DATA_DIR;
const originalAccount = process.env.ORDER_BLOB_ACCOUNT;
const originalContainer = process.env.ORDER_BLOB_CONTAINER;
const originalName = process.env.ORDER_BLOB_NAME;

afterEach(async () => {
  process.env.DATA_DIR = originalDataDir;
  process.env.ORDER_BLOB_ACCOUNT = originalAccount;
  process.env.ORDER_BLOB_CONTAINER = originalContainer;
  process.env.ORDER_BLOB_NAME = originalName;
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
  vi.restoreAllMocks();
});

const header =
  "ID,Name,Tags,Created At,Cancelled At,Line: Type,Line: ID,Line: Title,Line: SKU,Line: Quantity,Line: Current Quantity,Line: Fulfillable Quantity,Fulfillment: ID,Fulfillment: Status,Fulfillment: Created At,Fulfillment: Location,Fulfillment: Tracking Company,Fulfillment: Shipment Status";

function makeCsv(orderCount: number): string {
  const rows = [header];
  for (let i = 0; i < orderCount; i += 1) {
    const id = String(200 + i);
    const name = `#9904${String(i).padStart(3, "0")}`;
    rows.push(
      `${id},${name},,2026-10-12 09:00:00 +0100,,Line Item,L1,Item,SKU1,1,1,1,,,,,,`,
      `${id},${name},,2026-10-12 09:00:00 +0100,,Shipping Line,,Standard,,1,1,0,,,,,,`,
    );
  }
  return `${rows.join("\n")}\n`;
}

function createClock(): Clock & {
  handlers: Array<() => void>;
  advance(): void;
} {
  const handlers: Array<() => void> = [];
  return {
    handlers,
    now: () => new Date("2026-10-13T12:00:00.000Z"),
    setInterval(handler) {
      handlers.push(handler);
      return {
        clear() {
          const index = handlers.indexOf(handler);
          if (index >= 0) {
            handlers.splice(index, 1);
          }
        },
      };
    },
    advance() {
      for (const handler of [...handlers]) {
        handler();
      }
    },
  };
}

describe("startBlobPoller", () => {
  it("skips without downloading when the blob is not newer", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "order-lookup-"));
    tempDirs.push(dir);
    process.env.DATA_DIR = dir;
    process.env.ORDER_BLOB_ACCOUNT = "acct";
    process.env.ORDER_BLOB_CONTAINER = "cont";
    process.env.ORDER_BLOB_NAME = "order_lookup.csv";

    await writeSnapshot(
      {
        version: 1,
        asOf: "2026-10-13T12:00:00.000Z",
        loadedAt: "2026-10-13T12:00:00.000Z",
        sourceFile: "order_lookup.csv",
        orderCount: 2,
        minOrderNumber: 1,
        maxOrderNumber: 2,
        orders: {},
      },
      dir,
    );

    const download = vi.fn(async () => Buffer.from(makeCsv(2)));
    const source: BlobSource = {
      async getProperties() {
        return {
          lastModified: new Date("2026-10-13T11:00:00.000Z"),
          etag: "etag-old",
          contentLength: 100,
        };
      },
      download,
    };

    const clock = createClock();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const handle = startBlobPoller(source, clock);
    await Promise.resolve();
    await Promise.resolve();
    expect(download).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    handle?.stop();
  });

  it("loads when the blob is newer", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "order-lookup-"));
    tempDirs.push(dir);
    process.env.DATA_DIR = dir;
    process.env.ORDER_BLOB_ACCOUNT = "acct";
    process.env.ORDER_BLOB_CONTAINER = "cont";
    process.env.ORDER_BLOB_NAME = "order_lookup.csv";

    const download = vi.fn(async () => Buffer.from(makeCsv(3)));
    const source: BlobSource = {
      async getProperties() {
        return {
          lastModified: new Date("2026-10-13T15:00:00.000Z"),
          etag: "etag-new",
          contentLength: 200,
        };
      },
      download,
    };

    const clock = createClock();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const handle = startBlobPoller(source, clock);
    await vi.waitFor(async () => {
      const text = await readFile(snapshotPath(dir), "utf8");
      expect(JSON.parse(text).orderCount).toBe(3);
    });
    expect(download).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalled();
    handle?.stop();
  });

  it("refuses a short file once and does not download that etag again", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "order-lookup-"));
    tempDirs.push(dir);
    process.env.DATA_DIR = dir;
    process.env.ORDER_BLOB_ACCOUNT = "acct";
    process.env.ORDER_BLOB_CONTAINER = "cont";
    process.env.ORDER_BLOB_NAME = "order_lookup.csv";

    await writeSnapshot(
      {
        version: 1,
        asOf: "2026-10-12T12:00:00.000Z",
        loadedAt: "2026-10-12T12:00:00.000Z",
        sourceFile: "order_lookup.csv",
        orderCount: 10,
        minOrderNumber: 1,
        maxOrderNumber: 10,
        orders: {},
      },
      dir,
    );
    const before = await readFile(snapshotPath(dir), "utf8");

    const download = vi.fn(async () => Buffer.from(makeCsv(2)));
    const source: BlobSource = {
      async getProperties() {
        return {
          lastModified: new Date("2026-10-13T15:00:00.000Z"),
          etag: "etag-short",
          contentLength: 50,
        };
      },
      download,
    };

    const clock = createClock();
    vi.spyOn(console, "info").mockImplementation(() => {});
    const handle = startBlobPoller(source, clock);
    await vi.waitFor(() => {
      expect(download).toHaveBeenCalledTimes(1);
    });
    expect(await readFile(snapshotPath(dir), "utf8")).toBe(before);

    clock.advance();
    await Promise.resolve();
    await Promise.resolve();
    expect(download).toHaveBeenCalledTimes(1);
    handle?.stop();
  });

  it("keeps the snapshot when a download throws", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "order-lookup-"));
    tempDirs.push(dir);
    process.env.DATA_DIR = dir;
    process.env.ORDER_BLOB_ACCOUNT = "acct";
    process.env.ORDER_BLOB_CONTAINER = "cont";
    process.env.ORDER_BLOB_NAME = "order_lookup.csv";

    await writeSnapshot(
      {
        version: 1,
        asOf: "2026-10-12T12:00:00.000Z",
        loadedAt: "2026-10-12T12:00:00.000Z",
        sourceFile: "order_lookup.csv",
        orderCount: 4,
        minOrderNumber: 1,
        maxOrderNumber: 4,
        orders: {},
      },
      dir,
    );
    const before = await readFile(snapshotPath(dir), "utf8");

    const source: BlobSource = {
      async getProperties() {
        return {
          lastModified: new Date("2026-10-13T15:00:00.000Z"),
          etag: "etag-err",
          contentLength: 50,
        };
      },
      async download() {
        const error = new Error("network");
        error.name = "NetworkError";
        throw error;
      },
    };

    const clock = createClock();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const handle = startBlobPoller(source, clock);
    await vi.waitFor(() => {
      expect(info).toHaveBeenCalled();
    });
    expect(await readFile(snapshotPath(dir), "utf8")).toBe(before);
    handle?.stop();
  });

  it("never runs two polls at once", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "order-lookup-"));
    tempDirs.push(dir);
    process.env.DATA_DIR = dir;
    process.env.ORDER_BLOB_ACCOUNT = "acct";
    process.env.ORDER_BLOB_CONTAINER = "cont";
    process.env.ORDER_BLOB_NAME = "order_lookup.csv";

    let releases = 0;
    let resolveDownload: (() => void) | undefined;
    const download = vi.fn(
      () =>
        new Promise<Buffer>((resolve) => {
          resolveDownload = () => {
            releases += 1;
            resolve(Buffer.from(makeCsv(3)));
          };
        }),
    );

    const source: BlobSource = {
      async getProperties() {
        return {
          lastModified: new Date("2026-10-13T15:00:00.000Z"),
          etag: `etag-${releases}`,
          contentLength: 50,
        };
      },
      download,
    };

    const clock = createClock();
    vi.spyOn(console, "info").mockImplementation(() => {});
    const handle = startBlobPoller(source, clock);
    await vi.waitFor(() => {
      expect(download).toHaveBeenCalledTimes(1);
    });
    clock.advance();
    await Promise.resolve();
    expect(download).toHaveBeenCalledTimes(1);
    resolveDownload?.();
    await vi.waitFor(async () => {
      await readFile(snapshotPath(dir), "utf8");
    });
    handle?.stop();
  });
});
