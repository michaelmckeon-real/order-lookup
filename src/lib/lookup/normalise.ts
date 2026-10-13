export type NormaliseResult =
  | { ok: true; key: string }
  | { ok: false; reason: "empty" | "malformed" };

function digitsAfterHash(input: string): string {
  let value = input.trim();
  const hash = value.lastIndexOf("#");
  if (hash >= 0) {
    value = value.slice(hash + 1);
  }
  return value.replace(/\s+/g, "");
}

export function normaliseOrderNumber(input: string): NormaliseResult {
  const value = digitsAfterHash(input);
  if (value.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (!/^\d{1,12}$/.test(value)) {
    return { ok: false, reason: "malformed" };
  }
  return { ok: true, key: value };
}

export function orderKeyFromName(name: string): string | null {
  const result = normaliseOrderNumber(name);
  return result.ok ? result.key : null;
}
