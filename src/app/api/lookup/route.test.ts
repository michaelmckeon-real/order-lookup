import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/lookup/route";
import type { LookupResponse } from "@/lib/lookup/types";

function lookupRequest(query: string | undefined, rawBody?: string): Request {
  const body =
    rawBody !== undefined
      ? rawBody
      : JSON.stringify({ query: query ?? "" });
  return new Request("http://localhost/api/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

async function postLookup(
  query: string | undefined,
  rawBody?: string,
): Promise<{ status: number; cacheControl: string | null; body: LookupResponse }> {
  const response = await POST(lookupRequest(query, rawBody));
  const body = (await response.json()) as LookupResponse;
  return {
    status: response.status,
    cacheControl: response.headers.get("Cache-Control"),
    body,
  };
}

describe("POST /api/lookup", () => {
  it("returns a found card for a fixture order", async () => {
    const result = await postLookup("#9901001");
    expect(result.status).toBe(200);
    expect(result.cacheControl).toBe("no-store");
    expect(result.body.status).toBe("found");
  });

  it("rejects an empty query", async () => {
    const result = await postLookup("");
    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      status: "invalid",
      message: "Enter an order number.",
    });
  });

  it("rejects a body that is not JSON", async () => {
    const result = await postLookup(undefined, "not-json");
    expect(result.status).toBe(400);
    expect(result.body.status).toBe("invalid");
  });

  it("returns the same not_found shape for any missing number", async () => {
    const a = await postLookup("9901099");
    const b = await postLookup("9900500");
    const c = await postLookup("9901009");

    for (const result of [a, b, c]) {
      expect(result.status).toBe(200);
      expect(result.body.status).toBe("not_found");
      if (result.body.status !== "not_found") {
        continue;
      }
      expect(result.body).not.toHaveProperty("reason");
      expect(result.body.snapshot).toBeDefined();
    }

    if (
      a.body.status !== "not_found" ||
      b.body.status !== "not_found" ||
      c.body.status !== "not_found"
    ) {
      return;
    }

    expect({
      status: a.body.status,
      snapshot: a.body.snapshot,
    }).toEqual({
      status: b.body.status,
      snapshot: b.body.snapshot,
    });
    expect({
      status: b.body.status,
      snapshot: b.body.snapshot,
    }).toEqual({
      status: c.body.status,
      snapshot: c.body.snapshot,
    });
    expect(a.body.orderName).toBe("#9901099");
    expect(b.body.orderName).toBe("#9900500");
    expect(c.body.orderName).toBe("#9901009");
  });
});
