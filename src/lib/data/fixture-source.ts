import { fixtureOrders } from "@/lib/data/fixtures";
import type { OrderSource } from "@/lib/data/source";
import { normaliseOrderNumber } from "@/lib/lookup/normalise";
import type { OrderRecord, SnapshotMeta } from "@/lib/lookup/types";

function fixtureAsOf(now: Date): string {
  const hours = Number(process.env.FIXTURE_DATA_AGE_HOURS ?? "1");
  const ageMs = (Number.isFinite(hours) ? hours : 1) * 60 * 60 * 1000;
  const asOfMs = Math.floor((now.getTime() - ageMs) / 60_000) * 60_000;
  return new Date(asOfMs).toISOString();
}

function noDataEnabled(): boolean {
  return process.env.FIXTURE_NO_DATA === "1";
}

const ordersByKey = new Map<string, OrderRecord>();
for (const order of fixtureOrders) {
  const result = normaliseOrderNumber(order.name);
  if (result.ok) {
    ordersByKey.set(result.key, order);
  }
}

export const fixtureSource: OrderSource = {
  async getSnapshotMeta(): Promise<SnapshotMeta | null> {
    if (noDataEnabled()) {
      return null;
    }
    return {
      asOf: fixtureAsOf(new Date()),
      orderCount: 10,
      minOrderNumber: 9901001,
      maxOrderNumber: 9901012,
    };
  },

  async findOrder(key: string): Promise<OrderRecord | null> {
    if (noDataEnabled()) {
      return null;
    }
    return ordersByKey.get(key) ?? null;
  },
};
