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

  function quitar() {
    quitarLinea(linea.id);
    onAnunciar(`${linea.descripcion} quitado.`);
  }

  const unidadVisible = linea.unidadId !== null && linea.unidadNombre ? linea.unidadNombre : null;
  const puedeEditar = !bloqueada;
  const etiquetaEdicion = expandida ? "Cerrar edición" : "Editar línea";

  return (
    <div className={cn("border-pos-linea border-b bg-white dark:bg-card", expandida && "bg-slate-50 dark:bg-white/5")}>
      <div className="flex min-h-[76px] items-center gap-3 px-4 py-2">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={expandida ? onColapsar : onExpandir}
          disabled={!puedeEditar}
        >
          <span
            className="text-pos-texto block truncate text-sm leading-5 font-bold uppercase"
            title={linea.descripcion}
          >
            {linea.descripcion}
          </span>
          <span className="text-pos-texto-suave mt-1 block truncate text-xs leading-4">
            {formatoMonedaPOS(linea.precio)}
            {unidadVisible ? ` · ${unidadVisible}` : ""}
            {Number(linea.descuentoPct) > 0 ? ` · Desc. ${formatoCantidad(linea.descuentoPct)}%` : ""}
          </span>
        </button>

        <div className="text-pos-texto flex shrink-0 items-center">
          <button
            type="button"
            className="text-pos-icono hover:text-pos-texto flex size-9 items-center justify-center rounded-md transition-colors hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-white/10"
            aria-label={`Disminuir cantidad de ${linea.descripcion}`}
            disabled={!puedeEditar}
            onClick={() => paso(-1)}
          >
            <Minus className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
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
            className="h-9 w-[60px] border-0 bg-transparent px-0 text-center text-sm font-medium tabular-nums shadow-none focus-visible:ring-1 dark:bg-transparent"
          />
          <button
            type="button"
            className="text-pos-icono hover:text-pos-texto flex size-9 items-center justify-center rounded-md transition-colors hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-white/10"
            aria-label={`Aumentar cantidad de ${linea.descripcion}`}
            disabled={!puedeEditar}
            onClick={() => paso(1)}
          >
            <Plus className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <div className="group/precio relative flex h-10 min-w-[112px] shrink-0 items-center justify-end xl:min-w-[152px]">
          <span className="text-pos-texto text-[15px] leading-5 font-bold whitespace-nowrap tabular-nums transition-opacity group-focus-within/precio:opacity-0 group-hover/precio:opacity-0">
            {formatoMonedaPOS(totales.total)}
          </span>
          {/* En táctil no hay hover real: se oculta para que un tap en el total nunca toque la papelera.
              Quitar sigue disponible en «Quitar línea» del editor. */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-1 opacity-0 transition-opacity group-focus-within/precio:pointer-events-auto group-focus-within/precio:opacity-100 group-hover/precio:pointer-events-auto group-hover/precio:opacity-100 [@media(hover:none)]:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="hover:text-pos-texto size-8"
              aria-label={etiquetaEdicion}
              title={etiquetaEdicion}
              disabled={!puedeEditar}
              onClick={expandida ? onColapsar : onExpandir}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hover:text-destructive size-8"
              aria-label={`Quitar ${linea.descripcion}`}
              title={`Quitar ${linea.descripcion}`}
              disabled={!puedeEditar}
              onClick={quitar}
            >
              <Trash2 className="size-4" aria-hidden="true" />
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

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive h-10 gap-1.5"
              disabled={!puedeEditar}
              onClick={quitar}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Quitar línea
            </Button>
            <Button variant="outline" className="h-10" onClick={onColapsar}>
              Listo
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
