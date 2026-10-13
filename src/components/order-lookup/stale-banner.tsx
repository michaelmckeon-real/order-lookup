import { TriangleAlert } from "lucide-react";
import type { SnapshotInfo } from "@/lib/lookup/types";

export function StaleBanner({ snapshot }: { snapshot: SnapshotInfo }) {
  if (!snapshot.isStale) {
    return null;
  }

  return (
    <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3 text-amber-900">
      <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          This data is {snapshot.ageLabel} old
        </p>
        <p className="text-[13.5px]">
          Last updated {snapshot.asOfLabel}. Anything dispatched or collected
          since then won&apos;t show yet.
        </p>
      </div>
    </div>
  );
}
