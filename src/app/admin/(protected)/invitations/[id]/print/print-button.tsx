"use client";

import { ui } from "@/components/ui/styles";

export function PrintButton() {
  return (
    <button type="button" className={ui.button} onClick={() => window.print()}>
      Print
    </button>
  );
}
