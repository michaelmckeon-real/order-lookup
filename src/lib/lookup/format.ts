import { rules } from "@/lib/config";
import type { SnapshotInfo, SnapshotMeta } from "@/lib/lookup/types";

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-IE", {
    timeZone: rules.timeZone,
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

export function toSnapshotInfo(meta: SnapshotMeta, now: Date): SnapshotInfo {
  const asOf = new Date(meta.asOf);
  const ageHours = (now.getTime() - asOf.getTime()) / (1000 * 60 * 60);
  return {
    asOfLabel: formatDateTime(meta.asOf),
    ageLabel: formatAge(ageHours),
    isStale: ageHours > rules.staleAfterHours,
    windowDays: rules.windowDays,
    staleAfterHours: rules.staleAfterHours,
  };
}
