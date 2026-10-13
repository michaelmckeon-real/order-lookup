import {
  displayLocation,
  isDeliveryTitle,
  matchCollectionStore,
  matchLocation,
  matchStore,
  rules,
} from "@/lib/config";
import { formatDateTime } from "@/lib/lookup/format";
import type {
  CardGroup,
  CardNode,
  CardStatus,
  OrderCard,
  OrderRecord,
} from "@/lib/lookup/types";

type Line = OrderRecord["lines"][number];
type Fulfilment = OrderRecord["fulfillments"][number];
type Outcome = "collected" | "delivered" | "dispatched";

function orderTypeOf(
  shippingTitle: string | null,
): {
  orderType: OrderCard["orderType"];
  collectionStore: string | null;
} {
  if (shippingTitle !== null) {
    const store =
      matchStore(shippingTitle) ?? matchCollectionStore(shippingTitle);
    if (store) {
      return { orderType: "Collection", collectionStore: store };
    }
    if (isDeliveryTitle(shippingTitle)) {
      return { orderType: "Delivery", collectionStore: null };
    }
  }
  return { orderType: "Unknown", collectionStore: null };
}

function listPlaces(names: string[]): string {
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  const head = names.slice(0, -1).join(", ");
  return `${head} and ${names[names.length - 1]}`;
}

function outcomeOf(
  fulfilment: Fulfilment,
  orderType: OrderCard["orderType"],
): Outcome {
  if (orderType === "Collection") {
    return "collected";
  }
  if (fulfilment.shipmentStatus?.toLowerCase() === "delivered") {
    return "delivered";
  }
  return "dispatched";
}

type AggregatedFulfilment = {
  outcome: Outcome;
  place: string;
  trackingCompany: string | null;
  latestCreatedAt: string;
  itemsByLineId: Map<string, number>;
};

function aggregateSuccessfulFulfilments(
  fulfillments: Fulfilment[],
  linesById: Map<string, Line>,
  orderType: OrderCard["orderType"],
): AggregatedFulfilment[] {
  const groups = new Map<string, AggregatedFulfilment>();

  for (const fulfilment of fulfillments) {
    if (fulfilment.status.toLowerCase() !== "success") {
      continue;
    }

    const lineQuantities = new Map<string, number>();
    for (const item of fulfilment.items) {
      if (!linesById.has(item.lineId)) {
        continue;
      }
      lineQuantities.set(
        item.lineId,
        (lineQuantities.get(item.lineId) ?? 0) + item.quantity,
      );
    }
    if (lineQuantities.size === 0) {
      continue;
    }

    const outcome = outcomeOf(fulfilment, orderType);
    const place = displayLocation(fulfilment.location ?? "");
    const trackingCompany = fulfilment.trackingCompany;
    const key = `${outcome}\0${place}\0${trackingCompany ?? ""}`;

    let group = groups.get(key);
    if (!group) {
      group = {
        outcome,
        place,
        trackingCompany,
        latestCreatedAt: fulfilment.createdAt,
        itemsByLineId: new Map(),
      };
      groups.set(key, group);
    } else if (fulfilment.createdAt > group.latestCreatedAt) {
      group.latestCreatedAt = fulfilment.createdAt;
    }

    for (const [lineId, quantity] of lineQuantities) {
      group.itemsByLineId.set(
        lineId,
        (group.itemsByLineId.get(lineId) ?? 0) + quantity,
      );
    }
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.latestCreatedAt.localeCompare(b.latestCreatedAt),
  );
}

function itemsFromAggregate(
  aggregate: AggregatedFulfilment,
  linesById: Map<string, Line>,
): { quantity: number; title: string; sku: string }[] {
  const items: { quantity: number; title: string; sku: string }[] = [];
  for (const [lineId, quantity] of aggregate.itemsByLineId) {
    const line = linesById.get(lineId);
    if (!line) {
      continue;
    }
    items.push({
      quantity,
      title: line.title,
      sku: line.sku,
    });
  }
  return items;
}

function buildFulfilledGroup(
  aggregate: AggregatedFulfilment,
  linesById: Map<string, Line>,
  collectionStore: string | null,
): CardGroup {
  const items = itemsFromAggregate(aggregate, linesById);
  const dateLabel = formatDateTime(aggregate.latestCreatedAt);

  if (aggregate.outcome === "collected") {
    const storeLabel = collectionStore ?? aggregate.place;
    return {
      status: { label: "Collected", tone: "done" },
      now: {
        kind: "done",
        place: "Collected",
        detail: `From ${storeLabel}, ${dateLabel}`,
      },
      going: null,
      items,
    };
  }

  if (aggregate.outcome === "delivered") {
    return {
      status: { label: "Delivered", tone: "done" },
      now: {
        kind: "done",
        place: "Delivered",
        detail: aggregate.trackingCompany
          ? `By ${aggregate.trackingCompany}`
          : null,
      },
      going: null,
      items,
    };
  }

  if (aggregate.trackingCompany) {
    return {
      status: { label: "Dispatched", tone: "progress" },
      now: {
        kind: "carrier",
        place: `With ${aggregate.trackingCompany}`,
        detail: `Dispatched from ${aggregate.place}, ${dateLabel}`,
      },
      going: {
        kind: "customer",
        place: "Customer's address",
        detail: `Delivery by ${aggregate.trackingCompany}`,
      },
      items,
    };
  }

  return {
    status: { label: "Dispatched", tone: "progress" },
    now: {
      kind: "store",
      place: aggregate.place,
      detail: `Dispatched ${dateLabel}`,
    },
    going: {
      kind: "customer",
      place: "Customer's address",
      detail: "Home delivery",
    },
    items,
  };
}

