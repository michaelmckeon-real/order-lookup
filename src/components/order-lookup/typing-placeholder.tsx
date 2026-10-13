"use client";

import { useEffect, useState } from "react";

const PLACEHOLDER = "1234567";
const DIGIT_MS = 70;
const FIRST_DELAY_MS = 250;
const HOLD_UNTIL_MS = 5500;
const CYCLE_MS = 6000;

type Phase = "delay" | "typing" | "hold" | "gap";

export function TypingPlaceholder() {
  const [visible, setVisible] = useState("");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const frame = window.requestAnimationFrame(() => {
        setVisible(PLACEHOLDER);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    let timeoutId = 0;
    let intervalId = 0;
    let cycleOrigin = performance.now();
    let delayBeforeType = FIRST_DELAY_MS;
    let phase: Phase = "delay";
    let digitsShown = 0;
    let pausedAt: number | null = null;

    function clearTimers() {
      if (timeoutId !== 0) {
        window.clearTimeout(timeoutId);
        timeoutId = 0;
      }
      if (intervalId !== 0) {
        window.clearInterval(intervalId);
        intervalId = 0;
      }
    }

    function after(ms: number, fn: () => void) {
      timeoutId = window.setTimeout(fn, ms);
    }

    function startNextCycle() {
      delayBeforeType = 0;
      cycleOrigin = performance.now();
      phase = "delay";
      digitsShown = 0;
      arm();
    }

    function finishTyping() {
      phase = "hold";
      const elapsed = performance.now() - cycleOrigin;
      after(Math.max(0, HOLD_UNTIL_MS - elapsed), () => {
        phase = "gap";
        setVisible("");
        const gapElapsed = performance.now() - cycleOrigin;
        after(Math.max(0, CYCLE_MS - gapElapsed), () => {
          startNextCycle();
        });
      });
    }

    function startTypingInterval() {
      intervalId = window.setInterval(() => {
        if (document.visibilityState === "hidden") {
          return;
        }
        digitsShown += 1;
        setVisible(PLACEHOLDER.slice(0, digitsShown));
        if (digitsShown >= PLACEHOLDER.length) {
          window.clearInterval(intervalId);
          intervalId = 0;
          finishTyping();
        }
      }, DIGIT_MS);
    }

    function arm() {
      clearTimers();
      const elapsed = performance.now() - cycleOrigin;

      if (phase === "delay") {
        after(Math.max(0, delayBeforeType - elapsed), () => {
          phase = "typing";
          digitsShown = 0;
          startTypingInterval();
        });
        return;
      }

      if (phase === "typing") {
        setVisible(PLACEHOLDER.slice(0, digitsShown));
        startTypingInterval();
        return;
      }

      if (phase === "hold") {
        setVisible(PLACEHOLDER);
        after(Math.max(0, HOLD_UNTIL_MS - elapsed), () => {
          phase = "gap";
          setVisible("");
          const gapElapsed = performance.now() - cycleOrigin;
          after(Math.max(0, CYCLE_MS - gapElapsed), () => {
            startNextCycle();
          });
        });
        return;
      }

      setVisible("");
      after(Math.max(0, CYCLE_MS - elapsed), () => {
        startNextCycle();
      });
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        pausedAt = performance.now();
        clearTimers();
        return;
      }
      if (pausedAt === null) {
        return;
      }
      cycleOrigin += performance.now() - pausedAt;
      pausedAt = null;
      arm();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    arm();

    return () => {
      clearTimers();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  if (visible.length === 0) {
    return null;
  }

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-[calc(14px_+_1ch)] -translate-y-1/2 font-mono text-lg font-medium text-muted-foreground"
    >
      {visible}
    </span>
  );
}
