import { OrderLookup } from "@/components/order-lookup/order-lookup";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center border-b bg-card px-5">
        <h1 className="text-[15px] font-semibold tracking-tight">
          Order Lookup
        </h1>
      </header>
      <OrderLookup />
    </div>
  );
}
