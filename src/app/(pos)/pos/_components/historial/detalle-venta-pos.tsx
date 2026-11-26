"use client";

import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { FileText, Loader2, Printer, ReceiptText, RotateCcw } from "@/components/icons";
import { PillEstado } from "@/components/listas/tabla-lista";
import { CartaFacturaPOS } from "@/components/pos/documento-carta-pos";
import { ImpresionPos } from "@/components/pos/impresion-pos";
import { TicketPos } from "@/components/pos/ticket-pos";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import type { Empresa } from "@/lib/facturacion/tipos";
import { formatoDia, formatoFechaHora } from "@/lib/formato";
import { guardarDetalleVentaOffline, leerDetalleVentaOffline } from "@/lib/pos/cache-vistas-offline";
import { armarCartaFactura, armarTicketFactura } from "@/lib/pos/impresion";
import type { PlantillaTicket, VentaPOSResultado } from "@/lib/pos/tipos";

import { detalleVentaPOS, ticketVentaPOS } from "../acciones-pos";
import { capitalizar, etiquetaMetodoDB } from "../formato-pos";
import { useOfflinePOS } from "../offline-pos-provider";
import type { DetalleVentaPOS } from "../tipos";

const MENSAJE_VENTA_NO_GUARDADA = "Esta venta no está guardada en este dispositivo. Conéctate a internet para verla.";
const MENSAJE_TICKET_NO_GUARDADO =
  "Esta venta no está guardada en este dispositivo. Conéctate a internet para imprimirla.";

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
  const offline = useOfflinePOS();
  const [detalle, setDetalle] = useState<DetalleVentaPOS | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imprimiendo, setImprimiendo] = useState<"ticket" | "carta" | null>(null);
  const [trabajo, setTrabajo] = useState<
    { tipo: "ticket"; datos: VentaPOSResultado } | { tipo: "carta"; datos: VentaPOSResultado } | null
  >(null);

  const cargar = useCallback(
    async (id: string) => {
      setCargando(true);
      setError(null);
      const sinRed = offline.estado === "offline" || !navigator.onLine;
      try {
        if (!sinRed) {
          try {
            const resultado = await detalleVentaPOS(id);
            if (resultado.ok && resultado.data) {
              setDetalle(resultado.data);
              // Conserva el ticket ya guardado para reimprimir sin conexión.
              const cache = await leerDetalleVentaOffline(offline.ambito, id).catch(() => undefined);
              if (cache) {
                await guardarDetalleVentaOffline(offline.ambito, id, {
                  detalle: resultado.data,
                  ticket: cache.ticket,
                }).catch(() => undefined);
              }
              return;
            }
            const cache = await leerDetalleVentaOffline(offline.ambito, id).catch(() => undefined);
            if (cache) {
              setDetalle(cache.detalle);
              return;
            }
            setError(resultado.ok ? "No se pudo cargar la venta." : capitalizar(resultado.error));
            return;
          } catch {
            // Red caída a mitad: se intenta el respaldo local antes de fallar.
          }
        }

        const cache = await leerDetalleVentaOffline(offline.ambito, id).catch(() => undefined);
        if (cache) {
          setDetalle(cache.detalle);
          return;
        }
        setError(
          sinRed ? MENSAJE_VENTA_NO_GUARDADA : "No se pudo cargar la venta. Revisa tu conexión e inténtalo de nuevo.",
        );
      } finally {
        setCargando(false);
      }
    },
    [offline.ambito, offline.estado],
  );

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
      let mensaje: string | null = null;
      if (offline.estado !== "offline" && navigator.onLine) {
        try {
          const resultado = await ticketVentaPOS(facturaId);
          if (resultado.ok && resultado.data) {
            setTrabajo({ tipo, datos: resultado.data });
            // Guarda el ticket junto al detalle ya cargado (o al cacheado).
            const detalleParaCache =
              detalle ?? (await leerDetalleVentaOffline(offline.ambito, facturaId).catch(() => undefined))?.detalle;
            if (detalleParaCache) {
              await guardarDetalleVentaOffline(offline.ambito, facturaId, {
                detalle: detalleParaCache,
                ticket: resultado.data,
              }).catch(() => undefined);
            }
            return;
          }
          mensaje = resultado.ok ? "No se pudo cargar la venta." : capitalizar(resultado.error);
        } catch {
          mensaje = "No se pudo conectar con el servidor.";
        }
      }

      const cache = await leerDetalleVentaOffline(offline.ambito, facturaId).catch(() => undefined);
      if (cache) {
        setTrabajo({ tipo, datos: cache.ticket });
        return;
      }
      setError(mensaje ?? MENSAJE_TICKET_NO_GUARDADO);
    } finally {
      setImprimiendo(null);
    }
  }

  const mostrarLogo = plantillaFactura.mostrarLogo && Boolean(empresa?.logo_url);
  const puedeCarta = Boolean(empresa?.nombre?.trim());

  return (
    <>
      <div className="flex min-h-full flex-col">
        {!facturaId ? (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
            <ReceiptText className="text-muted-foreground size-8" aria-hidden="true" />
            <p className="text-lg font-semibold">Selecciona una venta</p>
            <p className="text-muted-foreground max-w-sm text-sm">
              Elige una factura de la lista para ver sus productos, pagos y acciones.
            </p>
          </div>
        ) : cargando ? (
          <div className="flex flex-col gap-2 p-4 md:p-6">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-start gap-2 p-4 md:p-6">
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
          <div className="flex flex-col gap-5 p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">
                    {detalle.factura.ncf ?? `Factura No ${detalle.factura.numero}`}
                  </h2>
                  <PillEstado
                    tono={
                      detalle.factura.estado === "pagada"
                        ? "exito"
                        : detalle.factura.estado === "anulada"
                          ? "peligro"
                          : "pendiente"
                    }
                  >
                    {detalle.factura.estado === "pagada"
                      ? "Cobrada"
                      : detalle.factura.estado === "anulada"
                        ? "Anulada"
                        : "Por cobrar"}
                  </PillEstado>
                </div>
                <p className="text-muted-foreground text-xs">
                  {`Factura No ${detalle.factura.numero} · ${formatoFechaHora(detalle.factura.creado_en)} · Terminal ${detalle.terminal_nombre ?? "—"} · `}
                  {detalle.turno ? `Turno No ${detalle.turno.numero}` : "Sin turno"}
                  {` · Cajero ${detalle.cajero ?? "—"}`}
                </p>
              </div>

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

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="flex min-w-0 flex-col gap-5">
                <section className="flex flex-col gap-1 text-sm">
                  <p className="font-medium">{detalle.contacto.nombre}</p>
                  {detalle.contacto.rnc_cedula ? (
                    <p className="text-muted-foreground">RNC: {detalle.contacto.rnc_cedula}</p>
                  ) : null}
                  {detalle.contacto.telefono ? (
                    <p className="text-muted-foreground">Tel.: {detalle.contacto.telefono}</p>
                  ) : null}
                  <a
                    className="text-pos-primario text-xs hover:underline"
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
              </div>

              <aside className="h-fit">
                <div className="bg-muted/50 flex flex-col gap-1 rounded-xl px-4 py-3 text-sm">
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
                  <div className="border-border mt-1 flex items-baseline justify-between border-t pt-1">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-semibold tabular-nums">{formatoMoneda(detalle.factura.total)}</span>
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
                    <span
                      className={
                        Number(detalle.factura.saldo) > 0 && detalle.factura.estado !== "anulada"
                          ? "text-destructive tabular-nums"
                          : "tabular-nums"
                      }
                    >
                      {formatoMoneda(detalle.factura.saldo)}
                    </span>
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
                </div>
              </aside>
            </div>

            <p className="text-muted-foreground text-xs">Este ticket se genera con los datos actuales de la factura.</p>
          </div>
        ) : null}
      </div>

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
