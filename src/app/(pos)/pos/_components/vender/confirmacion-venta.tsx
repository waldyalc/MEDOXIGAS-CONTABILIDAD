"use client";

import { useState } from "react";

import { CircleCheck, FileText, Printer } from "@/components/icons";
import { CartaCotizacionPOS, CartaFacturaPOS } from "@/components/pos/documento-carta-pos";
import { ImpresionPos } from "@/components/pos/impresion-pos";
import { TicketPos } from "@/components/pos/ticket-pos";
import { Button } from "@/components/ui/button";
import { formatoMoneda } from "@/lib/facturacion/formato";
import type { Empresa } from "@/lib/facturacion/tipos";
import {
  armarCartaCotizacion,
  armarCartaFactura,
  armarTicketCotizacion,
  armarTicketFactura,
} from "@/lib/pos/impresion";
import type { CotizacionPOSResultado, PlantillaTicket, VentaPOSResultado } from "@/lib/pos/tipos";

type Trabajo =
  | { tipo: "ticket"; titulo: string; venta: VentaPOSResultado }
  | { tipo: "carta"; titulo: string; venta: VentaPOSResultado }
  | { tipo: "ticket-cotizacion"; titulo: string; cotizacion: CotizacionPOSResultado }
  | { tipo: "carta-cotizacion"; titulo: string; cotizacion: CotizacionPOSResultado };

