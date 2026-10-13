import { stat } from "node:fs/promises";
import type { OrderSource } from "@/lib/data/source";
import {
  dataDir,
  readSnapshot,
  snapshotPath,
  type SnapshotFile,
} from "@/lib/data/snapshot-store";
import type { OrderRecord, SnapshotMeta } from "@/lib/lookup/types";

type Cache = {
  mtimeMs: number;
  snapshot: SnapshotFile;
};

let cache: Cache | null = null;

async function loadSnapshot(): Promise<SnapshotFile | null> {
  const filePath = snapshotPath(dataDir());
  let mtimeMs: number;
  try {
    mtimeMs = (await stat(filePath)).mtimeMs;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === "ENOENT"
    ) {
      cache = null;
      return null;
    }
    throw error;
  }

  if (cache && cache.mtimeMs === mtimeMs) {
    return cache.snapshot;
  }

  const snapshot = await readSnapshot();
  if (snapshot === null) {
    cache = null;
    return null;
  }
  cache = { mtimeMs, snapshot };
  return snapshot;
}

export const snapshotSource: OrderSource = {
  async getSnapshotMeta(): Promise<SnapshotMeta | null> {
    const snapshot = await loadSnapshot();
    if (snapshot === null) {
      return null;
    }
    return {
      asOf: snapshot.asOf,
      orderCount: snapshot.orderCount,
    };
  },

  async findOrder(key: string): Promise<OrderRecord | null> {
    const snapshot = await loadSnapshot();
    if (snapshot === null) {
      return null;
    }
    return snapshot.orders[key] ?? null;
  },
};

export function clearSnapshotSourceCache(): void {
  cache = null;
}