function buildUnfulfilledGroup(
  lines: Line[],
  orderType: OrderCard["orderType"],
  collectionStore: string | null,
  locationTags: string[],
): CardGroup | null {
  const items = lines
    .filter((line) => line.fulfillableQuantity > 0)
    .map((line) => ({
      quantity: line.fulfillableQuantity,
      title: line.title,
      sku: line.sku,
    }));
  if (items.length === 0) {
    return null;
  }

  let status: CardStatus;
  if (orderType === "Collection") {
    status = { label: "Not collected yet", tone: "neutral" };
  } else if (orderType === "Delivery") {
    status = { label: "Not yet dispatched", tone: "neutral" };
  } else {
    status = { label: "Not yet fulfilled", tone: "neutral" };
  }

  const useTags =
    orderType !== "Unknown" &&
    rules.locationFromTag[orderType] === true &&
    locationTags.length > 0;

  let now: CardNode;
  if (useTags) {
    if (locationTags.length === 1) {
      const matched = matchLocation(locationTags[0]);
      if (matched?.kind === "store") {
        now = {
          kind: "store",
          place: matched.name,
          detail:
            orderType === "Delivery"
              ? "Not yet dispatched"
              : "Not yet sent",
        };
      } else if (matched) {
        now = {
          kind: matched.kind,
          place: matched.label,
          detail: matched.detail,
        };
      } else {
        now = { kind: "unknown", place: "Not confirmed yet", detail: null };
      }
    } else {
      now = {
        kind: "multiple",
        place: `Allocated across ${listPlaces(locationTags)}`,
        detail: "Each item's store shows once it's dispatched",
      };
    }
  } else {
    now = { kind: "unknown", place: "Not confirmed yet", detail: null };
  }

  let going: CardNode | null;
  if (orderType === "Collection" && collectionStore) {
    going = {
      kind: "collection_store",
      place: collectionStore,
      detail: "Collection store",
    };
  } else if (orderType === "Delivery") {
    going = {
      kind: "customer",
      place: "Customer's address",
      detail: "Home delivery",
    };
  } else {
    going = null;
  }

  if (
    now.kind === "store" &&
    collectionStore !== null &&
    now.place === collectionStore
  ) {
    now = {
      kind: "store",
      place: collectionStore,
      detail: "At the collection store",
    };
    going = null;
  }

  return { status, now, going, items };
}

function overallStatus(
  orderType: OrderCard["orderType"],
  fulfilled: CardGroup[],
  unfulfilled: CardGroup | null,
): CardStatus {
  if (fulfilled.length === 0 && unfulfilled === null) {
    return { label: "No items to fulfil", tone: "neutral" };
  }
  if (fulfilled.length === 0 && unfulfilled) {
    return unfulfilled.status;
  }
  if (fulfilled.length > 0 && unfulfilled) {
    if (orderType === "Collection") {
      return { label: "Partly collected", tone: "progress" };
    }
    return { label: "Partly dispatched", tone: "progress" };
  }
  const everyDone = fulfilled.every((group) => group.status.tone === "done");
  if (everyDone) {
    if (orderType === "Collection") {
      return { label: "Collected", tone: "done" };
    }
    return { label: "Delivered", tone: "done" };
  }
  return { label: "Dispatched", tone: "progress" };
}

export function toCard(record: OrderRecord): OrderCard {
  const { orderType, collectionStore } = orderTypeOf(record.shippingTitle);
  const orderedLabel = `Ordered ${formatDateTime(record.createdAt)}`;

  if (record.cancelledAt !== null) {
    const cancelledDate = formatDateTime(record.cancelledAt);
    const items = record.lines.map((line) => ({
      quantity: line.quantity,
      title: line.title,
      sku: line.sku,
    }));
    const cancelledStatus: CardStatus = {
      label: "Cancelled",
      tone: "cancelled",
    };
    return {
      orderName: record.name,
      orderType,
      orderedLabel,
      status: cancelledStatus,
      cancelledLabel: `Cancelled ${cancelledDate}. Nothing will be dispatched.`,
      groups: [
        {
          status: cancelledStatus,
          now: null,
          going: null,
          items,
        },
      ],
    };
  }

  const activeLines = record.lines.filter((line) => line.currentQuantity > 0);
  const linesById = new Map(activeLines.map((line) => [line.lineId, line]));

  const aggregates = aggregateSuccessfulFulfilments(
    record.fulfillments,
    linesById,
    orderType,
  );
  const fulfilledMerged = aggregates.map((aggregate) =>
    buildFulfilledGroup(aggregate, linesById, collectionStore),
  );

  const unfulfilled = buildUnfulfilledGroup(
    activeLines,
    orderType,
    collectionStore,
    record.locationTags,
  );

  const groups = unfulfilled
    ? [...fulfilledMerged, unfulfilled]
    : fulfilledMerged;

  return {
    orderName: record.name,
    orderType,
    orderedLabel,
    status: overallStatus(orderType, fulfilledMerged, unfulfilled),
    cancelledLabel: null,
    groups,
  };
}
