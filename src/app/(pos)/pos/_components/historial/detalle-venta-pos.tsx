"use client";

import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { FileText, Loader2, Printer, RotateCcw } from "lucide-react";

import { CartaFacturaPOS } from "@/components/pos/documento-carta-pos";
import { ImpresionPos } from "@/components/pos/impresion-pos";
import { TicketPos } from "@/components/pos/ticket-pos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import type { Empresa } from "@/lib/facturacion/tipos";
import { formatoDia, formatoFechaHora } from "@/lib/formato";
import { armarCartaFactura, armarTicketFactura } from "@/lib/pos/impresion";
import type { PlantillaTicket, VentaPOSResultado } from "@/lib/pos/tipos";

import { detalleVentaPOS, ticketVentaPOS } from "../acciones-pos";
import { capitalizar, etiquetaMetodoDB } from "../formato-pos";
import type { DetalleVentaPOS } from "../tipos";

export function DetalleVentaPos({
  facturaId,
  onCerrar,
  empresa,
  plantillaTicket,
  plantillaFactura,
  puedeEscribir,
}: {
  facturaId: string | null;
  onCerrar: () => void;
  empresa: Empresa | null;
  plantillaTicket: PlantillaTicket;
  plantillaFactura: { mostrarLogo: boolean; notas: string; terminos: string };
  puedeEscribir: boolean;
}) {
  const router = useRouter();
  const [detalle, setDetalle] = useState<DetalleVentaPOS | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imprimiendo, setImprimiendo] = useState<"ticket" | "carta" | null>(null);
  const [trabajo, setTrabajo] = useState<
    { tipo: "ticket"; datos: VentaPOSResultado } | { tipo: "carta"; datos: VentaPOSResultado } | null
  >(null);

  const cargar = useCallback(async (id: string) => {
    setCargando(true);
    setError(null);
    try {
      const resultado = await detalleVentaPOS(id);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setDetalle(resultado.data);
      if (!resultado.data) setError("No se pudo cargar la venta.");
    } catch {
      setError("No se pudo cargar la venta. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!facturaId) {
      setDetalle(null);
      setError(null);
      return;
    }
    void cargar(facturaId);
  }, [facturaId, cargar]);

  async function imprimir(tipo: "ticket" | "carta") {
    if (!facturaId) return;
    setImprimiendo(tipo);
    try {
      const resultado = await ticketVentaPOS(facturaId);
      if (!resultado.ok || !resultado.data) {
        setError(resultado.ok ? "No se pudo cargar la venta." : capitalizar(resultado.error));
        return;
      }
      setTrabajo({ tipo, datos: resultado.data });
    } finally {
      setImprimiendo(null);
    }
  }

  const mostrarLogo = plantillaFactura.mostrarLogo && Boolean(empresa?.logo_url);
  const puedeCarta = Boolean(empresa?.nombre?.trim());

  return (
    <>
      <Sheet open={facturaId !== null} onOpenChange={(abierto) => (abierto ? null : onCerrar())}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[560px]">
          <SheetHeader className="border-border border-b px-4 py-3">
            <SheetTitle>
              {detalle ? (detalle.factura.ncf ?? `Factura No ${detalle.factura.numero}`) : "Detalle de la venta"}
            </SheetTitle>
            <SheetDescription>
              {detalle ? `Factura No ${detalle.factura.numero} · ${formatoFechaHora(detalle.factura.creado_en)}` : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {cargando ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-destructive text-sm">{error}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => facturaId && void cargar(facturaId)}>
                    Reintentar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onCerrar}>
                    Cerrar
                  </Button>
                </div>
              </div>
            ) : detalle ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={detalle.factura.estado === "anulada" ? "destructive" : "secondary"}>
                    {detalle.factura.estado === "pagada"
                      ? "Cobrada"
                      : detalle.factura.estado === "anulada"
                        ? "Anulada"
                        : "Por cobrar"}
                  </Badge>
                  <span className="text-muted-foreground text-xs">{`Terminal ${detalle.terminal_nombre ?? "—"}`}</span>
                  <span className="text-muted-foreground text-xs">
                    {detalle.turno ? `Turno No ${detalle.turno.numero}` : "Sin turno"}
                  </span>
                  <span className="text-muted-foreground text-xs">{`Cajero ${detalle.cajero ?? "—"}`}</span>
                </div>

                <section className="flex flex-col gap-1 text-sm">
                  <p className="font-medium">{detalle.contacto.nombre}</p>
                  {detalle.contacto.rnc_cedula ? (
                    <p className="text-muted-foreground">RNC: {detalle.contacto.rnc_cedula}</p>
                  ) : null}
                  {detalle.contacto.telefono ? (
                    <p className="text-muted-foreground">Tel.: {detalle.contacto.telefono}</p>
                  ) : null}
                  <a
                    className="text-primary text-xs hover:underline"
                    href={`/dashboard/contactos/${detalle.contacto.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver ficha
                  </a>
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold">Productos y servicios</h3>
                  <div className="border-border overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                          <TableHead className="text-right">Precio</TableHead>
                          <TableHead className="text-right">Desc.</TableHead>
                          <TableHead className="text-right">ITBIS</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detalle.lineas.map((linea) => (
                          <TableRow key={linea.id}>
                            <TableCell className="text-sm">{linea.descripcion}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatoCantidad(linea.cantidad)}
                              {linea.unidad_nombre ? ` ${linea.unidad_nombre}` : ""}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatoMoneda(linea.precio)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {Number(linea.descuento_pct) > 0 ? `${formatoCantidad(linea.descuento_pct)}%` : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatoMoneda(linea.itbis)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatoMoneda(linea.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>

                <section className="flex flex-col gap-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{formatoMoneda(detalle.factura.subtotal)}</span>
                  </div>
                  {Number(detalle.factura.descuento) > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Descuento</span>
                      <span className="tabular-nums">−{formatoMoneda(detalle.factura.descuento)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ITBIS</span>
                    <span className="tabular-nums">{formatoMoneda(detalle.factura.itbis)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold tabular-nums">{formatoMoneda(detalle.factura.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pagado</span>
                    <span className="tabular-nums">{formatoMoneda(detalle.factura.pagado)}</span>
                  </div>
                  {Number(detalle.factura.credito) > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Crédito</span>
                      <span className="tabular-nums">{formatoMoneda(detalle.factura.credito)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Saldo</span>
                    <span className="tabular-nums">{formatoMoneda(detalle.factura.saldo)}</span>
                  </div>
                  {detalle.factura.monto_recibido ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recibido</span>
                      <span className="tabular-nums">{formatoMoneda(detalle.factura.monto_recibido)}</span>
                    </div>
                  ) : null}
                  {detalle.factura.cambio && Number(detalle.factura.cambio) > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cambio</span>
                      <span className="tabular-nums">{formatoMoneda(detalle.factura.cambio)}</span>
                    </div>
                  ) : null}
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold">Pagos</h3>
                  {detalle.pagos.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Sin pagos registrados.</p>
                  ) : (
                    <div className="border-border overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead>Cuenta</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detalle.pagos.map((pago) => (
                            <TableRow key={pago.id}>
                              <TableCell className="text-xs">{formatoDia(pago.fecha)}</TableCell>
                              <TableCell>{etiquetaMetodoDB(pago.metodo)}</TableCell>
                              <TableCell className="text-xs">{pago.cuenta_nombre ?? "—"}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatoMoneda(pago.monto)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold">Notas de crédito</h3>
                  {detalle.notas_credito.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Sin notas de crédito.</p>
                  ) : (
                    <div className="border-border overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>NCF</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead>Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detalle.notas_credito.map((nota) => (
                            <TableRow key={nota.id}>
                              <TableCell className="text-xs">{nota.ncf}</TableCell>
                              <TableCell className="text-xs">{formatoDia(nota.fecha)}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatoMoneda(nota.total)}</TableCell>
                              <TableCell className="text-xs">{nota.estado}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </section>

                <p className="text-muted-foreground text-xs">
                  Este ticket se genera con los datos actuales de la factura.
                </p>
              </div>
            ) : null}
          </div>

          {detalle ? (
            <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="h-10 gap-1.5"
                  disabled={imprimiendo !== null}
                  onClick={() => void imprimir("ticket")}
                >
                  {imprimiendo === "ticket" ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Printer aria-hidden="true" />
                  )}
                  Imprimir ticket
                </Button>
                <Button
                  variant="ghost"
                  className="h-10 gap-1.5"
                  disabled={imprimiendo !== null || !puedeCarta}
                  title={puedeCarta ? undefined : "Falta el nombre de la empresa en Configuración."}
                  onClick={() => void imprimir("carta")}
                >
                  {imprimiendo === "carta" ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <FileText aria-hidden="true" />
                  )}
                  PDF Carta
                </Button>
                {detalle.factura.estado !== "anulada" && puedeEscribir ? (
                  <Button
                    variant="ghost"
                    className="h-10 gap-1.5"
                    onClick={() => {
                      onCerrar();
                      router.push(`/pos/devoluciones?factura=${detalle.factura.id}`);
                    }}
                  >
                    <RotateCcw aria-hidden="true" />
                    Nueva devolución
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  className="h-10"
                  render={<a href={`/dashboard/facturacion/${detalle.factura.id}`} target="_blank" rel="noreferrer" />}
                >
                  Ver en Contabilidad
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {trabajo ? (
        <ImpresionPos
          titulo={`factura-${trabajo.datos.factura.ncf ?? trabajo.datos.factura.numero}`}
          ancho={trabajo.tipo === "ticket" ? plantillaTicket.ancho_mm : undefined}
          onCerrar={() => setTrabajo(null)}
        >
          {trabajo.tipo === "ticket" ? (
            <TicketPos payload={armarTicketFactura(trabajo.datos, plantillaTicket)} />
          ) : (
            <CartaFacturaPOS
              datos={armarCartaFactura(trabajo.datos, {
                mostrarLogo,
                notas: plantillaFactura.notas,
                terminos: plantillaFactura.terminos,
              })}
            />
          )}
        </ImpresionPos>
      ) : null}
    </>
  );
}
