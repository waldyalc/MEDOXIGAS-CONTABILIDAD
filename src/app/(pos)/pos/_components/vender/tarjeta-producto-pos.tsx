"use client";

import { cn } from "cn";
import { Package, Star } from "lucide-react";

import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import type { ProductoPOS } from "@/lib/pos/tipos";

export function TarjetaProductoPos({
  producto,
  cantidad,
  resaltado,
  onAgregar,
}: {
  producto: ProductoPOS;
  cantidad: number;
  resaltado: boolean;
  onAgregar: (producto: ProductoPOS) => void;
}) {
  const stock = Number(producto.stock) || 0;
  const esServicio = producto.tipo === "servicio";
  const esCombo = producto.tipo === "combo";

  return (
    <button
      type="button"
      onClick={() => onAgregar(producto)}
      aria-label={`Agregar ${producto.nombre}`}
      className={cn(
        "border-border bg-card hover:border-ring group relative flex min-h-[148px] flex-col gap-1 rounded-xl border p-2.5 text-left transition-colors",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
        resaltado && "border-primary bg-primary/5",
      )}
    >
      {cantidad > 0 ? (
        <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
          {formatoCantidad(cantidad)}
        </span>
      ) : null}

      <div className="flex items-start gap-2">
        <div className="bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center rounded-lg">
          <Package className="size-6" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-5">
          <span className="line-clamp-2 text-sm leading-4 font-medium">{producto.nombre}</span>
          <span className="text-muted-foreground text-xs">{producto.unidad_medida ?? "Unidad"}</span>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-0.5">
        <span className="text-base font-semibold tabular-nums">{formatoMoneda(producto.precio)}</span>
        {esServicio ? (
          <span className="text-muted-foreground text-xs">Servicio</span>
        ) : esCombo ? (
          <span className="text-muted-foreground text-xs">
            Combo{producto.disponible != null ? ` · Disponible: ${formatoCantidad(producto.disponible)}` : ""}
          </span>
        ) : stock <= 0 ? (
          <span className="text-destructive text-xs">Sin existencia</span>
        ) : (
          <span className="text-muted-foreground text-xs">Existencia: {formatoCantidad(stock)}</span>
        )}
      </div>

      {producto.favorito_pos ? (
        <Star className="text-primary absolute right-1.5 bottom-1.5 size-3.5 fill-current" aria-label="Favorito" />
      ) : null}

      <span className="sr-only">{`${producto.nombre}. ${formatoMoneda(producto.precio)}.`}</span>
    </button>
  );
}
