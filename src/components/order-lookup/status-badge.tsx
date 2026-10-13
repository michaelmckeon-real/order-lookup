import type { CardStatus, Tone } from "@/lib/lookup/types";
import { cn } from "cn";

const toneClasses: Record<Tone, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  progress: "border-blue-200 bg-blue-50 text-blue-800",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
};

const dotClasses: Record<Tone, string> = {
  neutral: "bg-slate-500",
  progress: "bg-blue-600",
  done: "bg-emerald-600",
  cancelled: "bg-red-600",
};

export function StatusBadge({
  status,
  size = "md",
}: {
  status: CardStatus;
  size?: "md" | "sm";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium",
        size === "sm" ? "h-6" : "h-7",
        toneClasses[status.tone],
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", dotClasses[status.tone])}
        aria-hidden
      />
      {status.label}
    </span>
  );
}
