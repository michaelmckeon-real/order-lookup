import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseExport } from "@/lib/ingest/parse-export";

const fixturePath = path.join(
  import.meta.dirname,
  "__fixtures__",
  "export-small.csv",
);

const asOf = "2026-10-13T18:00:00.000Z";

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
});
