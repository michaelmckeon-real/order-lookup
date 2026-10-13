export type LookupLogResult =
  | "found"
  | "not_found"
  | "no_data"
  | "invalid"
  | "rate_limited";

export function logLookup(entry: {
  ip: string;
  order: string | null;
  result: LookupLogResult;
}): void {
  console.info(
    JSON.stringify({
      event: "lookup",
      time: new Date().toISOString(),
      ip: entry.ip,
      order: entry.order,
      result: entry.result,
    }),
  );
}
