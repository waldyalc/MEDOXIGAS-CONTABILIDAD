"use client";

import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";

import { ArrowLeft, RotateCcw, Undo2 } from "@/components/icons";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { BarraLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { ContenedorLista } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { ImpresionPos } from "@/components/pos/impresion-pos";
import { TicketPos } from "@/components/pos/ticket-pos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { leerTamano, type ParametrosLista, type ResumenPagina } from "@/lib/listas/parametros";
import { armarTicketDevolucion } from "@/lib/pos/impresion";
import type { DevolucionPOSResultado, PlantillaTicket } from "@/lib/pos/tipos";

import { detalleDevolucionPOS, ticketDevolucionPOS } from "../acciones-pos";
import { capitalizar } from "../formato-pos";
import type { DevolucionPOSDetalle, DevolucionPOSFila } from "../tipos";
import { DetalleDevolucionPos } from "./detalle-devolucion-pos";
import { FiltrosDevoluciones } from "./filtros-devoluciones";
import { ListaDevoluciones } from "./lista-devoluciones";
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
  const [detalleId, setDetalleId] = useState<string | null>(() => filas[0]?.id ?? null);
  const [detalleMovil, setDetalleMovil] = useState(false);
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

  function seleccionar(id: string) {
    setDetalleId(id);
    setDetalleMovil(true);
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
        <TarjetaLista className="flex flex-col" data-lista="pos-devoluciones">
          <BarraLista className="h-auto flex-wrap py-2">
            <FiltrosDevoluciones params={params} desde={desde} hasta={hasta} />
          </BarraLista>

          {filas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <Undo2 className="text-muted-foreground size-8" aria-hidden="true" />
              {hayFiltros ? (
                <>
                  <p className="text-lg font-semibold">Sin resultados.</p>
                  <p className="text-muted-foreground text-sm">No hay devoluciones que coincidan con los filtros.</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold">Aún no hay devoluciones del POS.</p>
                  <p className="text-muted-foreground text-sm">
                    Las notas de crédito creadas desde el punto de venta aparecerán aquí.
                  </p>
                  {turno && !sinCaja && puedeEscribir ? (
                    <Button className="mt-2 h-10" onClick={() => setWizardAbierto(true)}>
                      Nueva devolución
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <div className="lg:flex">
              <div
                className={cn(
                  "border-border w-full shrink-0 flex-col lg:flex lg:w-[330px] lg:border-r",
                  detalleMovil ? "hidden" : "flex",
                )}
              >
                <ListaDevoluciones
                  filas={filas}
                  seleccionado={detalleId}
                  imprimiendo={imprimiendo}
                  onSeleccionar={seleccionar}
                  onImprimir={(fila) => void imprimir(fila)}
                />
                <div className="border-border mt-auto border-t px-3 py-2">
                  <PaginadorLista
                    base="/pos/devoluciones"
                    params={params}
                    resumen={resumen}
                    opciones={[25, 50, 100]}
                    tamano={leerTamano(params)}
                    botonesExtremos={false}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className={cn("min-w-0 flex-1", detalleMovil ? "block" : "hidden lg:block")}>
                <Button
                  variant="ghost"
                  className="m-2 h-8 w-fit gap-1 px-2 lg:hidden"
                  onClick={() => setDetalleMovil(false)}
                >
                  <ArrowLeft aria-hidden="true" />
                  Devoluciones
                </Button>

                {!detalleId ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
                    <Undo2 className="text-muted-foreground size-8" aria-hidden="true" />
                    <p className="text-lg font-semibold">Selecciona una devolución</p>
                    <p className="text-muted-foreground max-w-sm text-sm">
                      Elige una nota de crédito de la lista para ver sus líneas y el reembolso.
                    </p>
                  </div>
                ) : cargandoDetalle ? (
                  <div className="flex flex-col gap-2 p-4 md:p-6">
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ) : errorDetalle ? (
                  <div className="flex flex-col items-start gap-2 p-4 md:p-6">
                    <p className="text-destructive text-sm">{errorDetalle}</p>
                    <Button variant="outline" size="sm" onClick={() => detalleId && void cargarDetalle(detalleId)}>
                      Reintentar
                    </Button>
                  </div>
                ) : detalle ? (
                  <DetalleDevolucionPos detalle={detalle} onImprimir={(fila) => void imprimir(fila)} />
                ) : null}
              </div>
            </div>
          )}
        </TarjetaLista>
      )}

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
        onCreada={(creada) => {
          // La NC ya existe en la base: recarga la lista del servidor y deja
          // seleccionada la devolución recién creada.
          router.refresh();
          setDetalleId(creada.nota.id);
          setDetalleMovil(true);
        }}
      />

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
