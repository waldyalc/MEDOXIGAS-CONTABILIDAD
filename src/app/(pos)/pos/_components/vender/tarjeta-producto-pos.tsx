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
  favorito,
  imagenUrl,
  onAgregar,
  onFavorito,
}: {
  producto: ProductoPOS;
  cantidad: number;
  resaltado: boolean;
  favorito: boolean;
  imagenUrl: string | null;
  onAgregar: (producto: ProductoPOS) => void;
  onFavorito: (producto: ProductoPOS) => void;
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
    <article
      className={cn(
        "group relative m-1 mx-5 mb-5 flex min-h-[250px] w-[220px] shrink-0 flex-col items-center rounded-[8px] border-2 border-transparent bg-white p-2.5 text-center shadow-[1px_2px_5px_rgba(0,0,0,0.1)] transition-colors dark:bg-card",
        "hover:border-pos-primario/40 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-2",
        cantidad > 0 && "border-pos-primario",
        resaltado && "border-pos-primario bg-pos-primario/5",
      )}
    >
      <button
        type="button"
        onClick={() => onAgregar(producto)}
        aria-label={`Agregar ${producto.nombre}`}
        className="absolute inset-0 z-10 rounded-[6px] outline-none"
      />

      {cantidad > 0 ? (
        <span className="bg-pos-primario absolute -top-1.5 -left-1.5 z-20 flex size-[22px] items-center justify-center rounded-full text-xs font-semibold text-white tabular-nums ring-2 ring-white dark:ring-card">
          {formatoCantidad(cantidad)}
        </span>
      ) : null}

      {/* Cuadro teal de Alegra, siempre visible: estrella blanca vacía o rellena. No agrega al carrito. */}
      <button
        type="button"
        onClick={(evento) => {
          evento.stopPropagation();
          onFavorito(producto);
        }}
        aria-pressed={favorito}
        aria-label={favorito ? `Quitar ${producto.nombre} de favoritos` : `Marcar ${producto.nombre} como favorito`}
        className="bg-pos-primario hover:bg-pos-primario-hover absolute top-0 right-0 z-20 flex size-8 items-center justify-center rounded-tr-[6px] rounded-bl-[8px] text-white transition-colors"
      >
        {/* Phosphor dibuja la estrella con un path relleno: «regular» es el contorno y «fill» la sólida. */}
        <Star weight={favorito ? "fill" : "regular"} className="size-[18px]" aria-hidden="true" />
      </button>

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
    </article>
  );
}
