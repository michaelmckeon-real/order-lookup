"use client";

import { useEffect, useRef, useState } from "react";
import { Database, SearchX } from "lucide-react";
import { InfoPanel } from "@/components/order-lookup/info-panel";
import { OrderCardView } from "@/components/order-lookup/order-card";
import { SearchBox } from "@/components/order-lookup/search-box";
import { StaleBanner } from "@/components/order-lookup/stale-banner";
import type {
  LookupResponse,
  OrderCard,
  SnapshotInfo,
  StatusResponse,
} from "@/lib/lookup/types";
import { cn } from "cn";

type ResultState =
  | { kind: "found"; card: OrderCard; snapshot: SnapshotInfo }
  | {
      kind: "not_found";
      orderName: string;
      snapshot: SnapshotInfo;
    };

function isCoarsePointer(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

function rateLimitMessage(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  if (minutes <= 1) {
    return "Too many searches in a short time. Try again in a minute.";
  }
  return `Too many searches in a short time. Try again in ${minutes} minutes.`;
}

function applyPostResponseFocus(input: HTMLInputElement | null) {
  if (!input) {
    return;
  }
  if (isCoarsePointer()) {
    input.blur();
    return;
  }
  input.focus({ preventScroll: true });
  input.select();
}

export function OrderLookup() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [statusReady, setStatusReady] = useState(false);
  const [noData, setNoData] = useState(false);
  const [snapshot, setSnapshot] = useState<SnapshotInfo | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const response = await fetch("/api/status");
        const body = (await response.json()) as StatusResponse;
        if (cancelled) {
          return;
        }
        if (body.status === "ok") {
          setSnapshot(body.snapshot);
          setNoData(false);
          setStatusReady(true);
          window.requestAnimationFrame(() => {
            inputRef.current?.focus({ preventScroll: true });
          });
          return;
        }
        setNoData(true);
        setSnapshot(null);
        setStatusReady(true);
      } catch {
        if (!cancelled) {
          setNoData(true);
          setStatusReady(true);
        }
      }
    }

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  function clearAll() {
    setQuery("");
    setError(null);
    setResult(null);
    setHasSearched(false);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) {
        return;
      }
      if (event.key !== "Escape") {
        return;
      }
      const hasSomethingToClear =
        query.length > 0 || error !== null || result !== null;
      if (!hasSomethingToClear) {
        return;
      }
      event.preventDefault();
      clearAll();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [query, error, result]);

  async function submit() {
    if (noData || searching) {
      return;
    }

    setHasSearched(true);

    if (query.length === 0) {
      setError("Enter an order number.");
      return;
    }

    setError(null);
    setSearching(true);

    try {
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (response.status >= 500) {
        setError("Something went wrong. Try again.");
        applyPostResponseFocus(inputRef.current);
        return;
      }

      const body = (await response.json()) as LookupResponse;

      if (body.status === "invalid") {
        setError(body.message);
        applyPostResponseFocus(inputRef.current);
        return;
      }

      if (body.status === "no_data") {
        setNoData(true);
        setSnapshot(null);
        setResult(null);
        applyPostResponseFocus(inputRef.current);
        return;
      }

      if (body.status === "rate_limited") {
        setError(rateLimitMessage(body.retryAfterSeconds));
        applyPostResponseFocus(inputRef.current);
        return;
      }

      setSnapshot(body.snapshot);

      if (body.status === "found") {
        setResult({
          kind: "found",
          card: body.card,
          snapshot: body.snapshot,
        });
      } else {
        setResult({
          kind: "not_found",
          orderName: body.orderName,
          snapshot: body.snapshot,
        });
      }

      applyPostResponseFocus(inputRef.current);
    } catch {
      setError("Something went wrong. Try again.");
      applyPostResponseFocus(inputRef.current);
    } finally {
      setSearching(false);
    }
  }

  const footerSnapshot = snapshot;
  const activeSnapshot =
    result?.kind === "found" || result?.kind === "not_found"
      ? result.snapshot
      : snapshot;

  return (
    <>
      <main
        className={cn(
          "flex-1 px-4 pb-10",
          hasSearched ? "pt-6" : "pt-[max(48px,24vh)]",
          "motion-safe:transition-[padding-top] motion-safe:duration-200 motion-safe:ease-out",
        )}
      >
        <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4">
          <SearchBox
            value={query}
            disabled={noData || !statusReady}
            searching={searching}
            error={error}
            onChange={setQuery}
            onSubmit={() => {
              void submit();
            }}
            onClear={clearAll}
            inputRef={inputRef}
          />

          {activeSnapshot ? <StaleBanner snapshot={activeSnapshot} /> : null}

          <div aria-live="polite" className="flex flex-col gap-4">
            {noData ? (
              <InfoPanel
                icon={Database}
                title="No order data loaded yet"
                body="Search will work once the first order export has been loaded."
              />
            ) : null}

            {!noData && result?.kind === "not_found" ? (
              <MissPanel result={result} />
            ) : null}

            {!noData && result?.kind === "found" ? (
              <OrderCardView card={result.card} snapshot={result.snapshot} />
            ) : null}
          </div>
        </div>
      </main>
      <footer className="py-4 text-center text-[12.5px] text-muted-foreground">
        {!statusReady
          ? null
          : noData
            ? "No data loaded yet"
            : footerSnapshot
              ? `Data as of ${footerSnapshot.asOfLabel}`
              : null}
      </footer>
    </>
  );
}

function MissPanel({
  result,
}: {
  result: Extract<ResultState, { kind: "not_found" }>;
}) {
  return (
    <InfoPanel
      icon={SearchX}
      title={
        <>
          No order matches{" "}
          <span className="font-mono">{result.orderName}</span> in the last{" "}
          {result.snapshot.windowDays} days.
        </>
      }
      body="Orders placed in the last couple of hours may not have loaded yet. Check the number with the customer."
    />
  );
}
