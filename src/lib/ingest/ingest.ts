import {
  readSnapshot,
  writeSnapshot,
  type SnapshotFile,
} from "@/lib/data/snapshot-store";
import { parseExport } from "@/lib/ingest/parse-export";

export type IngestResult =
  | {
      result: "loaded";
      orderCount: number;
      previousOrderCount: number | null;
      droppedOutsideWindow: number;
      unknownShippingTitles: string[];
      unknownLocations: string[];
    }
  | { result: "missing_columns"; missing: string[] }
  | { result: "no_orders" }
  | { result: "not_newer" }
  | { result: "too_few_orders" };

export async function ingestExport(input: {
  sourceFile: string;
  asOf: string;
  text: string;
  dataDir?: string;
}): Promise<IngestResult> {
  const dir = input.dataDir;
  const parsed = parseExport(input.text, input.asOf);
  if (!parsed.ok) {
    return { result: "missing_columns", missing: parsed.missing };
  }

  if (parsed.report.orderCount === 0) {
    return { result: "no_orders" };
  }

  const current = await readSnapshot(dir);
  if (current !== null) {
    if (!(new Date(input.asOf).getTime() > new Date(current.asOf).getTime())) {
      return { result: "not_newer" };
    }
    if (parsed.report.orderCount < current.orderCount / 2) {
      return { result: "too_few_orders" };
    }
  }

  const orders: SnapshotFile["orders"] = {};
  for (const [key, record] of parsed.records) {
    orders[key] = record;
  }

  const snapshot: SnapshotFile = {
    version: 1,
    asOf: input.asOf,
    loadedAt: new Date().toISOString(),
    sourceFile: input.sourceFile,
    orderCount: parsed.report.orderCount,
    orders,
  };

  await writeSnapshot(snapshot, dir);

  return {
    result: "loaded",
    orderCount: parsed.report.orderCount,
    previousOrderCount: current?.orderCount ?? null,
    droppedOutsideWindow: parsed.report.droppedOutsideWindow,
    unknownShippingTitles: parsed.report.unknownShippingTitles,
    unknownLocations: parsed.report.unknownLocations,
  };
}
