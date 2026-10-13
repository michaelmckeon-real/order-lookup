import { clientIp } from "@/lib/client-ip";
import { getOrderSource } from "@/lib/data/source";
import { logLookup, type LookupLogResult } from "@/lib/log";
import { toSnapshotInfo } from "@/lib/lookup/format";
import { normaliseOrderNumber } from "@/lib/lookup/normalise";
import { toCard } from "@/lib/lookup/to-card";
import type { LookupResponse } from "@/lib/lookup/types";
import { allow, type RateLimitDecision } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

const INVALID_MESSAGE = "That doesn't look like an order number.";

type ParsedLookup =
  | { ok: true; key: string }
  | { ok: false; message: string };

type HandledLookup = {
  order: string | null;
  result: LookupLogResult;
  response: Response;
};

function jsonResponse(
  body: LookupResponse,
  status: number,
  retryAfterSeconds?: number,
): Response {
  const headers: Record<string, string> = { ...NO_STORE };
  if (retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(retryAfterSeconds);
  }
  return Response.json(body, { status, headers });
}

function parseLookupText(text: string): ParsedLookup {
  if (text.length > 1024) {
    return { ok: false, message: INVALID_MESSAGE };
  }

  let query: unknown;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) {
      return { ok: false, message: INVALID_MESSAGE };
    }
    query = (parsed as { query?: unknown }).query;
  } catch {
    return { ok: false, message: INVALID_MESSAGE };
  }

  if (typeof query !== "string") {
    return { ok: false, message: INVALID_MESSAGE };
  }

  const normalised = normaliseOrderNumber(query);
  if (!normalised.ok) {
    if (normalised.reason === "empty") {
      return { ok: false, message: "Enter an order number." };
    }
    return { ok: false, message: INVALID_MESSAGE };
  }

  return { ok: true, key: normalised.key };
}

async function handleLookup(
  text: string,
  decision: RateLimitDecision,
): Promise<HandledLookup> {
  const parsed = parseLookupText(text);

  if (!decision.allowed) {
    return {
      order: parsed.ok ? parsed.key : null,
      result: "rate_limited",
      response: jsonResponse(
        {
          status: "rate_limited",
          retryAfterSeconds: decision.retryAfterSeconds,
        },
        429,
        decision.retryAfterSeconds,
      ),
    };
  }

  if (!parsed.ok) {
    return {
      order: null,
      result: "invalid",
      response: jsonResponse(
        { status: "invalid", message: parsed.message },
        400,
      ),
    };
  }

  const source = getOrderSource();
  const meta = await source.getSnapshotMeta();
  if (meta === null) {
    return {
      order: parsed.key,
      result: "no_data",
      response: jsonResponse({ status: "no_data" }, 200),
    };
  }

  const now = new Date();
  const snapshot = toSnapshotInfo(meta, now);
  const record = await source.findOrder(parsed.key);
  if (record) {
    return {
      order: parsed.key,
      result: "found",
      response: jsonResponse(
        { status: "found", card: toCard(record), snapshot },
        200,
      ),
    };
  }

  return {
    order: parsed.key,
    result: "not_found",
    response: jsonResponse(
      {
        status: "not_found",
        orderName: `#${parsed.key}`,
        snapshot,
      },
      200,
    ),
  };
}

export async function POST(request: Request): Promise<Response> {
  const ip = clientIp(request.headers);
  const decision = allow(ip, new Date());
  const handled = await handleLookup(await request.text(), decision);
  logLookup({ ip, order: handled.order, result: handled.result });
  return handled.response;
}
