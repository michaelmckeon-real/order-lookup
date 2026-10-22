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

  it("reads dropship from Line: Properties and stores only the boolean", () => {
    const properties = "_vendor: Acme\n_dropship: true\n_note: ignore me";
    const escape = (value: string): string =>
      /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
    const withProperties = [
      `${header},Line: Properties`,
      [
        "501",
        "#9902040",
        "",
        "2026-10-12 09:00:00 +0100",
        "",
        "Line Item",
        "L1",
        "Item",
        "SKU1",
        "1",
        "1",
        "1",
        "",
        "",
        "",
        "",
        "",
        "",
        properties,
      ]
        .map(escape)
        .join(","),
      [
        "501",
        "#9902040",
        "",
        "2026-10-12 09:00:00 +0100",
        "",
        "Shipping Line",
        "",
        "Standard",
        "",
        "1",
        "1",
        "0",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].join(","),
      "",
    ].join("\n");
    const result = parseExport(withProperties, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const order = result.records.get("9902040");
    expect(order?.lines).toHaveLength(1);
    expect(order?.lines[0].dropship).toBe(true);
    const serialised = JSON.stringify(order?.lines[0]);
    expect(serialised).not.toContain("_vendor");
    expect(serialised).not.toContain("Acme");
    expect(serialised).not.toContain("_note");
    expect(serialised).not.toContain("ignore me");
    expect(serialised).not.toContain("Line: Properties");
  });

  it("loads files without Line: Properties with dropship false", () => {
    const csv = `${header}
601,#9902041,,2026-10-12 09:00:00 +0100,,Line Item,L1,Item A,SKU1,1,1,1,,,,,,
601,#9902041,,2026-10-12 09:00:00 +0100,,Line Item,L2,Item B,SKU2,1,1,1,,,,,,
601,#9902041,,2026-10-12 09:00:00 +0100,,Shipping Line,,Standard,,1,1,0,,,,,,
`;
    const result = parseExport(csv, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const order = result.records.get("9902041");
    expect(order?.lines.map((line) => line.dropship)).toEqual([false, false]);
  });

  it("maps Payment: Status to refund and stores nothing else from the column", () => {
    const withStatus = `${header},Payment: Status`;
    const cases: { raw: string; refund: "none" | "partial" | "full" }[] = [
      { raw: "refunded", refund: "full" },
      { raw: "partially_refunded", refund: "partial" },
      { raw: " Partially Refunded ", refund: "partial" },
      { raw: "paid", refund: "none" },
      { raw: "", refund: "none" },
    ];
    for (const [index, item] of cases.entries()) {
      const id = 700 + index;
      const key = `990205${index}`;
      const paymentCell =
        item.raw.length > 0 && /[",\n\r ]/.test(item.raw)
          ? `"${item.raw}"`
          : item.raw;
      const csv = `${withStatus}
${id},#${key},,2026-10-12 09:00:00 +0100,,Line Item,L1,Item,SKU1,1,1,1,,,,,,,${paymentCell}
${id},#${key},,2026-10-12 09:00:00 +0100,,Shipping Line,,Standard,,1,1,0,,,,,,,${paymentCell}
`;
      const result = parseExport(csv, asOf);
      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      const order = result.records.get(key);
      expect(order?.refund).toBe(item.refund);
      const serialised = JSON.stringify(order);
      expect(serialised).not.toContain("Payment: Status");
      expect(serialised).not.toContain("partially_refunded");
      expect(serialised).not.toContain("Partially Refunded");
      expect(serialised).not.toContain('"paid"');
      expect(serialised).not.toContain('"refunded"');
    }
  });

  it("loads files without Payment: Status with refund none", () => {
    const csv = `${header}
801,#9902060,,2026-10-12 09:00:00 +0100,,Line Item,L1,Item A,SKU1,1,1,1,,,,,,
801,#9902060,,2026-10-12 09:00:00 +0100,,Shipping Line,,Standard,,1,1,0,,,,,,
802,#9902061,,2026-10-12 10:00:00 +0100,,Line Item,L1,Item B,SKU2,1,1,1,,,,,,
802,#9902061,,2026-10-12 10:00:00 +0100,,Shipping Line,,Standard,,1,1,0,,,,,,
`;
    const result = parseExport(csv, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.records.get("9902060")?.refund).toBe("none");
    expect(result.records.get("9902061")?.refund).toBe("none");
  });

  it("takes the name from the first row of the order that has one", () => {
    const csv = `${header}
901,,,2026-10-12 09:00:00 +0100,,Line Item,L1,Item,SKU1,1,1,1,,,,,,
901,#9902070,,2026-10-12 11:00:00 +0100,,Shipping Line,,Standard,,1,1,0,,,,,,
`;
    const result = parseExport(csv, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const order = result.records.get("9902070");
    expect(order?.name).toBe("#9902070");
    expect(order?.createdAt).toBe("2026-10-12T09:00:00+01:00");
    expect(result.report.counts.kept).toBe(1);
    expect(result.report.orderCount).toBe(result.report.counts.kept);
  });

  it("drops an order whose rows all have a blank name", () => {
    const csv = `${header}
902,,,2026-10-12 09:00:00 +0100,,Line Item,L1,Item,SKU1,1,1,1,,,,,,
902,,,2026-10-12 09:00:00 +0100,,Shipping Line,,Standard,,1,1,0,,,,,,
`;
    const result = parseExport(csv, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.records.size).toBe(0);
    expect(result.report.counts.skippedBadName).toBe(1);
    expect(result.report.skippedBadName).toBe(1);
  });

  it("drops both orders when two ids share a name key", () => {
    const csv = `${header}
911,#9902090,,2026-10-12 09:00:00 +0100,,Line Item,L1,Item A,SKU1,1,1,1,,,,,,
912,#9902090,,2026-10-12 10:00:00 +0100,,Line Item,L1,Item B,SKU2,1,1,1,,,,,,
`;
    const result = parseExport(csv, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.records.has("9902090")).toBe(false);
    expect(result.report.counts.nameCollisions).toBe(2);
    expect(result.report.counts.kept).toBe(0);
  });

  it("balances row counts with orders written", () => {
    const csv = `${header}
921,#9902100,,2026-10-12 09:00:00 +0100,,Line Item,L1,Item,SKU1,1,1,1,,,,,,
921,#9902100,,2026-10-12 09:00:00 +0100,,Shipping Line,,Standard,,1,1,0,,,,,,
,#9902101,,2026-10-12 09:00:00 +0100,,Line Item,L1,Item,SKU2,1,1,1,,,,,,
`;
    const result = parseExport(csv, asOf);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const rowsWithId = 2;
    expect(result.report.counts.kept).toBe(result.records.size);
    expect(result.report.counts.kept).toBe(result.report.orderCount);
    expect(result.report.counts.rows).toBe(
      result.report.counts.emptyIdRows + rowsWithId,
    );
    expect(result.report.counts).toEqual({
      rows: 3,
      emptyIdRows: 1,
      distinctIds: 1,
      skippedBadName: 0,
      nameCollisions: 0,
      windowDropped: 0,
      kept: 1,
    });
  });
});
