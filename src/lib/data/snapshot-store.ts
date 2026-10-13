import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OrderRecord } from "@/lib/lookup/types";

export type SnapshotFile = {
  version: 1;
  asOf: string;
  loadedAt: string;
  sourceFile: string;
  orderCount: number;
  minOrderNumber: number | null;
  maxOrderNumber: number | null;
  orders: Record<string, OrderRecord>;
};

export function dataDir(): string {
  return process.env.DATA_DIR ?? "./data";
}

export function snapshotPath(dir: string = dataDir()): string {
  return path.join(dir, "snapshot.json");
}

export async function readSnapshot(
  dir: string = dataDir(),
): Promise<SnapshotFile | null> {
  try {
    const text = await readFile(snapshotPath(dir), "utf8");
    return JSON.parse(text) as SnapshotFile;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

export async function writeSnapshot(
  snapshot: SnapshotFile,
  dir: string = dataDir(),
): Promise<void> {
  await mkdir(dir, { recursive: true });
  const target = snapshotPath(dir);
  const temp = `${target}.tmp`;
  await writeFile(temp, JSON.stringify(snapshot), "utf8");
  await rename(temp, target);
}
