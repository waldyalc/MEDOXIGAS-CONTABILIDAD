"use client";

import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";

import { ArrowLeft, Clock, Loader2, Plus, Printer } from "@/components/icons";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { TarjetaLista } from "@/components/listas/tabla-lista";
import { ContenedorLista } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { ImpresionPos } from "@/components/pos/impresion-pos";
import { TicketPos } from "@/components/pos/ticket-pos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoFechaHora } from "@/lib/formato";
import { type ParametrosLista, type ResumenPagina, urlLista } from "@/lib/listas/parametros";
import { compararMontos } from "@/lib/pos/calculo";
import { armarTicketCierre, armarTicketMovimiento } from "@/lib/pos/impresion";
import type {
  CierreTurnoPOS,
  MovimientoTurnoPOS,
  MovimientoTurnoPOSResultado,
  PlantillaTicket,
  ResumenTurnoVista,
  TurnoPOS,
} from "@/lib/pos/tipos";

import { resumenTurnoPOS, ticketCierrePOS } from "../acciones-pos";
import { DialogoMovimiento, type PrellenadoMovimiento } from "../pagos/dialogo-movimiento";
import type { CuentaPOS } from "../servidor";
import { DialogoAbrirTurno } from "./dialogo-abrir-turno";
import { DialogoCerrarTurno } from "./dialogo-cerrar-turno";
import { ListaTurnos, SELECCION_ACTUAL } from "./lista-turnos";
import { ResumenTurno } from "./resumen-turno";
import { TablaMovimientosTurno } from "./tabla-movimientos-turno";

const ESTA_TERMINAL = "esta";
const TODAS = "todas";

function etiquetaDiferencia(diferencia: string): string {
  const centavos = compararMontos(diferencia, "0");
  if (centavos === 0) return "La caja cuadra.";
  const monto = formatoMoneda(diferencia.startsWith("-") ? diferencia.slice(1) : diferencia);
  return centavos > 0 ? `Sobrante de ${monto}` : `Faltante de ${monto}`;
}

