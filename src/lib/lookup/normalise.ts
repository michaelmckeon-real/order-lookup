export type NormaliseResult =
  | { ok: true; key: string }
  | { ok: false; reason: "empty" | "malformed" };

export function normaliseOrderNumber(input: string): NormaliseResult {
  let value = input.trim();
  if (value.startsWith("#")) {
    value = value.slice(1);
  }
  value = value.replace(/\s+/g, "").toUpperCase();
  if (value.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (!/^[A-Z0-9-]{1,20}$/.test(value)) {
    return { ok: false, reason: "malformed" };
  }
  return { ok: true, key: value };
}

export function orderNumberOf(key: string): number | null {
  if (!/^\d+$/.test(key)) {
    return null;
  }
  return Number(key);
}
