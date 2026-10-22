import { OrderLookup } from "@/components/order-lookup/order-lookup";
import { RegionFlag } from "@/components/region-flag";
import { getRegionConfig } from "@/lib/region";

export const dynamic = "force-dynamic";

export default function Home() {
  const config = getRegionConfig();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center border-b bg-card px-5">
        <h1 className="text-[15px] font-semibold tracking-tight">
          <span className="flex items-center gap-2">
            <RegionFlag config={config} />
            Order Lookup
          </span>
        </h1>
      </header>
      <OrderLookup />
    </div>
  );
}
