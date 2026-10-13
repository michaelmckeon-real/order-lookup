import { getOrderSource } from "@/lib/data/source";
import { toSnapshotInfo } from "@/lib/lookup/format";
import {
  normaliseOrderNumber,
  orderNumberOf,
} from "@/lib/lookup/normalise";
import { toCard } from "@/lib/lookup/to-card";
import type { LookupResponse } from "@/lib/lookup/types";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

const INVALID_MESSAGE = "That doesn't look like an order number.";

function jsonResponse(body: LookupResponse, status: number): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  const text = await request.text();
  if (text.length > 1024) {
    return jsonResponse(
      { status: "invalid", message: INVALID_MESSAGE },
      400,
    );
  }

  let query: unknown;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) {
      return jsonResponse(
        { status: "invalid", message: INVALID_MESSAGE },
        400,
      );
    }
    query = (parsed as { query?: unknown }).query;
  } catch {
    return jsonResponse(
      { status: "invalid", message: INVALID_MESSAGE },
      400,
    );
  }

  if (typeof query !== "string") {
    return jsonResponse(
      { status: "invalid", message: INVALID_MESSAGE },
      400,
    );
  }

  const normalised = normaliseOrderNumber(query);
  if (!normalised.ok) {
    if (normalised.reason === "empty") {
      return jsonResponse(
        { status: "invalid", message: "Enter an order number." },
        400,
      );
    }
    return jsonResponse(
      { status: "invalid", message: INVALID_MESSAGE },
      400,
    );
  }

  const source = getOrderSource();
  const meta = await source.getSnapshotMeta();
  if (meta === null) {
    return jsonResponse({ status: "no_data" }, 200);
  }

  const now = new Date();
  const snapshot = toSnapshotInfo(meta, now);
  const record = await source.findOrder(normalised.key);
  if (record) {
    return jsonResponse(
      { status: "found", card: toCard(record), snapshot },
      200,
    );
  }

  const numeric = orderNumberOf(normalised.key);
  let reason: "newer_than_data" | "older_than_window" | "no_match" =
    "no_match";
  if (numeric !== null && meta.maxOrderNumber !== null && numeric > meta.maxOrderNumber) {
    reason = "newer_than_data";
  } else if (
    numeric !== null &&
    meta.minOrderNumber !== null &&
    numeric < meta.minOrderNumber
  ) {
    reason = "older_than_window";
  }

  return jsonResponse(
    {
      status: "not_found",
      reason,
      orderName: `#${normalised.key}`,
      snapshot,
    },
    200,
  );
}
