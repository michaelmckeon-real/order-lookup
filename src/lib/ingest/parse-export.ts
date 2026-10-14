import { parse } from "csv-parse/sync";
import {
  hasDisplayName,
  isCollectionTitle,
  isDeliveryTitle,
  matchLocation,
  rules,
} from "@/lib/config";
import { orderKeyFromName } from "@/lib/lookup/normalise";
import type { OrderRecord } from "@/lib/lookup/types";

const REQUIRED_HEADERS = [
  "ID",
  "Name",
  "Tags",
  "Created At",
  "Cancelled At",
  "Line: Type",
  "Line: ID",
  "Line: Title",
  "Line: SKU",
  "Line: Quantity",
  "Line: Current Quantity",
  "Line: Fulfillable Quantity",
  "Fulfillment: ID",
  "Fulfillment: Status",
  "Fulfillment: Created At",
  "Fulfillment: Location",
  "Fulfillment: Tracking Company",
  "Fulfillment: Shipment Status",
] as const;

export type ParseReport = {
  orderCount: number;
  droppedOutsideWindow: number;
  skippedBadName: number;
  collidingNames: number;
  unknownShippingTitles: string[];
  unknownLocations: string[];
};

export type ParseExportResult =
  | { ok: true; records: Map<string, OrderRecord>; report: ParseReport }
  | { ok: false; reason: "missing_columns"; missing: string[] };

type CsvRow = Record<string, string>;

type FulfilmentDraft = {
  status: string;
  createdAt: string;
  location: string | null;
  trackingCompany: string | null;
  shipmentStatus: string | null;
  items: { lineId: string; quantity: number }[];
};

type OrderDraft = {
  name: string;
  createdAt: string;
  cancelledAt: string | null;
  tagsRaw: string;
  shippingTitle: string | null;
  lines: OrderRecord["lines"];
  fulfillments: Map<string, FulfilmentDraft>;
};

function cell(row: CsvRow, header: string): string {
  return (row[header] ?? "").trim();
}

function emptyToNull(value: string): string | null {
  return value.length === 0 ? null : value;
}

function toIso(matrixifyDate: string): string {
  const match = matrixifyDate
    .trim()
    .match(
      /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}) ([+-])(\d{2})(\d{2})$/,
    );
  if (!match) {
    throw new Error("unrecognised_date");
  }
  return `${match[1]}T${match[2]}${match[3]}${match[4]}:${match[5]}`;
}

function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const matched = matchLocation(part);
    if (!matched || seen.has(matched.name)) {
      continue;
    }
    seen.add(matched.name);
    tags.push(matched.name);
  }
  return tags;
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDropshipFlag(properties: string, key: string): boolean {
  for (const line of properties.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon === -1) {
      continue;
    }
    const propKey = line.slice(0, colon).trim();
    const propValue = line.slice(colon + 1).trim();
    if (
      propKey === key &&
      propValue.toLowerCase() === "true"
    ) {
      return true;
    }
  }
  return false;
}

