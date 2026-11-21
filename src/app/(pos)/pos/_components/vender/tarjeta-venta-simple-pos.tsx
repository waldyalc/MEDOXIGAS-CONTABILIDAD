"use client";

import { Zap } from "@/components/icons";

/** Primera tarjeta del grid: abre el diálogo de venta libre (misma acción que F4). */
export function TarjetaVentaSimplePos({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Venta simple (F4)"
      className="border-border bg-card hover:border-primary/60 hover:bg-primary/[0.03] group relative flex flex-col items-center justify-center gap-3 rounded-[10px] border p-3 text-center transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-full">
        <Zap className="size-7" aria-hidden="true" />
      </span>
      <span className="text-[13px] font-medium">Venta simple</span>
    </button>
  );
}
