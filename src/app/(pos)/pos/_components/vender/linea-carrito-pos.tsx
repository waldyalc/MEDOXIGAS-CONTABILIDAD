"use client";

import { useEffect, useState } from "react";

import { cn } from "cn";

import { Minus, Pencil, Plus, Trash2 } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatoCantidad } from "@/lib/facturacion/formato";

import { type LineaCarrito, totalesDeLinea, useCarritoPOS } from "../carrito-pos-provider";
import { formatoMonedaPOS, textoAMonto } from "../formato-pos";

export function LineaCarritoPos({
  linea,
  expandida,
  bloqueada,
  opcionesItbis,
  onExpandir,
  onColapsar,
  onAnunciar,
}: {
  linea: LineaCarrito;
  expandida: boolean;
  bloqueada: boolean;
  opcionesItbis: { value: string; label: string }[];
  onExpandir: () => void;
  onColapsar: () => void;
  onAnunciar: (mensaje: string) => void;
}) {
  const { actualizarLinea, cambiarCantidad, quitarLinea } = useCarritoPOS();
  const totales = totalesDeLinea(linea);
  const [cantidadTexto, setCantidadTexto] = useState(linea.cantidad);
  const [errorCantidad, setErrorCantidad] = useState<string | null>(null);
  const [precioTexto, setPrecioTexto] = useState(linea.precio);
  const [descuentoTexto, setDescuentoTexto] = useState(linea.descuentoPct);

  useEffect(() => {
    setCantidadTexto(linea.cantidad);
    setPrecioTexto(linea.precio);
    setDescuentoTexto(linea.descuentoPct);
  }, [linea.cantidad, linea.precio, linea.descuentoPct]);

  function fijarCantidad() {
    const monto = textoAMonto(cantidadTexto);
    if (monto === null || Number(monto) <= 0) {
      setCantidadTexto("1");
      cambiarCantidad(linea.id, "1");
      setErrorCantidad("La cantidad debe ser mayor a cero.");
      return;
    }
    setErrorCantidad(null);
    setCantidadTexto(monto);
    cambiarCantidad(linea.id, monto);
  }

  function paso(delta: number) {
    const actual = Number(linea.cantidad) || 0;
    const siguiente = Math.max(1, Math.round((actual + delta) * 100) / 100);
    cambiarCantidad(linea.id, siguiente.toFixed(2));
  }

  const unidadVisible = linea.unidadId !== null && linea.unidadNombre ? linea.unidadNombre : null;
  const puedeEditar = !bloqueada;

  return (
    <div
      className={cn(
        "group border-pos-linea border-b bg-white dark:bg-card",
        expandida && "bg-slate-50 dark:bg-white/5",
      )}
    >
      <div className="flex items-start gap-2 px-4 py-2.5">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={expandida ? onColapsar : onExpandir}
          disabled={!puedeEditar}
        >
          <span
            className="text-pos-texto block truncate text-[13px] leading-snug font-semibold uppercase"
            title={linea.descripcion}
          >
            {linea.descripcion}
          </span>
          <span className="text-pos-texto-suave mt-0.5 block truncate text-xs">
            {formatoMonedaPOS(linea.precio)}
            {unidadVisible ? ` · ${unidadVisible}` : ""}
            {Number(linea.descuentoPct) > 0 ? ` · Desc. ${formatoCantidad(linea.descuentoPct)}%` : ""}
          </span>
        </button>

        <div className="text-pos-texto flex shrink-0 items-center gap-0.5 self-center">
          <button
            type="button"
            className="text-pos-icono hover:text-pos-texto flex size-6 items-center justify-center disabled:opacity-40"
            aria-label={`Disminuir cantidad de ${linea.descripcion}`}
            disabled={!puedeEditar}
            onClick={() => paso(-1)}
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <Input
            value={cantidadTexto}
            inputMode="decimal"
            aria-label={`Cantidad de ${linea.descripcion}`}
            aria-invalid={errorCantidad !== null}
            disabled={!puedeEditar}
            onChange={(evento) => setCantidadTexto(evento.target.value)}
            onBlur={fijarCantidad}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") fijarCantidad();
            }}
            className="h-7 w-9 border-0 px-0 text-center text-sm tabular-nums shadow-none focus-visible:ring-1"
          />
          <button
            type="button"
            className="text-pos-icono hover:text-pos-texto flex size-6 items-center justify-center disabled:opacity-40"
            aria-label={`Aumentar cantidad de ${linea.descripcion}`}
            disabled={!puedeEditar}
            onClick={() => paso(1)}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex w-[86px] shrink-0 flex-col items-end">
          <span className="text-pos-texto text-sm font-bold tabular-nums">{formatoMonedaPOS(totales.total)}</span>
          <div className="text-pos-icono flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="hover:text-pos-texto size-6"
              aria-label={expandida ? "Cerrar edición" : "Editar línea"}
              disabled={!puedeEditar}
              onClick={expandida ? onColapsar : onExpandir}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hover:text-destructive size-6"
              aria-label={`Quitar ${linea.descripcion}`}
              disabled={!puedeEditar}
              onClick={() => {
                quitarLinea(linea.id);
                onAnunciar(`${linea.descripcion} quitado.`);
              }}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {errorCantidad ? (
        <p role="alert" className="text-destructive px-4 pb-2 text-xs">
          {errorCantidad}
        </p>
      ) : null}

      {expandida ? (
        <div className="flex flex-col gap-3 px-3 pb-3">
          {linea.productoId === null ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor={`descripcion-${linea.id}`}>Descripción</Label>
              <Input
                id={`descripcion-${linea.id}`}
                value={linea.descripcion}
                maxLength={200}
                onChange={(evento) => actualizarLinea(linea.id, { descripcion: evento.target.value })}
              />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            {linea.productoId !== null ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor={`unidad-${linea.id}`}>Unidad</Label>
                <Select
                  items={[
                    { value: "base", label: linea.unidadBase ?? "Unidad" },
                    ...linea.unidades.map((unidad) => ({
                      value: unidad.id,
                      label: `${unidad.nombre} (×${formatoCantidad(unidad.factor_base)})`,
                    })),
                  ]}
                  value={linea.unidadId ?? "base"}
                  onValueChange={(valor) => {
                    if (valor === "base") {
                      actualizarLinea(linea.id, {
                        unidadId: null,
                        unidadNombre: linea.unidadBase,
                        factorBase: null,
                        precio: linea.precioBase ?? linea.precio,
                        precioManual: false,
                      });
                      return;
                    }
                    const unidad = linea.unidades.find((candidata) => candidata.id === valor);
                    if (!unidad) return;
                    actualizarLinea(linea.id, {
                      unidadId: unidad.id,
                      unidadNombre: unidad.nombre,
                      factorBase: unidad.factor_base,
                      precio: unidad.precio,
                      precioManual: false,
                    });
                  }}
                >
                  <SelectTrigger id={`unidad-${linea.id}`} className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectItem value="base">{linea.unidadBase ?? "Unidad"}</SelectItem>
                    {linea.unidades.map((unidad) => (
                      <SelectItem key={unidad.id} value={unidad.id}>
                        {`${unidad.nombre} (×${formatoCantidad(unidad.factor_base)})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="flex flex-col gap-1">
              <Label htmlFor={`precio-${linea.id}`}>Precio</Label>
              <InputGroup className="h-10">
                <InputGroupAddon>
                  <InputGroupText>RD$</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id={`precio-${linea.id}`}
                  value={precioTexto}
                  inputMode="decimal"
                  onChange={(evento) => setPrecioTexto(evento.target.value)}
                  onBlur={() => {
                    const monto = textoAMonto(precioTexto);
                    if (monto === null || Number(monto) < 0) {
                      setPrecioTexto(linea.precio);
                      return;
                    }
                    setPrecioTexto(monto);
                    actualizarLinea(linea.id, { precio: monto, precioManual: true });
                  }}
                />
              </InputGroup>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor={`descuento-${linea.id}`}>Descuento</Label>
              <InputGroup className="h-10">
                <InputGroupInput
                  id={`descuento-${linea.id}`}
                  value={descuentoTexto}
                  inputMode="decimal"
                  onChange={(evento) => setDescuentoTexto(evento.target.value)}
                  onBlur={() => {
                    const monto = textoAMonto(descuentoTexto);
                    if (monto === null || Number(monto) < 0 || Number(monto) > 100) {
                      setDescuentoTexto(linea.descuentoPct);
                      return;
                    }
                    setDescuentoTexto(monto);
                    actualizarLinea(linea.id, { descuentoPct: monto });
                  }}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>%</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor={`itbis-${linea.id}`}>ITBIS</Label>
              <Select
                items={opcionesItbis}
                value={linea.itbisTasa}
                onValueChange={(valor) => {
                  if (valor === null) return;
                  actualizarLinea(linea.id, { itbisTasa: valor, impuestoId: null });
                }}
              >
                <SelectTrigger id={`itbis-${linea.id}`} className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {opcionesItbis.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" className="h-10" onClick={onColapsar}>
              Listo
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
