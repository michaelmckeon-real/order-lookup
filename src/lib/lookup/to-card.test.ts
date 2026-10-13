import { describe, expect, it } from "vitest";
import { fixtureOrders } from "@/lib/data/fixtures";
import { toCard } from "@/lib/lookup/to-card";
import type { OrderRecord } from "@/lib/lookup/types";

function fixture(name: string): OrderRecord {
  const order = fixtureOrders.find((item) => item.name === name);
  if (!order) {
    throw new Error(`Missing fixture ${name}`);
  }
  return order;
}

describe("toCard", () => {
  it("9901001: merges item-by-item fulfilments into one dispatched group", () => {
    const card = toCard(fixture("#9901001"));
    expect(card.status).toEqual({ label: "Dispatched", tone: "progress" });
    expect(card.groups).toHaveLength(1);
    const group = card.groups[0];
    expect(group.now).toEqual({
      kind: "carrier",
      place: "With DPD Ireland",
      detail: "Dispatched from Little Island Cork, 12 Oct 2026, 21:40",
    });
    expect(group.going).toEqual({
      kind: "customer",
      place: "Customer's address",
      detail: "Delivery by DPD Ireland",
    });
    expect(group.items.map((item) => item.quantity)).toEqual([1, 2]);
  });

  it("9901002: collection not collected yet", () => {
    const card = toCard(fixture("#9901002"));
    expect(card.orderType).toBe("Collection");
    expect(card.status).toEqual({
      label: "Not collected yet",
      tone: "neutral",
    });
    expect(card.groups[0].now).toEqual({
      kind: "unknown",
      place: "Not confirmed yet",
      detail: null,
    });
    expect(card.groups[0].going).toEqual({
      kind: "collection_store",
      place: "Tallaght",
      detail: "Collection store",
    });
  });

  it("9901003: partly dispatched with two groups", () => {
    const card = toCard(fixture("#9901003"));
    expect(card.status).toEqual({
      label: "Partly dispatched",
      tone: "progress",
    });
    expect(card.groups).toHaveLength(2);
    expect(card.groups[0].status.label).toBe("Dispatched");
    expect(card.groups[0].now?.place).toBe("With DPD Ireland");
    expect(card.groups[1].status.label).toBe("Not yet dispatched");
    expect(card.groups[1].now?.place).toBe("Blanchardstown");
  });

  it("9901004: cancelled with original quantities", () => {
    const card = toCard(fixture("#9901004"));
    expect(card.status).toEqual({ label: "Cancelled", tone: "cancelled" });
    expect(card.cancelledLabel).toBe(
      "Cancelled 11 Oct 2026, 10:15. Nothing will be dispatched.",
    );
    expect(card.groups[0].items.map((item) => item.quantity)).toEqual([1, 1]);
  });

  it("9901005: allocated across two stores", () => {
    const card = toCard(fixture("#9901005"));
    expect(card.groups[0].now?.place).toBe(
      "Allocated across Swords and Galway",
    );
  });

  it("9901006: finding stock", () => {
    const card = toCard(fixture("#9901006"));
    expect(card.groups[0].now).toEqual({
      kind: "finding_stock",
      place: "Finding stock",
      detail: "Being allocated to a store",
    });
  });

  it("9901007: with the supplier", () => {
    const card = toCard(fixture("#9901007"));
    expect(card.groups[0].now?.place).toBe("With the supplier");
  });

  it("9901008: delivered", () => {
    const card = toCard(fixture("#9901008"));
    expect(card.status).toEqual({ label: "Delivered", tone: "done" });
  });

  it("9901010: collected", () => {
    const card = toCard(fixture("#9901010"));
    expect(card.status).toEqual({ label: "Collected", tone: "done" });
    expect(card.groups[0].now?.detail).toBe(
      "From Galway, 10 Oct 2026, 15:22",
    );
  });
});