export function TurnosPos({
  terminal,
  vistaInicial,
  turnoAbierto,
  cuentas,
  cierres,
  resumenPagina,
  terminales,
  todas,
  params,
  puedeEscribir,
  error,
}: {
  terminal: { id: string; nombre: string; cuenta_efectivo_id: string; plantilla_ticket: PlantillaTicket };
  vistaInicial: ResumenTurnoVista | null;
  turnoAbierto: boolean;
  cuentas: CuentaPOS[];
  cierres: TurnoPOS[];
  resumenPagina: ResumenPagina;
  terminales: { id: string; nombre: string }[];
  todas: boolean;
  params: ParametrosLista;
  puedeEscribir: boolean;
  error?: string | null;
}) {
  const router = useRouter();
  const [vista, setVista] = useState<ResumenTurnoVista | null>(vistaInicial);
  const [seleccionado, setSeleccionado] = useState<string>(() =>
    vistaInicial ? SELECCION_ACTUAL : (cierres[0]?.id ?? ""),
  );
  const [detalleMovil, setDetalleMovil] = useState(false);
  const [abrirAbierto, setAbrirAbierto] = useState(false);
  const [movimientoAbierto, setMovimientoAbierto] = useState(false);
  const [prellenado, setPrellenado] = useState<PrellenadoMovimiento | null>(null);
  const [cerrarAbierto, setCerrarAbierto] = useState(false);
  const [detalle, setDetalle] = useState<ResumenTurnoVista | null>(null);
  const [detalleCargando, setDetalleCargando] = useState<string | null>(null);
  const [detalleError, setDetalleError] = useState<string | null>(null);
  const [solicitado, setSolicitado] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<CierreTurnoPOS | null>(null);
  const [recibo, setRecibo] = useState<MovimientoTurnoPOSResultado | null>(null);
  const [reciboHistorico, setReciboHistorico] = useState<MovimientoTurnoPOS | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [trabajo, setTrabajo] = useState<
    | { tipo: "cierre"; datos: CierreTurnoPOS }
    | { tipo: "recibo"; datos: MovimientoTurnoPOSResultado; incluirEsperado: boolean }
    | null
  >(null);

  const turno = vista?.turno ?? null;
  const esActual = seleccionado === SELECCION_ACTUAL;
  const abierto = esActual && turnoAbierto && turno?.estado === "abierto";
  const plantilla = vista?.terminal.plantilla_ticket ?? terminal.plantilla_ticket;
  const sinCaja = !cuentas.some((cuenta) => cuenta.id === terminal.cuenta_efectivo_id);
  const vistaDetalle = esActual ? vista : detalle && detalle.turno.id === seleccionado ? detalle : null;

  function actualizarResumen(resumen: ResumenTurnoVista["resumen"]) {
    setVista((actual) => (actual ? { ...actual, resumen } : actual));
  }

  const cargarCierre = useCallback(async (id: string) => {
    setSolicitado(id);
    setDetalleCargando(id);
    setDetalle(null);
    setDetalleError(null);
    try {
      const resultado = await resumenTurnoPOS(id);
      if (!resultado.ok || !resultado.data) {
        setDetalleError(resultado.ok ? "El turno no existe." : resultado.error);
        return;
      }
      setDetalle(resultado.data);
    } finally {
      setDetalleCargando(null);
    }
  }, []);

  function seleccionar(clave: string) {
    setSeleccionado(clave);
    setDetalleMovil(true);
  }

  // La selección de un cierre dispara su detalle una sola vez por id.
  useEffect(() => {
    if (seleccionado === SELECCION_ACTUAL || seleccionado === "" || seleccionado === solicitado) return;
    void cargarCierre(seleccionado);
  }, [seleccionado, solicitado, cargarCierre]);

  async function imprimirCierre(turnoFila: TurnoPOS) {
    setImprimiendo(true);
    try {
      const resultado = await ticketCierrePOS(turnoFila.id);
      if (!resultado.ok || !resultado.data) {
        toast.add({
          type: "error",
          title: "No se pudo preparar el cierre",
          description: resultado.ok ? "El turno no existe." : resultado.error,
        });
        return;
      }
      setTrabajo({ tipo: "cierre", datos: resultado.data });
    } finally {
      setImprimiendo(false);
    }
  }

  function verRecibo(movimiento: MovimientoTurnoPOS) {
    if (!vistaDetalle) return;
    setReciboHistorico(movimiento);
  }

  function inverso(movimiento: MovimientoTurnoPOS) {
    setPrellenado({
      tipo: movimiento.tipo === "ingreso" ? "retiro" : "ingreso",
      motivo: "otro",
      monto: movimiento.monto,
      notas: `Corrección del recibo No ${movimiento.numero}`,
    });
    setMovimientoAbierto(true);
  }

  const reciboPseudo: MovimientoTurnoPOSResultado | null =
    reciboHistorico && vistaDetalle
      ? {
          movimiento: { ...reciboHistorico, factura_ncf: null, cajero: null },
          turno: {
            id: vistaDetalle.turno.id,
            numero: vistaDetalle.turno.numero,
            base_inicial: vistaDetalle.turno.base_inicial,
            estado: vistaDetalle.turno.estado,
          },
          terminal: vistaDetalle.terminal,
          empresa: vistaDetalle.empresa,
          asiento: null,
          plantilla_ticket: plantilla,
          resumen: vistaDetalle.resumen,
        }
      : null;

  const plantillaTrabajo =
    trabajo?.tipo === "cierre" ? (trabajo.datos.terminal.plantilla_ticket ?? plantilla) : plantilla;

  const accionesDetalle = vistaDetalle ? (
    <>
      {abierto && puedeEscribir ? (
        <>
          <Button
            variant="outline"
            className="h-10 gap-1.5"
            onClick={() => {
              setPrellenado(null);
              setMovimientoAbierto(true);
            }}
          >
            <Plus aria-hidden="true" />
            Registrar movimiento
          </Button>
          <Button className="h-10" onClick={() => setCerrarAbierto(true)}>
            Cerrar turno
          </Button>
        </>
      ) : null}
      {esActual && !abierto && puedeEscribir ? (
        <Button className="h-10 gap-1.5" onClick={() => setAbrirAbierto(true)}>
          <Plus aria-hidden="true" />
          Abrir turno
        </Button>
      ) : null}
      {vistaDetalle.turno.estado === "cerrado" ? (
        <Button variant="outline" className="h-10 gap-1.5" onClick={() => void imprimirCierre(vistaDetalle.turno)}>
          {imprimiendo ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Printer aria-hidden="true" />}
          Imprimir cierre
        </Button>
      ) : null}
    </>
  ) : null;

  return (
    <ContenedorLista className="p-4 md:p-6">
      <EncabezadoPagina titulo="Turnos" subtitulo="Abre, opera y cierra la caja de esta terminal." />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {error}
            <Button variant="outline" size="sm" onClick={() => router.refresh()}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {sinCaja ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {`La terminal ${terminal.nombre} no tiene una cuenta de efectivo activa.`}
            <span className="text-xs">Corrige la configuración en Contabilidad.</span>
            <Button
              variant="outline"
              size="sm"
              render={<a href="/dashboard/configuracion/pos" target="_blank" rel="noreferrer" />}
            >
              Abrir configuración
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <TarjetaLista className="lg:flex" data-lista="pos-turnos">
        <div
          className={cn(
            "border-border w-full shrink-0 flex-col lg:flex lg:w-[330px] lg:border-r",
            detalleMovil ? "hidden" : "flex",
          )}
        >
          <div className="border-border border-b p-2">
            <Select
              items={[
                { value: ESTA_TERMINAL, label: "Esta terminal" },
                { value: TODAS, label: "Todas las terminales" },
              ]}
              value={todas ? TODAS : ESTA_TERMINAL}
              onValueChange={(valor) =>
                router.replace(urlLista("/pos/turnos", params, { todas: valor === TODAS ? "1" : null, pagina: null }), {
                  scroll: false,
                })
              }
            >
              <SelectTrigger className="h-9 w-full" aria-label="Filtro de terminal de los cierres">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value={ESTA_TERMINAL}>Esta terminal</SelectItem>
                <SelectItem value={TODAS}>Todas las terminales</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ListaTurnos
            actual={vista?.turno ?? null}
            cierres={cierres}
            terminales={terminales}
            todas={todas}
            seleccionado={seleccionado}
            cargandoId={detalleCargando}
            onSeleccionar={seleccionar}
          />

          <div className="border-border mt-auto border-t px-3 py-2">
            <PaginadorLista
              base="/pos/turnos"
              params={params}
              resumen={resumenPagina}
              botonesExtremos={false}
              className="text-xs"
            />
          </div>
        </div>

        <div className={cn("min-w-0 flex-1", detalleMovil ? "block" : "hidden lg:block")}>
          <div className="flex flex-col gap-4 p-4 md:p-6">
            <Button variant="ghost" className="h-8 w-fit gap-1 px-2 lg:hidden" onClick={() => setDetalleMovil(false)}>
              <ArrowLeft aria-hidden="true" />
              Turnos
            </Button>

            {seleccionado !== SELECCION_ACTUAL && seleccionado !== "" && !vistaDetalle ? (
              detalleError ? (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-destructive text-sm">{detalleError}</p>
                  <Button variant="outline" size="sm" onClick={() => void cargarCierre(seleccionado)}>
                    Reintentar
                  </Button>
                </div>
              ) : (
                <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Cargando cierre…
                </div>
              )
            ) : vistaDetalle ? (
              <>
                <ResumenTurno vista={vistaDetalle} acciones={accionesDetalle} />

                <section>
                  <h3 className="mb-2 text-sm font-semibold">Movimientos del turno</h3>
                  <TablaMovimientosTurno
                    movimientos={vistaDetalle.resumen.movimientos}
                    onVer={verRecibo}
                    onInverso={inverso}
                    permitirInverso={abierto === true && puedeEscribir}
                  />
                </section>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <Clock className="text-muted-foreground size-8" aria-hidden="true" />
                <p className="text-lg font-semibold">{`No hay un turno abierto en ${terminal.nombre}.`}</p>
                <p className="text-muted-foreground text-sm">
                  Abre un turno con la base inicial para empezar a vender.
                </p>
                {puedeEscribir ? (
                  <Button className="mt-2 h-12" onClick={() => setAbrirAbierto(true)}>
                    Abrir turno
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </TarjetaLista>

      <DialogoAbrirTurno
        abierto={abrirAbierto}
        onCerrar={() => setAbrirAbierto(false)}
        terminal={terminal}
        turnoActual={abierto ? (turno?.numero ?? null) : null}
        onAbierto={(datos) => {
          setVista({ turno: datos.turno, terminal: datos.terminal, empresa: datos.empresa, resumen: datos.resumen });
          setSeleccionado(SELECCION_ACTUAL);
          router.refresh();
        }}
      />

      {turno && vista ? (
        <DialogoMovimiento
          abierto={movimientoAbierto}
          onCerrar={() => {
            setMovimientoAbierto(false);
            setPrellenado(null);
          }}
          turnoId={turno.id}
          resumen={vista.resumen}
          cuentas={cuentas}
          cuentaEfectivoId={terminal.cuenta_efectivo_id}
          prellenado={prellenado}
          onRegistrado={(datos) => {
            actualizarResumen(datos.resumen);
            setRecibo(datos);
            toast.add({ type: "success", title: "Movimiento registrado." });
            router.refresh();
          }}
        />
      ) : null}

      {turno && vista ? (
        <DialogoCerrarTurno
          abierto={cerrarAbierto}
          onCerrar={() => setCerrarAbierto(false)}
          vista={vista}
          onCerrado={(datos) => {
            setVista({ turno: datos.turno, terminal: datos.terminal, empresa: datos.empresa, resumen: datos.resumen });
            setSeleccionado(SELECCION_ACTUAL);
            setConfirmacion(datos);
            router.refresh();
          }}
        />
      ) : null}

      <Dialog open={confirmacion !== null} onOpenChange={(nuevo) => (nuevo ? null : setConfirmacion(null))}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Turno cerrado</DialogTitle>
            <DialogDescription>{`Cierre No ${confirmacion?.turno.numero ?? ""}`}</DialogDescription>
          </DialogHeader>
          {confirmacion ? (
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Esperado</span>
                <span className="tabular-nums">{formatoMoneda(confirmacion.resumen.efectivo.efectivo_esperado)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Real</span>
                <span className="tabular-nums">
                  {formatoMoneda(confirmacion.resumen.efectivo.efectivo_real ?? "0")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Diferencia</span>
                <span className="font-medium">
                  {etiquetaDiferencia(confirmacion.resumen.efectivo.diferencia ?? "0")}
                </span>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              className="h-10 gap-1.5"
              onClick={() => confirmacion && setTrabajo({ tipo: "cierre", datos: confirmacion })}
            >
              <Printer aria-hidden="true" />
              Imprimir cierre
            </Button>
            <Button
              className="h-10"
              onClick={() => {
                setConfirmacion(null);
                setAbrirAbierto(true);
              }}
            >
              Abrir nuevo turno
            </Button>
            <Button variant="ghost" onClick={() => setConfirmacion(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recibo !== null} onOpenChange={(nuevo) => (nuevo ? null : setRecibo(null))}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{`Recibo de ${recibo?.movimiento.tipo === "ingreso" ? "ingreso" : "retiro"} No ${recibo?.movimiento.numero ?? ""}`}</DialogTitle>
            <DialogDescription>{recibo ? formatoFechaHora(recibo.movimiento.creado_en) : ""}</DialogDescription>
          </DialogHeader>
          {recibo ? (
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monto</span>
                <span className="font-semibold tabular-nums">{formatoMoneda(recibo.movimiento.monto)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cuenta</span>
                <span>{recibo.movimiento.cuenta_nombre ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Efectivo esperado después</span>
                <span className="tabular-nums">{formatoMoneda(recibo.resumen.efectivo.efectivo_esperado)}</span>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              className="h-10 gap-1.5"
              onClick={() => recibo && setTrabajo({ tipo: "recibo", datos: recibo, incluirEsperado: true })}
            >
              <Printer aria-hidden="true" />
              Imprimir recibo
            </Button>
            <Button variant="ghost" onClick={() => setRecibo(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reciboPseudo !== null} onOpenChange={(nuevo) => (nuevo ? null : setReciboHistorico(null))}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{`Recibo No ${reciboHistorico?.numero ?? ""}`}</DialogTitle>
            <DialogDescription>{reciboHistorico ? formatoFechaHora(reciboHistorico.creado_en) : ""}</DialogDescription>
          </DialogHeader>
          {reciboHistorico ? (
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Motivo</span>
                <span>{reciboHistorico.motivo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monto</span>
                <span className="font-semibold tabular-nums">{formatoMoneda(reciboHistorico.monto)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cuenta</span>
                <span>{reciboHistorico.cuenta_nombre ?? "—"}</span>
              </div>
              {reciboHistorico.notas ? <p className="text-muted-foreground text-xs">{reciboHistorico.notas}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              className="h-10 gap-1.5"
              onClick={() =>
                reciboPseudo && setTrabajo({ tipo: "recibo", datos: reciboPseudo, incluirEsperado: false })
              }
            >
              <Printer aria-hidden="true" />
              Imprimir recibo
            </Button>
            <Button variant="ghost" onClick={() => setReciboHistorico(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {trabajo ? (
        <ImpresionPos
          titulo={
            trabajo.tipo === "cierre"
              ? `cierre-${trabajo.datos.turno.numero}`
              : `recibo-${trabajo.datos.movimiento.numero}`
          }
          ancho={plantillaTrabajo.ancho_mm}
          onCerrar={() => setTrabajo(null)}
        >
          <TicketPos
            payload={
              trabajo.tipo === "cierre"
                ? armarTicketCierre(trabajo.datos, plantillaTrabajo)
                : armarTicketMovimiento(trabajo.datos, plantillaTrabajo, {
                    incluirEfectivoEsperado: trabajo.incluirEsperado,
                  })
            }
          />
        </ImpresionPos>
      ) : null}
    </ContenedorLista>
  );
}
