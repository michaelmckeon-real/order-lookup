import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function InfoPanel({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: ReactNode;
  body: string;
}) {
  return (
    <div className="flex gap-3.5 rounded-xl border bg-card p-5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon size={20} aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
