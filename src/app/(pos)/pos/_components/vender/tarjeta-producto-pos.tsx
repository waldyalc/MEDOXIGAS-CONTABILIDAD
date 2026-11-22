"use client";

import type { ReactNode } from "react";

import { cn } from "cn";

import { Star, Tag, TriangleAlert } from "@/components/icons";
import { formatoCantidad } from "@/lib/facturacion/formato";
import type { ProductoPOS } from "@/lib/pos/tipos";

import { formatoMonedaPOS } from "../formato-pos";

export function TarjetaProductoPos({
  producto,
  cantidad,
  resaltado,
  imagenUrl,
  onAgregar,
}: {
  producto: ProductoPOS;
  cantidad: number;
  resaltado: boolean;
  imagenUrl: string | null;
  onAgregar: (producto: ProductoPOS) => void;
}) {
  const esServicio = producto.tipo === "servicio";
  const esCombo = producto.tipo === "combo";
  const comboSinDisponible = esCombo && producto.disponible == null;
  const disponible =
    esCombo && producto.disponible != null ? Number(producto.disponible) || 0 : Number(producto.stock) || 0;
  const agotado = !esServicio && !comboSinDisponible && disponible <= 0;

  let etiquetaInventario: ReactNode;
  if (esServicio) {
    etiquetaInventario = <span className="text-muted-foreground text-[11px] font-medium">Servicio</span>;
  } else if (comboSinDisponible) {
    etiquetaInventario = <span className="text-muted-foreground text-[11px] font-medium">Combo</span>;
  } else if (agotado) {
    etiquetaInventario = (
      <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
        <TriangleAlert className="size-3" aria-hidden="true" />
        Agotado
      </span>
    );
  } else {
    etiquetaInventario = (
      <span className="text-pos-primario text-[11px] font-medium tabular-nums">Inv. {formatoCantidad(disponible)}</span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onAgregar(producto)}
      aria-label={`Agregar ${producto.nombre}`}
      className={cn(
        "border-border bg-card hover:border-pos-primario/60 hover:bg-pos-primario/[0.03] group relative flex flex-col items-center gap-1 rounded-[10px] border p-3 text-center transition-colors",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
        cantidad > 0 && "border-pos-primario ring-pos-primario/40 ring-1",
        resaltado && "border-pos-primario bg-pos-primario/5",
      )}
    >
      {cantidad > 0 ? (
        <span className="bg-pos-primario absolute -top-1.5 -right-1.5 z-10 flex size-6 items-center justify-center rounded-full text-xs font-semibold text-white tabular-nums shadow-sm">
          {formatoCantidad(cantidad)}
        </span>
      ) : null}

      {producto.favorito_pos ? (
        <span className="bg-pos-primario absolute top-2 right-2 flex size-5 items-center justify-center rounded-md text-white">
          <Star className="size-3 fill-current" aria-label="Favorito" />
        </span>
      ) : (
        <Star className="text-muted-foreground/40 absolute top-2.5 right-2.5 size-4" aria-hidden="true" />
      )}

      <span className="flex h-16 w-full items-center justify-center">
        {imagenUrl ? (
          <img src={imagenUrl} alt="" loading="lazy" className="max-h-16 max-w-full object-contain" />
        ) : (
          <Tag className="text-muted-foreground/30 size-11" strokeWidth={1.5} aria-hidden="true" />
        )}
      </span>

      {etiquetaInventario}

      <span className="line-clamp-2 min-h-8 text-[13px] leading-4">{producto.nombre}</span>
      <span className="mt-auto text-[15px] font-semibold tabular-nums">{formatoMonedaPOS(producto.precio)}</span>

      <span className="sr-only">{`${producto.nombre}. ${formatoMonedaPOS(producto.precio)}.`}</span>
    </button>
  );
}
