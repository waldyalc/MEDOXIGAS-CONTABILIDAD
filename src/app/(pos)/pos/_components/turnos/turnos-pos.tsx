"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Clock, Loader2, Plus, Printer } from "lucide-react";

import { PaginadorLista } from "@/components/listas/paginador-lista";
import { ContenedorLista } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { ImpresionPos } from "@/components/pos/impresion-pos";
import { TicketPos } from "@/components/pos/ticket-pos";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoFechaHora } from "@/lib/formato";
import { leerTamano, type ParametrosLista, type ResumenPagina, urlLista } from "@/lib/listas/parametros";
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
import type { CuentaPOS } from "../servidor";
import { DialogoAbrirTurno } from "./dialogo-abrir-turno";
import { DialogoCerrarTurno } from "./dialogo-cerrar-turno";
import { DialogoMovimiento, type PrellenadoMovimiento } from "./dialogo-movimiento";
import { ResumenTurno } from "./resumen-turno";
import { TablaCierres } from "./tabla-cierres";
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
  const [abrirAbierto, setAbrirAbierto] = useState(false);
  const [movimientoAbierto, setMovimientoAbierto] = useState(false);
  const [prellenado, setPrellenado] = useState<PrellenadoMovimiento | null>(null);
  const [cerrarAbierto, setCerrarAbierto] = useState(false);
  const [detalle, setDetalle] = useState<ResumenTurnoVista | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [detalleCargando, setDetalleCargando] = useState(false);
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
  const abierto = turnoAbierto && turno?.estado === "abierto";
  const plantilla = vista?.terminal.plantilla_ticket ?? terminal.plantilla_ticket;
  const sinCaja = !cuentas.some((cuenta) => cuenta.id === terminal.cuenta_efectivo_id);

  function actualizarResumen(resumen: ResumenTurnoVista["resumen"]) {
    setVista((actual) => (actual ? { ...actual, resumen } : actual));
  }

  async function verCierre(turnoFila: TurnoPOS) {
    setDetalleAbierto(true);
    setDetalleCargando(true);
    setDetalle(null);
    try {
      const resultado = await resumenTurnoPOS(turnoFila.id);
      if (!resultado.ok || !resultado.data) {
        toast.add({
          type: "error",
          title: "No se pudo cargar el cierre",
          description: resultado.ok ? "El turno no existe." : resultado.error,
        });
        return;
      }
      setDetalle(resultado.data);
    } finally {
      setDetalleCargando(false);
    }
  }

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
    if (!vista) return;
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
    reciboHistorico && vista
      ? {
          movimiento: { ...reciboHistorico, factura_ncf: null, cajero: null },
          turno: {
            id: vista.turno.id,
            numero: vista.turno.numero,
            base_inicial: vista.turno.base_inicial,
            estado: vista.turno.estado,
          },
          terminal: vista.terminal,
          empresa: vista.empresa,
          asiento: null,
          plantilla_ticket: plantilla,
          resumen: vista.resumen,
        }
      : null;

  const plantillaTrabajo =
    trabajo?.tipo === "cierre" ? (trabajo.datos.terminal.plantilla_ticket ?? plantilla) : plantilla;

  return (
    <ContenedorLista className="p-4 md:p-6">
      <EncabezadoPagina
        titulo="Turnos"
        subtitulo="Abre, opera y cierra la caja de esta terminal."
        acciones={
          puedeEscribir ? (
            <>
              {abierto ? (
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
              ) : (
                <Button className="h-10 gap-1.5" onClick={() => setAbrirAbierto(true)}>
                  <Plus aria-hidden="true" />
                  {turno ? "Abrir nuevo turno" : "Abrir turno"}
                </Button>
              )}
            </>
          ) : null
        }
      />

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

      <Tabs defaultValue="actual">
        <TabsList variant="line">
          <TabsTrigger value="actual">Turno actual</TabsTrigger>
          <TabsTrigger value="cierres">Cierres</TabsTrigger>
        </TabsList>

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

        <TabsContent value="actual" className="mt-4 flex flex-col gap-4">
          {vista === null ? (
            <div className="border-border bg-card flex flex-col items-center gap-2 rounded-2xl border px-6 py-16 text-center">
              <Clock className="text-muted-foreground size-8" aria-hidden="true" />
              <p className="text-lg font-semibold">{`No hay un turno abierto en ${terminal.nombre}.`}</p>
              <p className="text-muted-foreground text-sm">Abre un turno con la base inicial para empezar a vender.</p>
              {puedeEscribir ? (
                <Button className="mt-2 h-12" onClick={() => setAbrirAbierto(true)}>
                  Abrir turno
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <ResumenTurno vista={vista} />

              {turno?.estado === "cerrado" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="destructive">Cerrado</Badge>
                  <Button variant="outline" className="h-10 gap-1.5" onClick={() => void imprimirCierre(vista.turno)}>
                    {imprimiendo ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Printer aria-hidden="true" />
                    )}
                    Imprimir cierre
                  </Button>
                </div>
              ) : null}

              {compararMontos(vista.resumen.efectivo.efectivo_esperado, "0") < 0 && abierto ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    El efectivo esperado es negativo; revisa los pagos y devoluciones del turno antes de cerrar.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div>
                <h3 className="mb-2 text-sm font-semibold">Movimientos del turno</h3>
                <TablaMovimientosTurno
                  movimientos={vista.resumen.movimientos}
                  onVer={verRecibo}
                  onInverso={inverso}
                  permitirInverso={puedeEscribir && abierto}
                />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="cierres" className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
              <SelectTrigger className="h-10 w-[210px]" aria-label="Filtro de terminal de los cierres">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value={ESTA_TERMINAL}>Esta terminal</SelectItem>
                <SelectItem value={TODAS}>Todas las terminales</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TablaCierres
            filas={cierres}
            terminales={terminales}
            todas={todas}
            onVer={(fila) => void verCierre(fila)}
            onImprimir={(fila) => void imprimirCierre(fila)}
          />

          <PaginadorLista
            base="/pos/turnos"
            params={params}
            resumen={resumenPagina}
            opciones={[25, 50, 100]}
            tamano={leerTamano(params)}
          />
        </TabsContent>
      </Tabs>

      <DialogoAbrirTurno
        abierto={abrirAbierto}
        onCerrar={() => setAbrirAbierto(false)}
        terminal={terminal}
        turnoActual={abierto ? (turno?.numero ?? null) : null}
        onAbierto={(datos) => {
          setVista({ turno: datos.turno, terminal: datos.terminal, empresa: datos.empresa, resumen: datos.resumen });
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

      <Sheet open={detalleAbierto} onOpenChange={setDetalleAbierto}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[560px]">
          <SheetHeader>
            <SheetTitle>{`Cierre No ${detalle?.turno.numero ?? ""}`}</SheetTitle>
            <SheetDescription>Resumen congelado del turno.</SheetDescription>
          </SheetHeader>
          {detalleCargando ? (
            <div className="flex items-center gap-2 p-4 text-sm">
              <Loader2 className="animate-spin" aria-hidden="true" />
              Cargando cierre…
            </div>
          ) : detalle ? (
            <div className="flex flex-col gap-4 p-4">
              <ResumenTurno vista={detalle} />
              <TablaMovimientosTurno
                movimientos={detalle.resumen.movimientos}
                onVer={(movimiento) => setReciboHistorico(movimiento)}
                onInverso={() => undefined}
                permitirInverso={false}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

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
