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

  it("classifies not_found reasons", async () => {
    const newer = await postLookup("9901099");
    expect(newer.status).toBe(200);
    expect(newer.body).toMatchObject({
      status: "not_found",
      reason: "newer_than_data",
    });

    const older = await postLookup("9900500");
    expect(older.status).toBe(200);
    expect(older.body).toMatchObject({
      status: "not_found",
      reason: "older_than_window",
    });

    const miss = await postLookup("9901009");
    expect(miss.status).toBe(200);
    expect(miss.body).toMatchObject({
      status: "not_found",
      reason: "no_match",
    });
  });
});
