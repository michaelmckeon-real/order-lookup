import {
  readSnapshot,
  writeSnapshot,
  type SnapshotFile,
} from "@/lib/data/snapshot-store";
import { parseExport, type ParseCounts } from "@/lib/ingest/parse-export";

export type IngestResult =
  | {
      result: "loaded";
      orderCount: number;
      previousOrderCount: number | null;
      unknownShippingTitles: string[];
      unknownLocations: string[];
      counts: ParseCounts;
    }
  | { result: "missing_columns"; missing: string[] }
  | { result: "no_orders"; counts: ParseCounts }
  | { result: "not_newer"; counts: ParseCounts }
  | { result: "too_few_orders"; counts: ParseCounts };

export async function ingestExport(input: {
  sourceFile: string;
  asOf: string;
  text: string;
  dataDir?: string;
}): Promise<IngestResult> {
  const dir = input.dataDir;
  const parsed = parseExport(input.text);
  if (!parsed.ok) {
    return { result: "missing_columns", missing: parsed.missing };
  }

  if (parsed.report.orderCount === 0) {
    return { result: "no_orders", counts: parsed.report.counts };
  }

  const current = await readSnapshot(dir);
  if (current !== null) {
    if (!(new Date(input.asOf).getTime() > new Date(current.asOf).getTime())) {
      return { result: "not_newer", counts: parsed.report.counts };
    }
    if (parsed.report.orderCount < current.orderCount / 2) {
      return { result: "too_few_orders", counts: parsed.report.counts };
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
    oldestCreatedAt: parsed.report.oldestCreatedAt,
    orders,
  };

  await writeSnapshot(snapshot, dir);

  return {
    result: "loaded",
    orderCount: parsed.report.orderCount,
    previousOrderCount: current?.orderCount ?? null,
    unknownShippingTitles: parsed.report.unknownShippingTitles,
    unknownLocations: parsed.report.unknownLocations,
    counts: parsed.report.counts,
  };
}
