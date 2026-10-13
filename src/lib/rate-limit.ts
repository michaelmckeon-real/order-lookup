import { rules } from "@/lib/config";

const buckets = new Map<string, number[]>();

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

function prune(stamps: number[], cutoff: number): number[] {
  return stamps.filter((stamp) => stamp > cutoff);
}

export function allow(key: string, now: Date): RateLimitDecision {
  const windowMs = rules.rateLimit.windowMinutes * 60 * 1000;
  const max = rules.rateLimit.max;
  const nowMs = now.getTime();
  const cutoff = nowMs - windowMs;

  for (const [bucketKey, stamps] of buckets) {
    const kept = prune(stamps, cutoff);
    if (kept.length === 0) {
      buckets.delete(bucketKey);
    } else if (kept.length !== stamps.length) {
      buckets.set(bucketKey, kept);
    }
  }

  const recent = buckets.get(key) ?? [];
  if (recent.length >= max) {
    const oldest = recent.reduce(
      (min, stamp) => (stamp < min ? stamp : min),
      recent[0] ?? nowMs,
    );
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + windowMs - nowMs) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }

  recent.push(nowMs);
  recent.sort((left, right) => left - right);
  buckets.set(key, recent);
  return { allowed: true };
}
