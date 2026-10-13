"use client";

import type { RefObject } from "react";
import { X } from "lucide-react";
import { TypingPlaceholder } from "@/components/order-lookup/typing-placeholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SearchBox({
  value,
  disabled,
  searching,
  error,
  onChange,
  onSubmit,
  onClear,
  inputRef,
}: {
  value: string;
  disabled: boolean;
  searching: boolean;
  error: string | null;
  onChange: (digits: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="flex flex-col gap-2" aria-busy={searching || undefined}>
      <Label htmlFor="order-number">Order number</Label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-[14px] -translate-y-1/2 font-mono text-lg font-medium text-foreground"
          >
            #
          </span>
          {!disabled && value.length === 0 ? <TypingPlaceholder /> : null}
          <Input
            ref={inputRef}
            id="order-number"
            name="order-number"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={12}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            disabled={disabled}
            value={value}
            onChange={(event) => {
              onChange(event.target.value.replace(/\D/g, "").slice(0, 12));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmit();
              }
            }}
            onFocus={(event) => {
              if (
                event.currentTarget.value.length > 0 &&
                window.matchMedia("(pointer: coarse)").matches
              ) {
                event.currentTarget.select();
              }
            }}
            className="h-[52px] bg-card pl-[calc(14px_+_1ch)] pr-12 font-mono text-lg font-medium md:text-lg"
          />
          {value.length > 0 && !disabled ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-1 size-11 -translate-y-1/2"
              aria-label="Clear order number"
              onClick={onClear}
            >
              <X size={18} />
            </Button>
          ) : null}
        </div>
        <Button
          type="button"
          className="h-[52px] min-w-[112px] text-[15px]"
          disabled={disabled || searching}
          onClick={onSubmit}
        >
          {searching ? "Searching" : "Search"}
        </Button>
      </div>
      <p className="text-[13.5px] text-muted-foreground">
        Use the full number from the customer&apos;s order confirmation email.
      </p>
      <p aria-live="polite" className="min-h-[1.25rem] text-sm text-destructive">
        {error}
      </p>
    </div>
  );
}
