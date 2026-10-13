import { getOrderSource } from "@/lib/data/source";
import { toSnapshotInfo } from "@/lib/lookup/format";
import type { StatusResponse } from "@/lib/lookup/types";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function jsonResponse(body: StatusResponse, status: number): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export async function GET(): Promise<Response> {
  const source = getOrderSource();
  const meta = await source.getSnapshotMeta();
  if (meta === null) {
    return jsonResponse({ status: "no_data" }, 200);
  }
  return jsonResponse(
    { status: "ok", snapshot: toSnapshotInfo(meta, new Date()) },
    200,
  );
}
