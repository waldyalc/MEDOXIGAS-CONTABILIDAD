"use client";

import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { RotateCcw } from "@/components/icons";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { ContenedorLista } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { ImpresionPos } from "@/components/pos/impresion-pos";
import { TicketPos } from "@/components/pos/ticket-pos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { leerTamano, type ParametrosLista, type ResumenPagina } from "@/lib/listas/parametros";
import { armarTicketDevolucion } from "@/lib/pos/impresion";
import type { DevolucionPOSResultado, PlantillaTicket } from "@/lib/pos/tipos";

import { detalleDevolucionPOS, ticketDevolucionPOS } from "../acciones-pos";
import { capitalizar } from "../formato-pos";
import type { DevolucionPOSDetalle, DevolucionPOSFila } from "../tipos";
import { FiltrosDevoluciones } from "./filtros-devoluciones";
import { TablaDevoluciones } from "./tabla-devoluciones";
import { WizardDevolucion } from "./wizard-devolucion";

export function DevolucionesPos({
  filas,
  resumen,
  params,
  desde,
  hasta,
  terminal,
  cuentaEfectivoNombre,
  sinCaja,
  turno,
  efectivoEsperado,
  facturaInicial,
  plantilla,
  puedeEscribir,
  hayFiltros,
  error,
}: {
  filas: DevolucionPOSFila[];
  resumen: ResumenPagina;
  params: ParametrosLista;
  desde: string;
  hasta: string;
  terminal: { id: string; nombre: string; cuenta_efectivo_id: string };
  cuentaEfectivoNombre: string;
  sinCaja: boolean;
  turno: { id: string; numero: number } | null;
  efectivoEsperado: string;
  facturaInicial: string | null;
  plantilla: PlantillaTicket;
  puedeEscribir: boolean;
  hayFiltros: boolean;
  error?: string | null;
}) {
  const router = useRouter();
  const [wizardAbierto, setWizardAbierto] = useState(Boolean(facturaInicial && turno && !sinCaja));
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DevolucionPOSDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [trabajo, setTrabajo] = useState<DevolucionPOSResultado | null>(null);
  const [imprimiendo, setImprimiendo] = useState<string | null>(null);

  const cargarDetalle = useCallback(async (id: string) => {
    setCargandoDetalle(true);
    setErrorDetalle(null);
    try {
      const resultado = await detalleDevolucionPOS(id);
      if (!resultado.ok) {
        setErrorDetalle(capitalizar(resultado.error));
        return;
      }
      setDetalle(resultado.data);
      if (!resultado.data) setErrorDetalle("No se pudo cargar la devolución.");
    } catch {
      setErrorDetalle("No se pudo cargar la devolución. Revisa tu conexión.");
    } finally {
      setCargandoDetalle(false);
    }
  }, []);

  useEffect(() => {
    if (!detalleId) {
      setDetalle(null);
      return;
    }
    void cargarDetalle(detalleId);
  }, [detalleId, cargarDetalle]);

  async function imprimir(fila: DevolucionPOSFila) {
    setImprimiendo(fila.id);
    try {
      const resultado = await ticketDevolucionPOS(fila.id);
      if (!resultado.ok || !resultado.data) {
        toast.add({
          type: "error",
          title: "No se pudo preparar el ticket",
          description: resultado.ok ? "No se pudo cargar la devolución." : capitalizar(resultado.error),
        });
        return;
      }
      setTrabajo(resultado.data);
    } finally {
      setImprimiendo(null);
    }
  }

  return (
    <ContenedorLista className="p-4 md:p-6">
      <EncabezadoPagina
        titulo="Devoluciones"
        subtitulo="Notas de crédito creadas desde el punto de venta."
        acciones={
          puedeEscribir ? (
            <span
              title={
                sinCaja
                  ? "La terminal no tiene una cuenta de efectivo activa."
                  : turno
                    ? undefined
                    : "Abre un turno para devolver."
              }
            >
              <Button className="h-10 gap-1.5" disabled={!turno || sinCaja} onClick={() => setWizardAbierto(true)}>
                <RotateCcw aria-hidden="true" />
                Nueva devolución
              </Button>
            </span>
          ) : null
        }
      />

      {sinCaja ? (
        <Alert variant="destructive">
          <AlertDescription>
            {`La terminal ${terminal.nombre} no tiene una cuenta de efectivo activa. Corrige la configuración en Contabilidad.`}
          </AlertDescription>
        </Alert>
      ) : null}

      {turno === null ? (
        <Alert variant="destructive">
          <AlertDescription>{`No hay un turno abierto en ${terminal.nombre}. Abre un turno para devolver.`}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {error}
            <Button variant="outline" size="sm" onClick={() => router.refresh()}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <TablaDevoluciones
          filas={filas}
          barra={<FiltrosDevoluciones params={params} desde={desde} hasta={hasta} />}
          vacio={
            hayFiltros
              ? {
                  titulo: "Sin resultados.",
                  descripcion: "No hay devoluciones que coincidan con los filtros.",
                  filtrada: true,
                }
              : {
                  titulo: "Aún no hay devoluciones del POS.",
                  descripcion: "Las notas de crédito creadas desde el punto de venta aparecerán aquí.",
                  accion:
                    turno && !sinCaja ? (
                      <Button className="h-10" onClick={() => setWizardAbierto(true)}>
                        Nueva devolución
                      </Button>
                    ) : null,
                }
          }
          onVer={(fila) => setDetalleId(fila.id)}
          onImprimir={(fila) => void imprimir(fila)}
        />
      )}

      <PaginadorLista
        base="/pos/devoluciones"
        params={params}
        resumen={resumen}
        opciones={[25, 50, 100]}
        tamano={leerTamano(params)}
      />

      {imprimiendo ? <p className="text-muted-foreground text-xs">Preparando impresión…</p> : null}

      <WizardDevolucion
        abierto={wizardAbierto}
        onCerrar={() => {
          setWizardAbierto(false);
          if (facturaInicial) router.replace("/pos/devoluciones");
        }}
        terminal={terminal}
        cuentaEfectivoNombre={cuentaEfectivoNombre}
        turno={turno}
        efectivoEsperado={efectivoEsperado}
        facturaInicial={facturaInicial}
        plantilla={plantilla}
        onCreada={() => router.refresh()}
      />

      <Sheet open={detalleId !== null} onOpenChange={(abierto) => (abierto ? null : setDetalleId(null))}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-[560px]">
          <SheetHeader className="border-border border-b px-4 py-3">
            <SheetTitle>{detalle ? detalle.nota.ncf : "Devolución"}</SheetTitle>
            <SheetDescription>
              {detalle ? `Factura origen ${detalle.factura.ncf ?? `No ${detalle.factura.numero}`}` : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 py-4">
            {cargandoDetalle ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : errorDetalle ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-destructive text-sm">{errorDetalle}</p>
                <Button variant="outline" size="sm" onClick={() => detalleId && void cargarDetalle(detalleId)}>
                  Reintentar
                </Button>
              </div>
            ) : detalle ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={detalle.nota.estado === "anulada" ? "destructive" : "secondary"}>
                    {detalle.nota.estado === "anulada" ? "Anulada" : "Activa"}
                  </Badge>
                  <span className="text-muted-foreground text-xs">{formatoDia(detalle.nota.fecha)}</span>
                  {detalle.nota.turno_numero != null ? (
                    <span className="text-muted-foreground text-xs">{`Turno No ${detalle.nota.turno_numero}`}</span>
                  ) : null}
                </div>

                <section className="flex flex-col gap-1 text-sm">
                  <p className="font-medium">{detalle.contacto?.nombre ?? "—"}</p>
                  {detalle.contacto?.rnc_cedula ? (
                    <p className="text-muted-foreground">RNC: {detalle.contacto.rnc_cedula}</p>
                  ) : null}
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold">Líneas devueltas</h3>
                  <div className="border-border overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                          <TableHead className="text-right">Precio</TableHead>
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
                    <span className="tabular-nums">{formatoMoneda(detalle.nota.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ITBIS</span>
                    <span className="tabular-nums">{formatoMoneda(detalle.nota.itbis)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatoMoneda(detalle.nota.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reembolso</span>
                    <span>
                      {detalle.nota.tipo_reembolso === "credito_factura"
                        ? "Crédito a factura"
                        : detalle.nota.tipo_reembolso === "efectivo"
                          ? "Efectivo"
                          : "Combinado"}
                    </span>
                  </div>
                  {detalle.nota.tipo_reembolso !== "credito_factura" ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Efectivo</span>
                      <span className="tabular-nums">{formatoMoneda(detalle.nota.monto_reembolso_efectivo)}</span>
                    </div>
                  ) : null}
                  {detalle.nota.notas ? <p className="text-muted-foreground text-xs">{detalle.nota.notas}</p> : null}
                </section>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="h-10 gap-1.5"
                    onClick={() => void imprimir({ ...filaDesdeDetalle(detalle) })}
                  >
                    Imprimir ticket
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-10"
                    render={<a href={`/dashboard/notas-credito/${detalle.nota.id}`} target="_blank" rel="noreferrer" />}
                  >
                    Ver en Contabilidad
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {trabajo ? (
        <ImpresionPos
          titulo={`devolucion-${trabajo.nota.ncf}`}
          ancho={plantilla.ancho_mm}
          onCerrar={() => setTrabajo(null)}
        >
          <TicketPos payload={armarTicketDevolucion(trabajo, plantilla)} />
        </ImpresionPos>
      ) : null}
    </ContenedorLista>
  );
}

function filaDesdeDetalle(detalle: DevolucionPOSDetalle): DevolucionPOSFila {
  return {
    id: detalle.nota.id,
    numero: detalle.nota.numero,
    ncf: detalle.nota.ncf,
    fecha: detalle.nota.fecha,
    total: detalle.nota.total,
    estado: detalle.nota.estado,
    factura_id: detalle.nota.factura_id,
    factura_numero: detalle.factura.numero,
    factura_ncf: detalle.factura.ncf,
    contacto_id: detalle.nota.contacto_id,
    cliente_nombre: detalle.contacto?.nombre ?? "—",
    tipo_reembolso: detalle.nota.tipo_reembolso,
    monto_reembolso_efectivo: detalle.nota.monto_reembolso_efectivo,
    turno_numero: detalle.nota.turno_numero,
  };
}
