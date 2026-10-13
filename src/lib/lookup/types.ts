export type OrderRecord = {
  name: string;
  createdAt: string;
  cancelledAt: string | null;
  locationTags: string[];
  shippingTitle: string | null;
  lines: {
    lineId: string;
    title: string;
    sku: string;
    quantity: number;
    currentQuantity: number;
    fulfillableQuantity: number;
  }[];
  fulfillments: {
    status: string;
    createdAt: string;
    location: string | null;
    trackingCompany: string | null;
    shipmentStatus: string | null;
    items: { lineId: string; quantity: number }[];
  }[];
};

export type SnapshotMeta = {
  asOf: string;
  orderCount: number;
  minOrderNumber: number | null;
  maxOrderNumber: number | null;
};

export type Tone = "neutral" | "progress" | "done" | "cancelled";

export type CardStatus = { label: string; tone: Tone };

export type CardNode = {
  kind:
    | "store"
    | "carrier"
    | "finding_stock"
    | "supplier"
    | "multiple"
    | "unknown"
    | "done"
    | "customer"
    | "collection_store";
  place: string;
  detail: string | null;
};

export type CardGroup = {
  status: CardStatus;
  now: CardNode | null;
  going: CardNode | null;
  items: { quantity: number; title: string; sku: string }[];
};

export type OrderCard = {
  orderName: string;
  orderType: "Delivery" | "Collection" | "Unknown";
  orderedLabel: string;
  status: CardStatus;
  cancelledLabel: string | null;
  groups: CardGroup[];
};

export type SnapshotInfo = {
  asOfLabel: string;
  ageLabel: string;
  isStale: boolean;
  windowDays: number;
  staleAfterHours: number;
};

export type LookupResponse =
  | { status: "found"; card: OrderCard; snapshot: SnapshotInfo }
  | {
      status: "not_found";
      reason: "newer_than_data" | "older_than_window" | "no_match";
      orderName: string;
      snapshot: SnapshotInfo;
    }
  | { status: "no_data" }
  | { status: "invalid"; message: string };

export type StatusResponse =
  | { status: "ok"; snapshot: SnapshotInfo }
  | { status: "no_data" };
