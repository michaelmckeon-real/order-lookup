import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseExport } from "@/lib/ingest/parse-export";
import { toCard } from "@/lib/lookup/to-card";

const fixturePath = path.join(
  import.meta.dirname,
  "__fixtures__",
  "export-small.csv",
);

const asOf = "2026-10-13T18:00:00.000Z";

const header =
  "ID,Name,Tags,Created At,Cancelled At,Line: Type,Line: ID,Line: Title,Line: SKU,Line: Quantity,Line: Current Quantity,Line: Fulfillable Quantity,Fulfillment: ID,Fulfillment: Status,Fulfillment: Created At,Fulfillment: Location,Fulfillment: Tracking Company,Fulfillment: Shipment Status";

describe("parseExport", () => {
  it("reports missing columns by name", () => {
    const result = parseExport("ID,Name\n1,#1\n", asOf);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.reason).toBe("missing_columns");
    expect(result.missing).toContain("Tags");
    expect(result.missing).toContain("Fulfillment: Location");
  });

  it("filters tags to configured locations", () => {
    const csv = readFileSync(fixturePath, "utf8");
    const result = parseExport(csv, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const order = result.records.get("9902004");
    expect(order?.locationTags).toEqual(["Naas"]);
  });

  it("groups fulfilments with positive quantities", () => {
    const csv = readFileSync(fixturePath, "utf8");
    const result = parseExport(csv, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const order = result.records.get("9902001");
    expect(order?.fulfillments).toHaveLength(2);
    expect(order?.fulfillments[0].items[0].quantity).toBe(1);
    expect(order?.fulfillments[1].items[0].quantity).toBe(2);
    expect(
      order?.fulfillments.every((item) => item.trackingCompany === "DPD Ireland"),
    ).toBe(true);
  });

  it("drops and counts orders outside the window", () => {
    const csv = readFileSync(fixturePath, "utf8");
    const result = parseExport(csv, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.records.has("9902006")).toBe(false);
    expect(result.report.droppedOutsideWindow).toBe(1);
  });

  it("reports unknown shipping titles and locations", () => {
    const csv = readFileSync(fixturePath, "utf8");
    const result = parseExport(csv, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.report.unknownShippingTitles).toEqual(["Express"]);
    expect(result.report.unknownLocations).toEqual(["Ballymount DC"]);
  });

  it("keeps a quoted title with a comma and inch mark intact", () => {
    const csv = readFileSync(fixturePath, "utf8");
    const result = parseExport(csv, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const order = result.records.get("9902005");
    expect(order?.lines[0].title).toBe('Samsung 65" Crystal UHD, 2026');
    expect(order?.lines.some((line) => line.lineId === "TX1")).toBe(false);
  });

  it("keys an SFP order by its digits and keeps the full name", () => {
    const csv = `${header}
201,SFP#9902010,,2026-10-12 09:00:00 +0100,,Line Item,L1,Item,SKU1,1,1,1,,,,,,
201,SFP#9902010,,2026-10-12 09:00:00 +0100,,Shipping Line,,Deliver to Door,,1,1,0,,,,,,
`;
    const result = parseExport(csv, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const order = result.records.get("9902010");
    expect(order?.name).toBe("SFP#9902010");
    expect(result.report.unknownShippingTitles).not.toContain("Deliver to Door");
  });

  it("drops colliding digit keys and counts them", () => {
    const csv = `${header}
301,#9902020,,2026-10-12 09:00:00 +0100,,Line Item,L1,Item A,SKU1,1,1,1,,,,,,
301,#9902020,,2026-10-12 09:00:00 +0100,,Shipping Line,,Standard,,1,1,0,,,,,,
302,SFP#9902020,,2026-10-12 10:00:00 +0100,,Line Item,L1,Item B,SKU2,1,1,1,,,,,,
302,SFP#9902020,,2026-10-12 10:00:00 +0100,,Shipping Line,,Standard,,1,1,0,,,,,,
`;
    const result = parseExport(csv, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.records.has("9902020")).toBe(false);
    expect(result.report.collidingNames).toBe(2);
  });

  it("treats pickup and delivery titles as known order types", () => {
    const csv = `${header}
401,#9902030,,2026-10-12 09:00:00 +0100,,Line Item,L1,Item,SKU1,1,1,1,,,,,,
401,#9902030,,2026-10-12 09:00:00 +0100,,Shipping Line,,Pickup: Swords,,1,1,0,,,,,,
402,#9902031,,2026-10-12 10:00:00 +0100,,Line Item,L1,Item,SKU2,1,1,1,,,,,,
402,#9902031,,2026-10-12 10:00:00 +0100,,Shipping Line,,Standard Delivery,,1,1,0,,,,,,
403,#9902032,,2026-10-12 11:00:00 +0100,,Line Item,L1,Item,SKU3,1,1,1,,,,,,
403,#9902032,,2026-10-12 11:00:00 +0100,,Shipping Line,,Deliver to Door,,1,1,0,,,,,,
`;
    const result = parseExport(csv, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const pickup = result.records.get("9902030");
    const standardDelivery = result.records.get("9902031");
    const deliverToDoor = result.records.get("9902032");
    expect(pickup).toBeDefined();
    expect(standardDelivery).toBeDefined();
    expect(deliverToDoor).toBeDefined();
    if (!pickup || !standardDelivery || !deliverToDoor) {
      return;
    }
    expect(toCard(pickup).orderType).toBe("Collection");
    expect(toCard(pickup).groups[0].going?.place).toBe("Swords");
    expect(toCard(standardDelivery).orderType).toBe("Delivery");
    expect(toCard(deliverToDoor).orderType).toBe("Delivery");
    expect(result.report.unknownShippingTitles).toEqual([]);
  });
});
