"use client";

import { buttonClass } from "./ui";

export function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary")}>
      {label}
    </button>
  );
}
