"use client";

import { useState } from "react";

import { FileText, FolderOpen, Loader2 } from "lucide-react";

import { SelectorContacto } from "@/components/contactos/selector-contacto";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ContactoBuscado } from "@/lib/contactos/seleccion";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import type { Impuesto } from "@/lib/impuestos/tipos";
import type { Numeracion } from "@/lib/numeraciones/tipos";
import { sumarMontos } from "@/lib/pos/calculo";

import { ivaPorTasa, useCarritoPOS } from "../carrito-pos-provider";
import { LineaCarritoPos } from "./linea-carrito-pos";
import { PestanasVentaPos } from "./pestanas-venta-pos";

const NINGUNO = "__ninguno";

export interface PanelFacturaProps {
  terminal: { id: string; nombre: string };
  turno: { id: string; numero: number } | null;
  numeraciones: Numeracion[];
  listas: { id: string; nombre: string }[];
  vendedores: { id: string; nombre: string }[];
  contactos: ContactoBuscado[];
  impuestos: Impuesto[];
  puedeEscribir: boolean;
  onCobrar: () => void;
  onVentaSimple: () => void;
  onCargarCotizacion: () => void;
  onAbrirTurno: () => void;
  onGuardarCotizacion: () => void;
  onCancelarVenta: () => void;
  onAnunciar: (mensaje: string) => void;
  guardandoCotizacion: boolean;
  errorCotizacion: string | null;
  sinCaja?: boolean;
  idPanel?: string;
}

