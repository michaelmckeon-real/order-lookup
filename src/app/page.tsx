import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center border-b bg-card px-5">
        <h1 className="text-[15px] font-semibold tracking-tight">
          Order Lookup
        </h1>
      </header>
      <main className="flex-1 px-4 pt-[max(48px,24vh)] pb-10">
        <div className="mx-auto flex w-full max-w-[600px] flex-col gap-2">
          <Label htmlFor="order-number">Order number</Label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                size={18}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-[14px] -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="order-number"
                name="order-number"
                type="text"
                placeholder="#1234567"
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="characters"
                enterKeyHint="search"
                className="h-[52px] bg-card pl-[42px] font-mono text-lg font-medium"
              />
            </div>
            <Button
              type="button"
              className="h-[52px] min-w-[112px] text-[15px]"
            >
              Search
            </Button>
          </div>
          <p className="text-[13.5px] text-muted-foreground">
            Use the full number from the customer&apos;s order confirmation
            email.
          </p>
        </div>
      </main>
      <footer className="py-4 text-center text-[12.5px] text-muted-foreground">
        No data loaded yet
      </footer>
    </div>
  );
}
