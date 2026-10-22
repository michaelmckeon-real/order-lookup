import { rules } from "@/lib/config";
import { getRegionConfig } from "@/lib/region";
import type { SnapshotInfo, SnapshotMeta } from "@/lib/lookup/types";

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-IE", {
    timeZone: getRegionConfig().timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const valueOf = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${valueOf("day")} ${valueOf("month")} ${valueOf("year")}, ${valueOf("hour")}:${valueOf("minute")}`;
}

export function formatAge(hours: number): string {
  const whole = Math.floor(hours);
  if (whole < 1) {
    return "under an hour";
  }
  if (whole === 1) {
    return "1 hour";
  }
  return `${whole} hours`;
}

export function formatRefreshedAgo(asOfIso: string, nowMs: number): string {
  const elapsedMs = nowMs - new Date(asOfIso).getTime();
  if (elapsedMs < 60_000) {
    return "just now";
  }

  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }

  const hours = Math.floor(elapsedMs / (60 * 60 * 1000));
  if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }

  const days = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function toSnapshotInfo(meta: SnapshotMeta, now: Date): SnapshotInfo {
  const asOf = new Date(meta.asOf);
  const ageHours = (now.getTime() - asOf.getTime()) / (1000 * 60 * 60);
  return {
    asOf: meta.asOf,
    asOfLabel: formatDateTime(meta.asOf),
    ageLabel: formatAge(ageHours),
    isStale: ageHours > rules.staleAfterHours,
    windowDays: rules.windowDays,
    staleAfterHours: rules.staleAfterHours,
  };
}
