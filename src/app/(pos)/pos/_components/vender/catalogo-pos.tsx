"use client";

import type { RefObject } from "react";

import { Loader2, PackageSearch, Plus, ScanBarcode, Star } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatoCantidad } from "@/lib/facturacion/formato";
import type { ProductoPOS } from "@/lib/pos/tipos";

import { BuscadorCatalogoPos } from "./buscador-catalogo-pos";
import { useImagenesCatalogo } from "./imagenes-catalogo-pos";
import { TarjetaProductoPos } from "./tarjeta-producto-pos";
import { TarjetaVentaSimplePos } from "./tarjeta-venta-simple-pos";

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
  onFavorito,
  onVentaSimple,
  esFavorito,
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
  onFavorito: (producto: ProductoPOS) => void;
  onVentaSimple: () => void;
  esFavorito: (producto: ProductoPOS) => boolean;
  limpiarToken?: number;
}) {
  const vacio = productos.length === 0 && !cargando;
  const imagenes = useImagenesCatalogo(productos);

  return (
    <section id="catalogo-pos" className="flex min-h-0 min-w-0 flex-col" aria-label="Catálogo">
      <div className="flex items-center gap-1.5 px-4 pt-3.5 sm:px-6">
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

        <Button
          type="button"
          variant="outline"
          className="h-10 w-[42px] shrink-0 rounded-[10px] border-slate-400/40 shadow-none"
          aria-label="Leer código de barras"
          title="Lector de código de barras"
          onClick={() => {
            inputRef.current?.focus();
            inputRef.current?.select();
          }}
        >
          <ScanBarcode className="size-5" aria-hidden="true" />
        </Button>

        <Button
          className="h-10 w-10 shrink-0 justify-center rounded-[10px] bg-[#cff2f1] px-0 text-sm font-medium text-[#1a7e7f] hover:bg-[#cff2f1]/70 hover:text-[#1a7e7f] sm:w-[151px] dark:bg-pos-acento dark:text-pos-acento-texto"
          aria-label="Nuevo producto"
          render={<a href="/dashboard/productos/nuevo" target="_blank" rel="noreferrer" />}
        >
          <span className="hidden sm:inline">Nuevo producto</span>
          <Plus className="sm:hidden" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pt-2 pb-1 sm:px-6">
        <Select
          items={[
            { value: TODAS, label: "Todas las categorías" },
            ...categorias.map((item) => ({ value: item.id, label: item.nombre })),
          ]}
          value={categoria === "" ? TODAS : categoria}
          onValueChange={(valor) => onCategoria(valor === TODAS ? "" : (valor ?? ""))}
        >
          <SelectTrigger className="h-8 w-[180px] text-sm" aria-label="Categoría del catálogo">
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

        <Button
          type="button"
          variant={favoritos ? "secondary" : "outline"}
          aria-pressed={favoritos}
          onClick={onFavoritos}
          className="h-8 gap-1.5 text-sm"
        >
          <Star fill={favoritos ? "currentColor" : "none"} aria-hidden="true" />
          Favoritos
        </Button>

        <span className="text-pos-texto-suave ml-auto text-xs tabular-nums">
          {productos.length === 1 ? "1 producto" : `${formatoCantidad(productos.length)} productos`}
        </span>
      </div>

      {error ? (
        <div className="px-4 sm:px-6">
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center gap-2">
              No se pudo cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.
              <Button variant="outline" size="sm" onClick={onReintentar}>
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {cargando && productos.length === 0 ? (
          <div className="flex flex-wrap content-start items-start justify-around pt-3" aria-busy="true">
            <span className="sr-only">Cargando productos…</span>
            {Array.from({ length: 10 }, (_, indice) => (
              <Skeleton key={`catalogo-esqueleto-${indice}`} className="m-1 mx-5 mb-5 h-[250px] w-[220px] rounded-lg" />
            ))}
          </div>
        ) : null}

        {vacio && !error ? (
          <div className="border-pos-linea bg-card mx-4 my-2 flex flex-col items-center gap-2 rounded-xl border px-6 py-16 text-center sm:mx-6">
            <PackageSearch className="text-pos-icono size-8" aria-hidden="true" />
            {busqueda !== "" ? (
              <>
                <p className="font-semibold">{`No encontramos productos para «${busqueda}».`}</p>
                <p className="text-pos-texto-suave text-sm">Revisa el nombre o escanea el código de barra.</p>
                <Button variant="outline" size="sm" onClick={onLimpiar}>
                  Limpiar búsqueda
                </Button>
              </>
            ) : favoritos ? (
              <>
                <p className="font-semibold">Aún no tienes productos favoritos.</p>
                <p className="text-pos-texto-suave text-sm">
                  Marca productos con la estrella del catálogo para verlos aquí.
                </p>
                <Button variant="outline" size="sm" onClick={onLimpiar}>
                  Ver todo el catálogo
                </Button>
              </>
            ) : (
              <>
                <p className="font-semibold">No hay productos en esta terminal.</p>
                <p className="text-pos-texto-suave text-sm">
                  Configura el catálogo en Inventario o cambia de terminal.
                </p>
              </>
            )}
          </div>
        ) : null}

        {!vacio ? (
          <div className="flex flex-wrap content-start items-start justify-around pt-3">
            <TarjetaVentaSimplePos onClick={onVentaSimple} />
            {productos.map((producto) => (
              <TarjetaProductoPos
                key={producto.producto_id}
                producto={producto}
                cantidad={cantidades.get(producto.producto_id) ?? 0}
                resaltado={resaltado >= 0 && productos[resaltado]?.producto_id === producto.producto_id}
                favorito={esFavorito(producto)}
                imagenUrl={imagenes.get(producto.producto_id) ?? null}
                onAgregar={onAgregar}
                onFavorito={onFavorito}
              />
            ))}
          </div>
        ) : null}

        {hayMas && !cargando ? (
          <div className="flex justify-center pt-3 pb-4">
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
