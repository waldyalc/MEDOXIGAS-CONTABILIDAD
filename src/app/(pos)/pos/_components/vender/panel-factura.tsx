"use client";

import { useState } from "react";

import { DialogoNuevoContacto } from "@/components/contactos/dialogo-nuevo-contacto";
import { SelectorContacto } from "@/components/contactos/selector-contacto";
import {
  Basket,
  FileText,
  FolderOpen,
  Loader2,
  Percent,
  Printer,
  Receipt,
  SlidersHorizontal,
  UserPlus,
  Zap,
} from "@/components/icons";
import { TicketPos } from "@/components/pos/ticket-pos";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatoCantidad } from "@/lib/facturacion/formato";
import type { ContactoResumen, Empresa } from "@/lib/facturacion/tipos";
import type { Impuesto } from "@/lib/impuestos/tipos";
import type { Numeracion } from "@/lib/numeraciones/tipos";
import { sumarMontos } from "@/lib/pos/calculo";
import { armarTicketCotizacionDocumento, armarTicketPrefactura, type TicketPOSPayload } from "@/lib/pos/impresion";
import type { LineaVenta, PlantillaTicket } from "@/lib/pos/tipos";

import { type LineaCarrito, totalesDeLinea, useCarritoPOS } from "../carrito-pos-provider";
import { formatoMonedaPOS, hoyRD } from "../formato-pos";
import { LineaCarritoPos } from "./linea-carrito-pos";

const NINGUNO = "__ninguno";

/** «Crédito fiscal B01» se muestra como en Alegra: «Crédito fiscal (01)». */
function etiquetaNumeracion(numeracion: Numeracion): string {
  return `${numeracion.nombre} (${numeracion.prefijo.replace(/^[A-Za-z]+/, "")})`;
}

export interface PanelFacturaProps {
  terminal: { id: string; nombre: string };
  turno: { id: string; numero: number } | null;
  empresa: Empresa | null;
  plantillaTicket: PlantillaTicket;
  numeraciones: Numeracion[];
  listas: { id: string; nombre: string }[];
  vendedores: { id: string; nombre: string }[];
  contactos: ContactoResumen[];
  impuestos: Impuesto[];
  puedeEscribir: boolean;
  onCobrar: () => void;
  onVentaSimple: () => void;
  onCargarCotizacion: () => void;
  onGuardarCotizacion: () => void;
  onCancelarVenta: () => void;
  onAnunciar: (mensaje: string) => void;
  /**
   * La impresión vive en `vender-pos`: este panel se desmonta cuando la
   * ventana pasa a móvil (y al imprimir el medio «print» usa el ancho del
   * papel), así que el portal no puede vivir dentro del panel.
   */
  onImprimir: (doc: { titulo: string; payload: TicketPOSPayload }) => void;
  guardandoCotizacion: boolean;
  errorCotizacion: string | null;
  sinCaja?: boolean;
  idPanel?: string;
}

