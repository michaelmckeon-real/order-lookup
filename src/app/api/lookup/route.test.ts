import { describe, expect, it, vi } from "vitest";
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

  it("returns 429 when over the limit", async () => {
    const ip = "203.0.113.50";
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      for (let count = 0; count < 300; count += 1) {
        const response = await POST(lookupFrom(ip, ""));
        expect(response.status).not.toBe(429);
      }
      expect(spy).toHaveBeenCalledTimes(300);
      spy.mockClear();

      const raw = "SFP#9901001";
      const blocked = await POST(lookupFrom(ip, raw));
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("Cache-Control")).toBe("no-store");
      const body = (await blocked.json()) as LookupResponse;
      expect(body.status).toBe("rate_limited");
      if (body.status !== "rate_limited") {
        return;
      }
      expect(body.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.headers.get("Retry-After")).toBe(
        String(body.retryAfterSeconds),
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expectLookupLine(spy, {
        ip,
        order: "9901001",
        result: "rate_limited",
        raw,
      });
    } finally {
      spy.mockRestore();
    }
  });

  it("writes one lookup log line and never the raw input", async () => {
    const foundRaw = "SFP#9901001";
    const found = await expectOneLog(lookupFrom("203.0.113.61", foundRaw), {
      ip: "203.0.113.61",
      order: "9901001",
      result: "found",
      raw: foundRaw,
    });
    expect(found.status).toBe(200);

    const missingRaw = "SFP#9901099";
    const missing = await expectOneLog(lookupFrom("203.0.113.62", missingRaw), {
      ip: "203.0.113.62",
      order: "9901099",
      result: "not_found",
      raw: missingRaw,
    });
    expect(missing.status).toBe(200);

    const invalidRaw = "12-AB-99";
    const invalid = await expectOneLog(
      lookupFrom("203.0.113.63", invalidRaw),
      {
        ip: "203.0.113.63",
        order: null,
        result: "invalid",
        raw: invalidRaw,
      },
    );
    expect(invalid.status).toBe(400);

    const previous = process.env.FIXTURE_NO_DATA;
    process.env.FIXTURE_NO_DATA = "1";
    try {
      const quietRaw = "SFP#9901002";
      const quiet = await expectOneLog(lookupFrom("203.0.113.64", quietRaw), {
        ip: "203.0.113.64",
        order: "9901002",
        result: "no_data",
        raw: quietRaw,
      });
      expect(quiet.status).toBe(200);
      const quietBody = (await quiet.json()) as LookupResponse;
      expect(quietBody).toEqual({ status: "no_data" });
    } finally {
      if (previous === undefined) {
        delete process.env.FIXTURE_NO_DATA;
      } else {
        process.env.FIXTURE_NO_DATA = previous;
      }
    }
  });
});

function lookupFrom(ip: string, query: string): Request {
  return new Request("http://localhost/api/lookup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-IP": ip,
    },
    body: JSON.stringify({ query }),
  });
}

function expectLookupLine(
  spy: ReturnType<typeof vi.spyOn>,
  expected: {
    ip: string;
    order: string | null;
    result: string;
    raw: string;
  },
): void {
  const line = spy.mock.calls[0]?.[0];
  expect(typeof line).toBe("string");
  const text = String(line);
  expect(text).not.toContain(expected.raw);
  const parsed: unknown = JSON.parse(text);
  expect(parsed).toEqual({
    event: "lookup",
    time: expect.stringMatching(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    ),
    ip: expected.ip,
    order: expected.order,
    result: expected.result,
  });
}

async function expectOneLog(
  request: Request,
  expected: {
    ip: string;
    order: string | null;
    result: string;
    raw: string;
  },
): Promise<Response> {
  const spy = vi.spyOn(console, "info").mockImplementation(() => {});
  try {
    const response = await POST(request);
    expect(spy).toHaveBeenCalledTimes(1);
    expectLookupLine(spy, expected);
    return response;
  } finally {
    spy.mockRestore();
  }
}