export function parseExport(
  csvText: string,
  asOfIso: string,
): ParseExportResult {
  const rows = parse(csvText, {
    columns: true,
    bom: true,
    relax_column_count: false,
    skip_empty_lines: true,
  }) as CsvRow[];

  const headers =
    rows.length > 0
      ? Object.keys(rows[0])
      : (parse(csvText, {
          columns: false,
          bom: true,
          relax_column_count: false,
          skip_empty_lines: true,
          to_line: 1,
        }) as string[][])[0] ?? [];

  const headerSet = new Set(headers);
  const missing = REQUIRED_HEADERS.filter((header) => !headerSet.has(header));
  if (missing.length > 0) {
    return { ok: false, reason: "missing_columns", missing: [...missing] };
  }
  const hasLineProperties = headerSet.has("Line: Properties");

  const drafts = new Map<string, OrderDraft>();

  for (const row of rows) {
    const id = cell(row, "ID");
    if (id.length === 0) {
      continue;
    }

    let draft = drafts.get(id);
    if (!draft) {
      const cancelledRaw = cell(row, "Cancelled At");
      draft = {
        name: cell(row, "Name"),
        createdAt: toIso(cell(row, "Created At")),
        cancelledAt:
          cancelledRaw.length === 0 ? null : toIso(cancelledRaw),
        tagsRaw: cell(row, "Tags"),
        shippingTitle: null,
        lines: [],
        fulfillments: new Map(),
      };
      drafts.set(id, draft);
    }

    const lineType = cell(row, "Line: Type");
    if (lineType === "Line Item") {
      const dropship = hasLineProperties
        ? parseDropshipFlag(
            cell(row, "Line: Properties"),
            rules.dropshipLineProperty,
          )
        : false;
      draft.lines.push({
        lineId: cell(row, "Line: ID"),
        title: cell(row, "Line: Title"),
        sku: cell(row, "Line: SKU"),
        quantity: toNumber(cell(row, "Line: Quantity")),
        currentQuantity: toNumber(cell(row, "Line: Current Quantity")),
        fulfillableQuantity: toNumber(
          cell(row, "Line: Fulfillable Quantity"),
        ),
        dropship,
      });
      continue;
    }

    if (lineType === "Shipping Line") {
      if (draft.shippingTitle === null) {
        const title = cell(row, "Line: Title");
        draft.shippingTitle = title.length === 0 ? null : title;
      }
      continue;
    }

    if (lineType === "Fulfillment Line") {
      const fulfilmentId = cell(row, "Fulfillment: ID");
      if (fulfilmentId.length === 0) {
        continue;
      }
      let fulfilment = draft.fulfillments.get(fulfilmentId);
      if (!fulfilment) {
        const createdRaw = cell(row, "Fulfillment: Created At");
        fulfilment = {
          status: cell(row, "Fulfillment: Status"),
          createdAt: createdRaw.length === 0 ? "" : toIso(createdRaw),
          location: emptyToNull(cell(row, "Fulfillment: Location")),
          trackingCompany: emptyToNull(
            cell(row, "Fulfillment: Tracking Company"),
          ),
          shipmentStatus: emptyToNull(
            cell(row, "Fulfillment: Shipment Status"),
          ),
          items: [],
        };
        draft.fulfillments.set(fulfilmentId, fulfilment);
      }
      const lineId = cell(row, "Line: ID");
      if (lineId.length > 0) {
        fulfilment.items.push({
          lineId,
          quantity: Math.abs(toNumber(cell(row, "Line: Quantity"))),
        });
      }
    }
  }

  const asOfMs = new Date(asOfIso).getTime();
  const windowMs = rules.windowDays * 24 * 60 * 60 * 1000;
  const cutoffMs = asOfMs - windowMs;

  const keyed = new Map<string, OrderDraft[]>();
  let skippedBadName = 0;
  for (const draft of drafts.values()) {
    const key = orderKeyFromName(draft.name);
    if (key === null) {
      skippedBadName += 1;
      continue;
    }
    const list = keyed.get(key) ?? [];
    list.push(draft);
    keyed.set(key, list);
  }

  const records = new Map<string, OrderRecord>();
  let droppedOutsideWindow = 0;
  let collidingNames = 0;
  const unknownShippingTitles = new Set<string>();
  const unknownLocations = new Set<string>();

  for (const [key, list] of keyed) {
    if (list.length > 1) {
      collidingNames += list.length;
      continue;
    }

    const draft = list[0];
    const createdMs = new Date(draft.createdAt).getTime();
    if (createdMs < cutoffMs) {
      droppedOutsideWindow += 1;
      continue;
    }

    if (draft.shippingTitle !== null) {
      if (
        !isCollectionTitle(draft.shippingTitle) &&
        !isDeliveryTitle(draft.shippingTitle)
      ) {
        unknownShippingTitles.add(draft.shippingTitle);
      }
    }

    for (const fulfilment of draft.fulfillments.values()) {
      if (
        fulfilment.location !== null &&
        matchLocation(fulfilment.location) === null &&
        !hasDisplayName(fulfilment.location)
      ) {
        unknownLocations.add(fulfilment.location);
      }
    }

    records.set(key, {
      name: draft.name,
      createdAt: draft.createdAt,
      cancelledAt: draft.cancelledAt,
      locationTags: parseTags(draft.tagsRaw),
      shippingTitle: draft.shippingTitle,
      lines: draft.lines,
      fulfillments: Array.from(draft.fulfillments.values()).map((item) => ({
        status: item.status,
        createdAt: item.createdAt,
        location: item.location,
        trackingCompany: item.trackingCompany,
        shipmentStatus: item.shipmentStatus,
        items: item.items,
      })),
    });
  }

  return {
    ok: true,
    records,
    report: {
      orderCount: records.size,
      droppedOutsideWindow,
      skippedBadName,
      collidingNames,
      unknownShippingTitles: Array.from(unknownShippingTitles).sort(),
      unknownLocations: Array.from(unknownLocations).sort(),
    },
  };
}