export function PanelFactura({
  terminal,
  turno,
  numeraciones,
  listas,
  vendedores,
  contactos,
  impuestos,
  puedeEscribir,
  onCobrar,
  onVentaSimple,
  onCargarCotizacion,
  onAbrirTurno,
  onGuardarCotizacion,
  onCancelarVenta,
  onAnunciar,
  guardandoCotizacion,
  errorCotizacion,
  sinCaja = false,
  idPanel = "panel-factura-pos",
}: PanelFacturaProps) {
  const carrito = useCarritoPOS();
  const { activa, totales } = carrito;
  const [expandida, setExpandida] = useState<string | null>(null);
  const [cancelar, setCancelar] = useState(false);

  const numeracionValida = numeraciones.some((numeracion) => numeracion.id === activa.numeracionId);
  const cotizacion = activa.cotizacion;
  const articulos = sumarMontos(activa.lineas.map((linea) => linea.cantidad));

  const tasas = new Set<string>([
    "0",
    ...impuestos.filter((impuesto) => impuesto.tipo === "itbis").map((impuesto) => String(impuesto.tarifa)),
  ]);
  for (const linea of activa.lineas) tasas.add(linea.itbisTasa);
  const opcionesItbis = [...tasas]
    .sort((a, b) => Number(b) - Number(a))
    .map((tasa) => {
      const impuesto = impuestos.find((candidato) => String(candidato.tarifa) === tasa);
      return {
        value: tasa,
        label: Number(tasa) === 0 ? "Exento (0%)" : `${impuesto?.nombre ?? "ITBIS"} (${formatoCantidad(tasa)}%)`,
      };
    });

  const avisoTurno = turno === null;

  return (
    <aside
      id={idPanel}
      role="tabpanel"
      aria-labelledby={`pestana-${activa.id}`}
      className="bg-card border-border flex h-full min-h-0 flex-col border-l"
    >
      <div className="flex shrink-0 flex-col gap-2 border-b p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Factura de venta</h2>
          <span className="text-muted-foreground truncate text-xs">{activa.nombre}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="lista-precio-pos" className="text-xs">
              Lista de precios
            </Label>
            <Select
              items={[
                { value: NINGUNO, label: "Precio base" },
                ...listas.map((lista) => ({ value: lista.id, label: lista.nombre })),
              ]}
              value={activa.listaPrecioId === "" ? NINGUNO : activa.listaPrecioId}
              onValueChange={(valor) => carrito.setLista(valor === NINGUNO ? "" : (valor ?? ""))}
              disabled={cotizacion !== null}
            >
              <SelectTrigger id="lista-precio-pos" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value={NINGUNO}>Precio base</SelectItem>
                {listas.map((lista) => (
                  <SelectItem key={lista.id} value={lista.id}>
                    {lista.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="numeracion-pos" className="text-xs">
              Numeración
            </Label>
            <Select
              items={numeraciones.map((numeracion) => ({
                value: numeracion.id,
                label: `${numeracion.nombre} · ${numeracion.prefijo}`,
              }))}
              value={numeracionValida ? activa.numeracionId : null}
              onValueChange={(valor) => carrito.setNumeracion(valor ?? "")}
            >
              <SelectTrigger id="numeracion-pos" className="h-10 w-full" aria-invalid={!numeracionValida}>
                <SelectValue placeholder="Sin numeración" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {numeraciones.map((numeracion) => (
                  <SelectItem key={numeracion.id} value={numeracion.id}>
                    {`${numeracion.nombre} · ${numeracion.prefijo}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="cliente-pos" className="text-xs">
            Cliente
          </Label>
          <SelectorContacto
            id="cliente-pos"
            contactos={contactos}
            valor={activa.contactoId}
            onCambio={(contacto) => carrito.setContacto(contacto?.id ?? "")}
            tipoInicial="cliente"
            showClear={false}
            placeholder="Buscar cliente…"
            disabled={cotizacion !== null}
          />
        </div>

        {vendedores.length > 0 ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="vendedor-pos" className="text-xs">
              Vendedor
            </Label>
            <Select
              items={[
                { value: NINGUNO, label: "Sin vendedor" },
                ...vendedores.map((vendedor) => ({ value: vendedor.id, label: vendedor.nombre })),
              ]}
              value={activa.vendedorId === "" ? NINGUNO : activa.vendedorId}
              onValueChange={(valor) => carrito.setVendedor(valor === NINGUNO ? "" : (valor ?? ""))}
              disabled={cotizacion !== null}
            >
              <SelectTrigger id="vendedor-pos" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value={NINGUNO}>Sin vendedor</SelectItem>
                {vendedores.map((vendedor) => (
                  <SelectItem key={vendedor.id} value={vendedor.id}>
                    {vendedor.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {cotizacion ? (
          <div className="bg-muted/50 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
            <div className="flex min-w-0 flex-col">
              <Badge variant="secondary" className="w-fit">
                {`Cotización No ${cotizacion.numero}`}
              </Badge>
              <p className="text-muted-foreground mt-1 text-xs">
                Las líneas vienen de la cotización y no se editan aquí.
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Si quitas la cotización, se cobrará como una venta nueva y la cotización seguirá abierta. Los precios se
                conservan.
              </p>
            </div>
            <Button variant="outline" size="sm" className="h-10" onClick={carrito.quitarCotizacion}>
              Quitar
            </Button>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activa.lineas.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-6 py-10 text-center">
            <p className="font-medium">El carrito está vacío.</p>
            <p className="text-muted-foreground text-sm">Busca un producto o escanea un código para empezar.</p>
          </div>
        ) : (
          activa.lineas.map((linea) => (
            <LineaCarritoPos
              key={linea.id}
              linea={linea}
              expandida={expandida === linea.id}
              bloqueada={cotizacion !== null}
              opcionesItbis={opcionesItbis}
              onExpandir={() => setExpandida(linea.id)}
              onColapsar={() => setExpandida(null)}
              onAnunciar={onAnunciar}
            />
          ))
        )}
        {activa.lineas.length > 100 ? (
          <p className="text-muted-foreground px-3 py-2 text-xs">
            Esta venta tiene más de 100 líneas. Considera dividirla en dos ventas.
          </p>
        ) : null}
      </div>

      <div className="bg-card flex shrink-0 flex-col gap-2 border-t p-3">
        {sinCaja ? (
          <Alert variant="destructive">
            <AlertDescription>
              {`La terminal ${terminal.nombre} no tiene una cuenta de efectivo activa.`}
            </AlertDescription>
          </Alert>
        ) : null}

        {avisoTurno ? (
          <Alert>
            <AlertDescription className="flex flex-col items-start gap-2">
              <span>{`No hay un turno abierto en ${terminal.nombre}.`}</span>
              <span className="text-muted-foreground text-xs">
                Abre un turno para cobrar; puedes seguir armando el carrito.
              </span>
              <Button variant="outline" size="sm" className="h-10" onClick={onAbrirTurno}>
                Abrir turno
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {!numeracionValida ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-col items-start gap-2">
              <span>La terminal no tiene una numeración de venta activa.</span>
              <span className="text-xs">Configúrala en Contabilidad → Configuración → Punto de venta.</span>
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                render={<a href="/dashboard/configuracion/pos" target="_blank" rel="noreferrer" />}
              >
                Abrir configuración
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {errorCotizacion ? (
          <Alert variant="destructive">
            <AlertDescription>{errorCotizacion}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatoMoneda(totales.subtotal)}</span>
          </div>
          {Number(totales.descuento) > 0 ? (
            <div className="text-muted-foreground flex justify-between">
              <span>Descuento</span>
              <span className="tabular-nums">−{formatoMoneda(totales.descuento)}</span>
            </div>
          ) : null}
          {ivaPorTasa(activa.lineas).map((itbis) => (
            <div key={itbis.tasa} className="text-muted-foreground flex justify-between">
              <span>{`ITBIS ${formatoCantidad(itbis.tasa)}%`}</span>
              <span className="tabular-nums">{formatoMoneda(itbis.monto)}</span>
            </div>
          ))}
        </div>

        <div className="border-border flex items-baseline justify-between border-t pt-2">
          <span className="text-sm font-medium">Total</span>
          <span className="text-2xl font-semibold tabular-nums">{formatoMoneda(totales.total)}</span>
        </div>
        <p className="text-muted-foreground text-xs">
          {Number(articulos) === 1 ? "1 artículo" : `${formatoCantidad(articulos)} artículos`}
        </p>

        <Button
          className="h-12 w-full text-base"
          disabled={activa.lineas.length === 0 || avisoTurno || !numeracionValida || !puedeEscribir || sinCaja}
          onClick={onCobrar}
        >
          {`Vender ${formatoMoneda(totales.total)}`}
          <span className="ml-1 text-xs opacity-70">F8</span>
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-10 gap-1.5"
            disabled={activa.lineas.length === 0 || cotizacion !== null || !puedeEscribir || guardandoCotizacion}
            onClick={onGuardarCotizacion}
          >
            {guardandoCotizacion ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <FileText aria-hidden="true" />
            )}
            Guardar cotización
          </Button>
          <Button
            variant="ghost"
            className="h-10 gap-1.5"
            disabled={cotizacion !== null || !puedeEscribir}
            onClick={onCargarCotizacion}
          >
            <FolderOpen aria-hidden="true" />
            Cargar cotización
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            className="h-10 gap-1.5 px-2"
            onClick={onVentaSimple}
            disabled={cotizacion !== null || !puedeEscribir}
          >
            Venta simple
            <span className="text-muted-foreground text-xs">F4</span>
          </Button>
          <Button variant="link" className="text-destructive h-10 px-2" onClick={() => setCancelar(true)}>
            Cancelar venta
          </Button>
        </div>

        <PestanasVentaPos />
      </div>

      <AlertDialog open={cancelar} onOpenChange={setCancelar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar la venta?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminarán los productos del carrito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                carrito.vaciarPestana();
                setCancelar(false);
                onCancelarVenta();
              }}
            >
              Sí, cancelar venta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
