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

function cardText(card: ReturnType<typeof toCard>): string {
  return JSON.stringify(card);
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
    expect(card.closedLabel).toBe(
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

  it("9901007: with the supplier, ships direct to customer", () => {
    const card = toCard(fixture("#9901007"));
    expect(card.groups[0].now).toEqual({
      kind: "supplier",
      place: "With the supplier",
      detail: "Not yet dispatched",
    });
    expect(card.groups[0].going).toEqual({
      kind: "customer",
      place: "Customer's address",
      detail: "Ships direct to customer",
    });
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

  it("9901012: SFP delivery shows the full name and mapped carrier", () => {
    const card = toCard(fixture("SFP#9901012"));
    expect(card.orderName).toBe("SFP#9901012");
    expect(card.groups[0].now?.place).toBe("With DPD Ireland");
  });

  it("9901014: dispatched store items plus undispatched dropship", () => {
    const card = toCard(fixture("#9901014"));
    expect(card.status).toEqual({
      label: "Partly dispatched",
      tone: "progress",
    });
    expect(card.groups).toHaveLength(2);
    expect(card.groups[0].status.label).toBe("Dispatched");
    expect(card.groups[0].now).toEqual({
      kind: "carrier",
      place: "With DPD Ireland",
      detail: "Dispatched from Castlebar, 12 Oct 2026, 10:57",
    });
    expect(card.groups[0].items.map((item) => item.sku)).toEqual([
      "JBLGO4BLU",
      "ANKUSBCWHT",
    ]);
    expect(card.groups[1].status).toEqual({
      label: "Not yet dispatched",
      tone: "neutral",
    });
    expect(card.groups[1].now).toEqual({
      kind: "supplier",
      place: "With the supplier",
      detail: "Not yet dispatched",
    });
    expect(card.groups[1].going).toEqual({
      kind: "customer",
      place: "Customer's address",
      detail: "Ships direct to customer",
    });
    expect(card.groups[1].items).toEqual([
      {
        quantity: 1,
        title: "Petzl Actik Core Headlamp | Black",
        sku: "DS250999-000001",
      },
    ]);
    expect(
      card.groups.some((group) =>
        group.now?.place?.includes("Allocated across"),
      ),
    ).toBe(false);
  });

  it("9901015: refunded in full before dispatch", () => {
    const card = toCard(fixture("#9901015"));
    expect(card.status).toEqual({ label: "Refunded", tone: "cancelled" });
    expect(card.closedLabel).toBe(
      "Refunded in full. Nothing will be dispatched.",
    );
    expect(card.refundLabel).toBeNull();
    expect(card.groups).toHaveLength(1);
    expect(card.groups[0].status).toEqual({
      label: "Refunded",
      tone: "cancelled",
    });
    expect(card.groups[0].now).toBeNull();
    expect(card.groups[0].going).toBeNull();
    expect(card.groups[0].items).toEqual([
      {
        quantity: 1,
        title: "Samsung Galaxy A56 5G | 128GB | Graphite",
        sku: "SMA566GRA",
      },
    ]);
  });

  it("9901015 with refund none: no items to fulfil", () => {
    const card = toCard({ ...fixture("#9901015"), refund: "none" });
    expect(card.status).toEqual({
      label: "No items to fulfil",
      tone: "neutral",
    });
    expect(card.groups).toHaveLength(0);
    expect(card.closedLabel).toBeNull();
    expect(card.refundLabel).toBeNull();
  });

  it("9901016: partly refunded, rest dispatched", () => {
    const card = toCard(fixture("#9901016"));
    expect(card.status).toEqual({ label: "Dispatched", tone: "progress" });
    expect(card.refundLabel).toBe("Partly refunded");
    expect(card.groups).toHaveLength(1);
    expect(card.groups[0].items.map((item) => item.sku)).toEqual([
      "WH1000XM5B",
    ]);
    expect(card.groups[0].now?.place).toBe("With DPD Ireland");
  });

  it("9901017: dropship dispatched by the supplier with carrier", () => {
    const card = toCard(fixture("#9901017"));
    expect(card.status).toEqual({ label: "Dispatched", tone: "progress" });
    expect(card.groups[0].now).toEqual({
      kind: "carrier",
      place: "With An Post",
      detail: "Dispatched by the supplier, 12 Oct 2026, 16:20",
    });
    expect(card.groups[0].going).toEqual({
      kind: "customer",
      place: "Customer's address",
      detail: "Ships direct to customer",
    });
  });

  it("9901017 with trackingCompany null: supplier dispatch wording", () => {
    const base = fixture("#9901017");
    const card = toCard({
      ...base,
      fulfillments: base.fulfillments.map((item) => ({
        ...item,
        trackingCompany: null,
      })),
    });
    expect(card.groups[0].now).toEqual({
      kind: "supplier",
      place: "With the supplier",
      detail: "Dispatched 12 Oct 2026, 16:20",
    });
    expect(card.groups[0].going).toEqual({
      kind: "customer",
      place: "Customer's address",
      detail: "Ships direct to customer",
    });
  });

  it("9901001 with refund full: still dispatched, refund badge", () => {
    const card = toCard({ ...fixture("#9901001"), refund: "full" });
    expect(card.status).toEqual({ label: "Dispatched", tone: "progress" });
    expect(card.refundLabel).toBe("Refunded");
  });

  it("9901004 with refund full: cancelled plus refund badge", () => {
    const card = toCard({ ...fixture("#9901004"), refund: "full" });
    expect(card.status).toEqual({ label: "Cancelled", tone: "cancelled" });
    expect(card.closedLabel).toBe(
      "Cancelled 11 Oct 2026, 10:15. Nothing will be dispatched.",
    );
    expect(card.refundLabel).toBe("Refunded");
  });

  it("9901007, 9901014 and 9901017 cards never contain Dropship POS", () => {
    for (const name of ["#9901007", "#9901014", "#9901017"]) {
      expect(cardText(toCard(fixture(name)))).not.toContain("Dropship POS");
    }
  });

  it("maps and merges carrier spelling variants into one group", () => {
    const card = toCard({
      name: "#9901999",
      createdAt: "2026-10-12T09:00:00+01:00",
      cancelledAt: null,
      locationTags: ["Swords"],
      shippingTitle: "Standard",
      refund: "none",
      lines: [
        {
          lineId: "L1",
          title: "Item A",
          sku: "A1",
          quantity: 1,
          currentQuantity: 1,
          fulfillableQuantity: 0,
          dropship: false,
        },
        {
          lineId: "L2",
          title: "Item B",
          sku: "B1",
          quantity: 1,
          currentQuantity: 1,
          fulfillableQuantity: 0,
          dropship: false,
        },
      ],
      fulfillments: [
        {
          status: "success",
          createdAt: "2026-10-12T18:00:00+01:00",
          location: "Swords",
          trackingCompany: "dpd-ireland",
          shipmentStatus: null,
          items: [{ lineId: "L1", quantity: 1 }],
        },
        {
          status: "success",
          createdAt: "2026-10-12T18:01:00+01:00",
          location: "Swords",
          trackingCompany: "DPD Ireland",
          shipmentStatus: null,
          items: [{ lineId: "L2", quantity: 1 }],
        },
      ],
    });
    expect(card.groups).toHaveLength(1);
    expect(card.groups[0].now?.place).toBe("With DPD Ireland");
    expect(card.groups[0].items.map((item) => item.quantity)).toEqual([1, 1]);
  });
});
