"use client";

import type { RefObject } from "react";

import { Loader2, PackageSearch, Star } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatoCantidad } from "@/lib/facturacion/formato";
import type { ProductoPOS } from "@/lib/pos/tipos";

import { BuscadorCatalogoPos } from "./buscador-catalogo-pos";
import { TarjetaProductoPos } from "./tarjeta-producto-pos";

const TODAS = "__todas";

export function CatalogoPos({
  inputRef,
  productos,
  categorias,
  categoria,
  favoritos,
  busqueda,
  cargando,
  cargandoMas,
  hayMas,
  error,
  resultados,
  resaltado,
  cantidades,
  onBuscar,
  onEnter,
  onMover,
  onFavoritos,
  onCategoria,
  onLimpiar,
  onReintentar,
  onVerMas,
  onAgregar,
  limpiarToken,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  productos: ProductoPOS[];
  categorias: { id: string; nombre: string }[];
  categoria: string;
  favoritos: boolean;
  busqueda: string;
  cargando: boolean;
  cargandoMas: boolean;
  hayMas: boolean;
  error: string | null;
  resultados: number;
  resaltado: number;
  cantidades: Map<string, number>;
  onBuscar: (texto: string) => void;
  onEnter: (texto: string) => boolean;
  onMover: (delta: number) => void;
  onFavoritos: () => void;
  onCategoria: (categoriaId: string) => void;
  onLimpiar: () => void;
  onReintentar: () => void;
  onVerMas: () => void;
  onAgregar: (producto: ProductoPOS) => void;
  limpiarToken?: number;
}) {
  const vacio = productos.length === 0 && !cargando;

  return (
    <section id="catalogo-pos" className="flex min-h-0 min-w-0 flex-col gap-3" aria-label="Catálogo">
      <BuscadorCatalogoPos
        inputRef={inputRef}
        cargando={cargando}
        resultados={resultados}
        resaltado={resaltado}
        onBuscar={onBuscar}
        onEnter={onEnter}
        onMover={onMover}
        onLimpiar={onLimpiar}
        limpiarToken={limpiarToken}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={favoritos ? "secondary" : "outline"}
          aria-pressed={favoritos}
          onClick={onFavoritos}
          className="h-10 gap-1.5"
        >
          <Star className={favoritos ? "fill-current" : ""} aria-hidden="true" />
          Favoritos
        </Button>

        <Select
          items={[
            { value: TODAS, label: "Todas las categorías" },
            ...categorias.map((item) => ({ value: item.id, label: item.nombre })),
          ]}
          value={categoria === "" ? TODAS : categoria}
          onValueChange={(valor) => onCategoria(valor === TODAS ? "" : (valor ?? ""))}
        >
          <SelectTrigger className="h-10 w-[210px]" aria-label="Categoría del catálogo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value={TODAS}>Todas las categorías</SelectItem>
            {categorias.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {productos.length === 1 ? "1 producto" : `${formatoCantidad(productos.length)} productos`}
        </span>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            No se pudo cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.
            <Button variant="outline" size="sm" onClick={onReintentar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
        {cargando && productos.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-busy="true">
            <span className="sr-only">Cargando productos…</span>
            {Array.from({ length: 8 }, (_, indice) => (
              <Skeleton key={`catalogo-esqueleto-${indice}`} className="h-[148px] rounded-xl" />
            ))}
          </div>
        ) : null}

        {vacio && !error ? (
          <div className="border-border bg-card flex flex-col items-center gap-2 rounded-xl border px-6 py-16 text-center">
            <PackageSearch className="text-muted-foreground size-8" aria-hidden="true" />
            {busqueda !== "" ? (
              <>
                <p className="font-semibold">{`No encontramos productos para «${busqueda}».`}</p>
                <p className="text-muted-foreground text-sm">Revisa el nombre o escanea el código de barra.</p>
                <Button variant="outline" size="sm" onClick={onLimpiar}>
                  Limpiar búsqueda
                </Button>
              </>
            ) : favoritos ? (
              <>
                <p className="font-semibold">Aún no tienes productos favoritos.</p>
                <p className="text-muted-foreground text-sm">
                  Marca productos como favoritos en Inventario para verlos aquí.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  render={<a href="/dashboard/productos" target="_blank" rel="noreferrer" />}
                >
                  Ir a Inventario
                </Button>
              </>
            ) : (
              <>
                <p className="font-semibold">No hay productos en esta terminal.</p>
                <p className="text-muted-foreground text-sm">
                  Configura el catálogo en Inventario o cambia de terminal.
                </p>
              </>
            )}
          </div>
        ) : null}

        {!vacio ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {productos.map((producto) => (
              <TarjetaProductoPos
                key={producto.producto_id}
                producto={producto}
                cantidad={cantidades.get(producto.producto_id) ?? 0}
                resaltado={resaltado >= 0 && productos[resaltado]?.producto_id === producto.producto_id}
                onAgregar={onAgregar}
              />
            ))}
          </div>
        ) : null}

        {hayMas && !cargando ? (
          <div className="flex justify-center pt-3">
            <Button variant="outline" className="h-10" onClick={onVerMas} disabled={cargandoMas}>
              {cargandoMas ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {cargandoMas ? "Cargando…" : "Ver más productos"}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