export function ConfirmacionVenta({
  venta,
  cotizacion,
  empresa,
  plantillaTicket,
  plantillaFactura,
  plantillaCotizacion,
  onNuevaVenta,
  onVerHistorial,
  onCerrar,
}: {
  venta?: VentaPOSResultado | null;
  cotizacion?: CotizacionPOSResultado | null;
  empresa: Empresa | null;
  plantillaTicket: PlantillaTicket;
  plantillaFactura: { mostrarLogo: boolean; notas: string; terminos: string };
  plantillaCotizacion: { mostrarLogo: boolean; notas: string; terminos: string };
  onNuevaVenta: () => void;
  onVerHistorial: (ncf: string | null) => void;
  onCerrar: () => void;
}) {
  const [trabajo, setTrabajo] = useState<Trabajo | null>(null);
  const puedeCarta = Boolean(empresa?.nombre?.trim());

  if (!venta && !cotizacion) return null;

  const total = venta?.totales.total ?? cotizacion?.totales.total ?? "0";
  const cliente = venta?.contacto.nombre ?? cotizacion?.contacto.nombre ?? "";

  function imprimirTicket() {
    if (venta) {
      setTrabajo({
        tipo: "ticket",
        titulo: `factura-${venta.factura.ncf ?? venta.factura.numero}`,
        venta,
      });
      return;
    }
    if (cotizacion) {
      setTrabajo({
        tipo: "ticket-cotizacion",
        titulo: `cotizacion-${cotizacion.cotizacion.numero}`,
        cotizacion,
      });
    }
  }

  function imprimirCarta() {
    if (!puedeCarta) return;
    if (venta) {
      setTrabajo({
        tipo: "carta",
        titulo: `factura-${venta.factura.ncf ?? venta.factura.numero}`,
        venta,
      });
      return;
    }
    if (cotizacion) {
      setTrabajo({
        tipo: "carta-cotizacion",
        titulo: `cotizacion-${cotizacion.cotizacion.numero}`,
        cotizacion,
      });
    }
  }

  const mostrarLogoFactura = plantillaFactura.mostrarLogo && Boolean(empresa?.logo_url);
  const mostrarLogoCotizacion = plantillaCotizacion.mostrarLogo && Boolean(empresa?.logo_url);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-full">
        <CircleCheck className="size-7" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{venta ? "Venta registrada" : "Cotización guardada"}</h2>
        {venta ? (
          <p className="text-sm">
            <span className="font-medium">{venta.factura.ncf ?? `Factura No ${venta.factura.numero}`}</span>
            {venta.factura.ncf ? ` · Factura No ${venta.factura.numero}` : ""}
          </p>
        ) : cotizacion ? (
          <p className="text-sm font-medium">{`Cotización No ${cotizacion.cotizacion.numero}`}</p>
        ) : null}
        <p className="text-muted-foreground text-sm">{cliente}</p>
      </div>

      <div className="border-border w-full max-w-sm rounded-lg border px-4 py-3 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="text-lg font-semibold tabular-nums">{formatoMoneda(total)}</span>
        </div>
        {venta?.factura.monto_recibido && Number(venta.factura.monto_recibido) > 0 ? (
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">Recibido</span>
            <span className="tabular-nums">{formatoMoneda(venta.factura.monto_recibido)}</span>
          </div>
        ) : null}
        {venta?.factura.cambio && Number(venta.factura.cambio) > 0 ? (
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">Cambio</span>
            <span className="tabular-nums">{formatoMoneda(venta.factura.cambio)}</span>
          </div>
        ) : null}
        {venta && Number(venta.factura.credito) > 0 ? (
          <div className="mt-1 flex items-baseline justify-between border-t pt-1">
            <span className="font-medium">Queda a crédito</span>
            <span className="font-semibold tabular-nums">{formatoMoneda(venta.factura.credito)}</span>
          </div>
        ) : null}
      </div>

      <div className="flex w-full flex-wrap items-center justify-center gap-2">
        <Button className="h-12" onClick={onNuevaVenta}>
          Nueva venta
        </Button>
        <Button variant="outline" className="h-12 gap-1.5" onClick={imprimirTicket}>
          <Printer aria-hidden="true" />
          Imprimir ticket
        </Button>
        {puedeCarta ? (
          <Button variant="ghost" className="h-12 gap-1.5" onClick={imprimirCarta}>
            <FileText aria-hidden="true" />
            PDF Carta
          </Button>
        ) : (
          <span title="Falta el nombre de la empresa en Configuración.">
            <Button variant="ghost" className="h-12 gap-1.5" disabled>
              <FileText aria-hidden="true" />
              PDF Carta
            </Button>
          </span>
        )}
        {venta ? (
          <Button variant="ghost" className="h-12" onClick={() => onVerHistorial(venta.factura.ncf)}>
            Ver en el historial
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="h-12"
            render={<a href="/dashboard/cotizaciones" target="_blank" rel="noreferrer" />}
          >
            Ver en Contabilidad
          </Button>
        )}
        <Button variant="link" className="h-12 px-2" onClick={onCerrar}>
          Cerrar
        </Button>
      </div>

      {trabajo ? (
        <ImpresionPos
          titulo={trabajo.titulo}
          ancho={
            trabajo.tipo === "ticket" || trabajo.tipo === "ticket-cotizacion" ? plantillaTicket.ancho_mm : undefined
          }
          onCerrar={() => setTrabajo(null)}
        >
          {trabajo.tipo === "ticket" ? (
            <TicketPos payload={armarTicketFactura(trabajo.venta, plantillaTicket)} />
          ) : null}
          {trabajo.tipo === "ticket-cotizacion" ? (
            <TicketPos payload={armarTicketCotizacion(trabajo.cotizacion, plantillaTicket)} />
          ) : null}
          {trabajo.tipo === "carta" ? (
            <CartaFacturaPOS
              datos={armarCartaFactura(trabajo.venta, {
                mostrarLogo: mostrarLogoFactura,
                notas: plantillaFactura.notas,
                terminos: plantillaFactura.terminos,
              })}
            />
          ) : null}
          {trabajo.tipo === "carta-cotizacion" ? (
            <CartaCotizacionPOS
              datos={armarCartaCotizacion(trabajo.cotizacion, {
                mostrarLogo: mostrarLogoCotizacion,
                notas: plantillaCotizacion.notas,
                terminos: plantillaCotizacion.terminos,
              })}
            />
          ) : null}
        </ImpresionPos>
      ) : null}
    </div>
  );
}
