import {
  Ban,
  CircleCheck,
  CircleHelp,
  Clock,
  Factory,
  House,
  MapPin,
  MapPinned,
  PackageSearch,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/order-lookup/status-badge";
import type {
  CardGroup,
  CardNode,
  OrderCard as OrderCardData,
  SnapshotInfo,
} from "@/lib/lookup/types";
import { cn } from "cn";

const kindIcons: Record<CardNode["kind"], LucideIcon> = {
  store: MapPin,
  carrier: Truck,
  finding_stock: PackageSearch,
  supplier: Factory,
  multiple: MapPinned,
  unknown: CircleHelp,
  done: CircleCheck,
  customer: House,
  collection_store: Store,
};

function TypeChip({ orderType }: { orderType: OrderCardData["orderType"] }) {
  if (orderType === "Unknown") {
    return (
      <span className="inline-flex h-7 items-center rounded-md border bg-card px-2.5 text-[13px] font-medium">
        Type not recognised
      </span>
    );
  }

  const Icon = orderType === "Delivery" ? Truck : Store;
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-card px-2.5 text-[13px] font-medium">
      <Icon size={15} aria-hidden />
      {orderType}
    </span>
  );
}

function RouteRow({
  node,
  label,
  variant,
  showConnector,
  className,
}: {
  node: CardNode;
  label: string;
  variant: "now" | "going";
  showConnector: boolean;
  className?: string;
}) {
  const Icon = kindIcons[node.kind];
  return (
    <div className={cn("flex gap-3", className)}>
      <div className="flex w-8 flex-col items-center">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            variant === "now"
              ? "bg-primary text-primary-foreground"
              : "border-[1.5px] border-slate-400 bg-card text-primary",
          )}
        >
          <Icon size={16} aria-hidden />
        </div>
        {showConnector ? (
          <div className="my-1 w-0.5 min-h-4 flex-1 rounded bg-slate-300" aria-hidden />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold leading-snug">{node.place}</p>
        {node.detail ? (
          <p className="text-[13.5px] text-muted-foreground">{node.detail}</p>
        ) : null}
      </div>
    </div>
  );
}

function GroupRoute({ group }: { group: CardGroup }) {
  if (group.now && group.going) {
    return (
      <div>
        <RouteRow
          node={group.now}
          label="Last known location"
          variant="now"
          showConnector
          className="pb-4"
        />
        <RouteRow
          node={group.going}
          label="Going to"
          variant="going"
          showConnector={false}
        />
      </div>
    );
  }

  if (group.now) {
    return (
      <RouteRow
        node={group.now}
        label="Last known location"
        variant="now"
        showConnector={false}
      />
    );
  }

  return null;
}

function GroupSection({
  group,
  index,
  total,
  cancelled,
}: {
  group: CardGroup;
  index: number;
  total: number;
  cancelled: boolean;
}) {
  return (
    <section className="flex flex-col gap-3.5 border-t px-5 py-4">
      {total > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[13.5px] font-semibold text-slate-700">
            Part {index + 1} of {total}
          </h3>
          <StatusBadge status={group.status} size="sm" />
        </div>
      ) : null}
      <GroupRoute group={group} />
      <ul className="flex flex-col gap-2">
        {group.items.map((item) => (
          <li
            key={`${item.sku}-${item.title}`}
            className="flex items-baseline gap-2.5"
          >
            <span className="w-8 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
              {item.quantity} ×
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm break-words",
                  cancelled && "text-muted-foreground",
                )}
              >
                {item.title}
              </p>
              <p className="font-mono text-[12.5px] text-muted-foreground">
                {item.sku}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OrderCardView({
  card,
  snapshot,
}: {
  card: OrderCardData;
  snapshot: SnapshotInfo;
}) {
  const cancelled = card.status.tone === "cancelled";

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <header className="p-5 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-mono text-[22px] font-semibold tracking-tight">
            {card.orderName}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <TypeChip orderType={card.orderType} />
            <StatusBadge status={card.status} />
            {card.refundLabel ? (
              <StatusBadge
                status={{ label: card.refundLabel, tone: "neutral" }}
              />
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          {card.orderedLabel}
        </p>
      </header>

      {card.closedLabel ? (
        <div className="mx-5 mb-4 flex gap-3 rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-800">
          <Ban size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p>{card.closedLabel}</p>
        </div>
      ) : null}

      {card.groups.map((group, index) => (
        <GroupSection
          key={`${group.status.label}-${index}`}
          group={group}
          index={index}
          total={card.groups.length}
          cancelled={cancelled}
        />
      ))}

      <footer className="flex items-center gap-2 border-t bg-background px-5 py-3 text-[12.5px] text-muted-foreground">
        <Clock size={14} aria-hidden />
        <span>
          Last known as of {snapshot.asOfLabel}. Not live tracking.
        </span>
      </footer>
    </article>
  );
}
