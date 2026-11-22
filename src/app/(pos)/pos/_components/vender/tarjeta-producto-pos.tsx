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
    etiquetaInventario = <span className="text-pos-texto-suave text-xs font-medium">Servicio</span>;
  } else if (comboSinDisponible) {
    etiquetaInventario = <span className="text-pos-texto-suave text-xs font-medium">Combo</span>;
  } else if (agotado) {
    etiquetaInventario = (
      <span className="flex h-4 items-center justify-center gap-1 rounded-lg bg-[#f9fafb] px-2 text-xs font-normal text-[#e85e42] dark:bg-white/5">
        <TriangleAlert className="size-3" aria-hidden="true" />
        Agotado
      </span>
    );
  } else {
    etiquetaInventario = (
      <span className="text-pos-primario flex h-4 items-center justify-center rounded-lg bg-[#f9fafb] px-2 text-xs font-normal tabular-nums dark:bg-white/5">
        Inv. {formatoCantidad(disponible)}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onAgregar(producto)}
      aria-label={`Agregar ${producto.nombre}`}
      className={cn(
        "group relative m-1 mx-5 mb-5 flex min-h-[250px] w-[220px] shrink-0 flex-col items-center rounded-[8px] border-2 border-transparent bg-white p-2.5 text-center shadow-[1px_2px_5px_rgba(0,0,0,0.1)] transition-colors dark:bg-card",
        "hover:border-pos-primario/40 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
        cantidad > 0 && "border-pos-primario",
        resaltado && "border-pos-primario bg-pos-primario/5",
      )}
    >
      {cantidad > 0 ? (
        <span className="bg-pos-primario absolute -top-1.5 -right-1.5 z-20 flex size-[22px] items-center justify-center rounded-full text-xs font-semibold text-white tabular-nums ring-2 ring-white dark:ring-card">
          {formatoCantidad(cantidad)}
        </span>
      ) : null}

      {producto.favorito_pos ? (
        <span className="absolute -top-0.5 right-3 z-10 flex h-8 w-7 items-center justify-center rounded-b-lg bg-[#30aba9] text-white">
          <Star className="size-4 fill-current" aria-label="Favorito" />
        </span>
      ) : (
        <Star className="text-pos-icono/40 absolute top-2 right-2 size-4" aria-hidden="true" />
      )}

      <span className="mt-9 mb-2 flex h-[98px] w-full items-center justify-center">
        {imagenUrl ? (
          // biome-ignore lint/performance/noImgElement: imagen firmada del bucket privado de productos
          <img src={imagenUrl} alt="" loading="lazy" className="max-h-[98px] max-w-full rounded-lg object-contain" />
        ) : (
          <Tag className="text-[#d1d5db] dark:text-pos-icono/40 size-16" strokeWidth={1.25} aria-hidden="true" />
        )}
      </span>

      {etiquetaInventario}

      <span className="text-pos-texto mt-1 line-clamp-2 w-full text-sm leading-[22px] uppercase">
        {producto.nombre}
      </span>
      <span className="text-pos-texto mt-auto text-base leading-[26px] tabular-nums">
        {formatoMonedaPOS(producto.precio)}
      </span>

      <span className="sr-only">{`${producto.nombre}. ${formatoMonedaPOS(producto.precio)}.`}</span>
    </button>
  );
}