export function PanelFactura({
  terminal,
  turno,
  empresa,
  plantillaTicket,
  numeraciones,
  listas,
  vendedores,
  contactos,
  impuestos,
  puedeEscribir,
  onCobrar,
  onVentaSimple,
  onCargarCotizacion,
  onGuardarCotizacion,
  onCancelarVenta,
  onAnunciar,
  onImprimir,
  guardandoCotizacion,
  errorCotizacion,
  sinCaja = false,
  idPanel = "panel-factura-pos",
}: PanelFacturaProps) {
  const carrito = useCarritoPOS();
  const { activa, totales } = carrito;
  const [expandida, setExpandida] = useState<string | null>(null);
  const [cancelar, setCancelar] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState<"prefactura" | "cotizacion" | null>(null);

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
  const cobroBloqueado = activa.lineas.length === 0 || avisoTurno || !numeracionValida || !puedeEscribir || sinCaja;

  // Líneas del carrito como LineaVenta: mismo armado que la factura/cotización.
  const lineasVenta: LineaVenta[] = activa.lineas.map((linea: LineaCarrito) => {
    const t = totalesDeLinea(linea);
    return {
      id: linea.id,
      producto_id: linea.productoId,
      producto_nombre: null,
      referencia: linea.referencia,
      descripcion: linea.descripcion,
      cantidad: linea.cantidad,
      unidad_id: linea.unidadId,
      unidad_nombre: linea.unidadNombre,
      factor_base: linea.factorBase,
      precio: linea.precio,
      descuento_pct: linea.descuentoPct,
      itbis_tasa: linea.itbisTasa,
      impuesto_id: linea.impuestoId,
      subtotal: t.subtotal,
      itbis: t.itbis,
      total: t.total,
    };
  });

  const contactoActual = contactos.find((contacto) => contacto.id === activa.contactoId) ?? null;
  const vendedorActual = vendedores.find((vendedor) => vendedor.id === activa.vendedorId) ?? null;

  const entradaPresentacion = {
    empresa,
    contacto: contactoActual
      ? {
          nombre: contactoActual.nombre,
          rnc_cedula: contactoActual.rnc_cedula,
          direccion: contactoActual.direccion ?? null,
        }
      : null,
    lineas: lineasVenta,
    totales: { ...totales, otros_impuestos: "0", propina: "0" },
    vendedor: vendedorActual,
  };

  const payloadPrevia: TicketPOSPayload | null =
    vistaPrevia === "prefactura"
      ? armarTicketPrefactura({ ...entradaPresentacion, fecha: hoyRD() }, plantillaTicket)
      : vistaPrevia === "cotizacion" && cotizacion
        ? armarTicketCotizacionDocumento(
            {
              ...entradaPresentacion,
              numero: cotizacion.numero,
              fecha: cotizacion.fecha ?? hoyRD(),
              vencimiento: cotizacion.vencimiento,
            },
            plantillaTicket,
          )
        : null;

  const tituloPrevia =
    vistaPrevia === "prefactura" ? "prefactura" : cotizacion ? `cotizacion-${cotizacion.numero}` : "cotizacion";

  return (
    <aside
      id={idPanel}
      role="tabpanel"
      aria-labelledby={`pestana-${activa.id}`}
      className="border-l border-l-slate-300 text-pos-texto bg-pos-panel flex h-full min-h-0 w-full flex-col [font-family:var(--font-inter)] dark:border-l-pos-linea dark:bg-card"
    >
      <div className="border-pos-linea flex h-[60px] shrink-0 items-center justify-between border-b bg-white pl-5 pr-1 dark:bg-card">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold whitespace-nowrap text-[#334155] dark:text-pos-texto">Factura de venta</h2>
          <span className="flex size-7 items-center justify-center rounded-full bg-[#e2e8f0] dark:bg-white/10">
            <Zap className="text-[#64748b] size-4" aria-hidden="true" />
          </span>
        </div>
        <div className="flex items-center text-[#b3b3b3] dark:text-pos-icono">
          <Button
            variant="ghost"
            size="icon"
            className="hover:text-pos-texto size-10"
            title="Venta rápida"
            aria-label="Venta rápida"
            onClick={onVentaSimple}
            disabled={cotizacion !== null || !puedeEscribir}
          >
            <Percent className="size-5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hover:text-pos-texto size-10"
            title="Imprimir vista previa"
            aria-label="Imprimir vista previa"
            onClick={() => setVistaPrevia("prefactura")}
            disabled={activa.lineas.length === 0}
          >
            <Printer className="size-5" aria-hidden="true" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:text-pos-texto size-10"
                  title="Opciones de la venta"
                  aria-label="Opciones de la venta"
                />
              }
            >
              <SlidersHorizontal className="size-5" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                disabled={activa.lineas.length === 0 || cotizacion !== null || !puedeEscribir || guardandoCotizacion}
                onClick={onGuardarCotizacion}
              >
                {guardandoCotizacion ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <FileText aria-hidden="true" />
                )}
                Guardar cotización
              </DropdownMenuItem>
              <DropdownMenuItem disabled={cotizacion !== null || !puedeEscribir} onClick={onCargarCotizacion}>
                <FolderOpen aria-hidden="true" />
                Cargar cotización
              </DropdownMenuItem>
              <DropdownMenuItem disabled={cotizacion !== null || !puedeEscribir} onClick={onVentaSimple}>
                <Zap aria-hidden="true" />
                <span className="flex-1">Venta simple</span>
                <kbd className="text-muted-foreground text-[10px]">F4</kbd>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={cotizacion === null} onClick={() => setVistaPrevia("cotizacion")}>
                <Printer aria-hidden="true" />
                Imprimir cotización
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="border-pos-linea flex shrink-0 flex-col gap-[10px] border-b bg-white px-4 py-3 dark:bg-card">
        <div className="grid grid-cols-2 gap-[10px]">
          <div className="flex flex-col gap-1">
            <Label htmlFor="lista-precio-pos" className="text-pos-texto text-sm font-normal">
              Lista de precio
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
              <SelectTrigger
                id="lista-precio-pos"
                className="h-10 w-full border-slate-300 shadow-none data-[size=default]:h-10 dark:border-input"
              >
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
            <Label htmlFor="numeracion-pos" className="text-pos-texto text-sm font-normal">
              Numeración
            </Label>
            <Select
              items={numeraciones.map((numeracion) => ({
                value: numeracion.id,
                label: etiquetaNumeracion(numeracion),
              }))}
              value={numeracionValida ? activa.numeracionId : null}
              onValueChange={(valor) => carrito.setNumeracion(valor ?? "")}
            >
              <SelectTrigger
                id="numeracion-pos"
                className="h-10 w-full border-slate-300 shadow-none data-[size=default]:h-10 dark:border-input"
                aria-invalid={!numeracionValida}
              >
                <SelectValue placeholder="Sin numeración" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {numeraciones.map((numeracion) => (
                  <SelectItem key={numeracion.id} value={numeracion.id}>
                    {etiquetaNumeracion(numeracion)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="cliente-pos" className="text-pos-texto w-12 shrink-0 text-sm font-normal">
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
            className="min-w-0 flex-1"
          />
          <Button
            variant="ghost"
            className="bg-pos-acento text-pos-acento-texto hover:bg-pos-acento/70 hover:text-pos-acento-texto h-10 shrink-0 gap-1 px-3 font-medium"
            disabled={cotizacion !== null || !puedeEscribir}
            onClick={() => setNuevoCliente(true)}
          >
            <UserPlus aria-hidden="true" />
            Nuevo
          </Button>
        </div>

        {vendedores.length > 0 ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="vendedor-pos" className="text-pos-texto text-sm font-normal">
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
              <SelectTrigger
                id="vendedor-pos"
                className="h-10 w-full border-slate-300 shadow-none data-[size=default]:h-10 dark:border-input"
              >
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
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <Basket className="text-pos-icono size-10" weight="light" aria-hidden="true" />
            <p className="text-pos-texto-suave text-sm">Aquí verás los productos que elijas en tu próxima venta</p>
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
          <p className="text-muted-foreground px-4 py-2 text-xs">
            Esta venta tiene más de 100 líneas. Considera dividirla en dos ventas.
          </p>
        ) : null}
      </div>

      <div className="border-pos-linea flex shrink-0 flex-col gap-2 border-t bg-white px-5 pt-3 pb-1 dark:bg-card">
        {sinCaja ? (
          <Alert variant="destructive">
            <AlertDescription>
              {`La terminal ${terminal.nombre} no tiene una cuenta de efectivo activa.`}
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

        <div className="flex items-stretch gap-[10px]">
          <Button
            className="bg-pos-primario hover:bg-pos-primario-hover h-[43px] flex-1 justify-between rounded-[5px] px-4 text-lg font-normal text-white disabled:bg-[#c2c9d6] dark:disabled:bg-white/10"
            disabled={cobroBloqueado}
            onClick={onCobrar}
          >
            <span>Vender</span>
            <span className="tabular-nums">{formatoMonedaPOS(totales.total)}</span>
          </Button>
          <Button
            className="bg-pos-oscuro hover:bg-pos-oscuro/85 relative h-[45px] w-11 shrink-0 rounded-[10px] text-white"
            title="Historial de ventas"
            aria-label="Historial de ventas"
            render={<a href="/pos/historial" />}
          >
            <Receipt className="size-6" aria-hidden="true" />
            <span className="absolute -top-1.5 -right-1.5 size-[17px] rounded-full bg-slate-300 ring-2 ring-white dark:ring-card" />
          </Button>
        </div>

        <div className="border-pos-linea flex h-[43px] items-center justify-between rounded-[10px] border px-4">
          <span className="text-sm font-normal">
            {Number(articulos) === 1 ? "1 Producto" : `${formatoCantidad(articulos)} Productos`}
          </span>
          <button
            type="button"
            className="text-pos-primario hover:text-pos-primario-hover text-sm font-normal"
            onClick={() => setCancelar(true)}
          >
            Cancelar
          </button>
        </div>
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

      <Dialog open={vistaPrevia !== null} onOpenChange={(nuevo) => (nuevo ? null : setVistaPrevia(null))}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>{vistaPrevia === "cotizacion" ? "Cotización" : "Vista previa"}</DialogTitle>
            <DialogDescription>
              {vistaPrevia === "cotizacion"
                ? "Ticket de 80 mm de la cotización cargada. Sin valor fiscal."
                : "Ticket de 80 mm con lo que hay en el carrito. No cobra ni crea la factura."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60dvh] overflow-y-auto">
            {payloadPrevia ? <TicketPos payload={payloadPrevia} vistaPrevia /> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVistaPrevia(null)}>
              Cerrar
            </Button>
            <Button
              disabled={!payloadPrevia}
              onClick={() => {
                if (!payloadPrevia) return;
                onImprimir({ titulo: tituloPrevia, payload: payloadPrevia });
                setVistaPrevia(null);
              }}
            >
              <Printer aria-hidden="true" />
              Imprimir / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogoNuevoContacto
        abierto={nuevoCliente}
        onOpenChange={setNuevoCliente}
        tipoInicial="cliente"
        onCreado={(contacto) => {
          carrito.setContacto(contacto.id);
          setNuevoCliente(false);
          onAnunciar(`Cliente ${contacto.nombre} creado y seleccionado.`);
        }}
      />
    </aside>
  );
}
