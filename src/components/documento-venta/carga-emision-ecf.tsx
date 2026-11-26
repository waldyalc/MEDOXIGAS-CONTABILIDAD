"use client";

import { Loader2 } from "@/components/icons";

export function CargaEmisionEcf() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-950/10 backdrop-blur-[1px]"
    >
      <div className="border-border bg-card flex min-w-[320px] flex-col items-center rounded-2xl border px-8 py-7 shadow-xl">
        <Loader2 className="text-primary size-8 animate-spin" />
        <p className="text-foreground mt-4 text-sm font-semibold">Subiendo comprobante a la DGII…</p>
        <p className="text-muted-foreground mt-1 max-w-[320px] text-center text-xs leading-5">
          Generando XML, aplicando firma digital y validando con la DGII
        </p>
      </div>
    </div>
  );
}
