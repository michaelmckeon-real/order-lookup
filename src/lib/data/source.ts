import { fixtureSource } from "@/lib/data/fixture-source";
import { snapshotSource } from "@/lib/data/snapshot-source";
import type { OrderRecord, SnapshotMeta } from "@/lib/lookup/types";

export interface OrderSource {
  getSnapshotMeta(): Promise<SnapshotMeta | null>;
  findOrder(key: string): Promise<OrderRecord | null>;
}

const emptySource: OrderSource = {
  async getSnapshotMeta() {
    return null;
  },
  async findOrder() {
    return null;
  },
};

export function getOrderSource(): OrderSource {
  const isProduction = process.env.NODE_ENV === "production";
  const configured = process.env.ORDER_SOURCE;
  const sourceName =
    configured ?? (isProduction ? "snapshot" : "fixtures");

  if (sourceName === "fixtures") {
    if (isProduction) {
      return emptySource;
    }
    return fixtureSource;
  }

  if (sourceName === "snapshot") {
    return snapshotSource;
  }

  throw new Error(
    `ORDER_SOURCE must be "fixtures" or "snapshot", got "${sourceName}"`,
  );
}
