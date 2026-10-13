"use client";

import { useEffect, useState } from "react";

const PLACEHOLDER = "1234567";

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

    let index = 0;
    let intervalId = 0;

    const timeoutId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        index += 1;
        setVisible(PLACEHOLDER.slice(0, index));
        if (index >= PLACEHOLDER.length) {
          window.clearInterval(intervalId);
        }
      }, 70);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
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
