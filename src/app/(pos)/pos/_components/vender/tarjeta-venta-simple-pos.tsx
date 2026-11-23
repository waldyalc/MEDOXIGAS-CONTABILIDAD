"use client";

import { ShoppingCart, Zap } from "@/components/icons";

/** Primera tarjeta del grid: abre el diálogo de venta libre (misma acción que F4). */
export function TarjetaVentaSimplePos({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Venta simple (F4)"
      className="group m-1 mx-5 mb-5 flex min-h-[250px] w-[220px] shrink-0 flex-col items-center rounded-[8px] border-2 border-[#e5e7eb] bg-white dark:border-pos-linea p-2.5 text-center shadow-[1px_2px_5px_rgba(0,0,0,0.1)] transition-colors hover:border-pos-primario/40 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none dark:bg-card"
    >
      <span className="mt-6 flex size-[100px] items-center justify-center rounded-full bg-[#f1f5f9] dark:bg-white/5">
        <span className="relative text-[#64748b] dark:text-pos-icono">
          <ShoppingCart className="size-10" strokeWidth={1.5} aria-hidden="true" />
          <Zap className="absolute -right-2 -bottom-1.5 size-5 fill-current" aria-hidden="true" />
        </span>
      </span>
      <span className="text-pos-texto mt-4 text-base font-semibold">Venta simple</span>
    </button>
  );
}
