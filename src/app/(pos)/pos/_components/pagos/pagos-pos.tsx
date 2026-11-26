"use client";

import { useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { Plus, Printer } from "@/components/icons";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import { BarraLista, TarjetaLista } from "@/components/listas/tabla-lista";
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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoFechaHora } from "@/lib/formato";
import { leerTamano, leerTexto, type ParametrosLista, type ResumenPagina, urlLista } from "@/lib/listas/parametros";
import { guardarVistaPagosOffline, leerVistaPagosOffline } from "@/lib/pos/cache-vistas-offline";
import type { PagoPOSFila } from "@/lib/pos/consultas";
import { armarTicketMovimiento } from "@/lib/pos/impresion";
import type {
  MovimientoTurnoPOSResultado,
  PlantillaTicket,
  ResumenTurnoVista,
  TipoMovimientoPOS,
} from "@/lib/pos/tipos";

import { resumenTurnoPOS } from "../acciones-pos";
import { EnlacePos } from "../enlace-pos";
import { useOfflinePOS } from "../offline-pos-provider";
import type { CuentaPOS } from "../servidor";
import { DetallePago } from "./detalle-pago";
import { DialogoMovimiento, type PrellenadoMovimiento } from "./dialogo-movimiento";
import { ListaPagos } from "./lista-pagos";

/**
 * Registro de pagos del POS (C6): recibos de caja de `pos_turno_movimientos`
 * de la terminal, en maestro-detalle estilo Alegra — pills Ingresos/Egresos,
 * buscador por número de recibo, detalle con imprimir/ver documento/inverso y
 * paginación. «Nuevo pago» reutiliza `DialogoMovimiento` y exige turno abierto:
 * la caja es del turno, no se crean movimientos huérfanos.
 */
export function PagosPos({
  terminal,
  turnoAbierto,
  vista,
  cuentas,
  filas,
  resumenPagina,
  params,
  tipo,
  puedeEscribir,
  error,
}: {
  terminal: { id: string; nombre: string; cuenta_efectivo_id: string; plantilla_ticket: PlantillaTicket };
  turnoAbierto: boolean;
  vista: ResumenTurnoVista | null;
  cuentas: CuentaPOS[];
  filas: PagoPOSFila[];
  resumenPagina: ResumenPagina;
  params: ParametrosLista;
  tipo: TipoMovimientoPOS;
  puedeEscribir: boolean;
  error?: string | null;
}) {
  const router = useRouter();
  const offline = useOfflinePOS();
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(filas[0]?.id ?? null);
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [movimientoAbierto, setMovimientoAbierto] = useState(false);
  const [prellenado, setPrellenado] = useState<PrellenadoMovimiento | null>(null);
  const [recibo, setRecibo] = useState<MovimientoTurnoPOSResultado | null>(null);
  const [imprimiendo, setImprimiendo] = useState<string | null>(null);
  const [filasCache, setFilasCache] = useState<PagoPOSFila[]>([]);
  const [trabajo, setTrabajo] = useState<{ datos: MovimientoTurnoPOSResultado; incluirEsperado: boolean } | null>(null);

  // Sin red (o con el servidor caído) se pinta lo último guardado del tipo
  // seleccionado (ingresos o egresos), nunca un error falso de conexión.
  const debeHidratar = offline.estado === "offline" || (Boolean(error) && filas.length === 0);

  useEffect(() => {
    if (!debeHidratar) return;
    let vigente = true;
    void leerVistaPagosOffline(offline.ambito, tipo)
      .then((guardada) => {
        if (vigente) setFilasCache(guardada?.filas ?? []);
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [debeHidratar, offline.ambito, tipo]);

  useEffect(() => {
    if (debeHidratar || filas.length === 0) return;
    void guardarVistaPagosOffline(offline.ambito, tipo, filas).catch(() => undefined);
  }, [debeHidratar, filas, offline.ambito, tipo]);

  const filasVisibles = useMemo(
    () => (debeHidratar && filas.length === 0 ? filasCache : filas),
    [debeHidratar, filas, filasCache],
  );
  const errorVisible = debeHidratar && filasVisibles.length > 0 ? null : (error ?? null);

  useEffect(() => {
    setSeleccionadoId((actual) =>
      actual && filasVisibles.some((fila) => fila.id === actual) ? actual : (filasVisibles[0]?.id ?? null),
    );
  }, [filasVisibles]);

  const seleccionado = filasVisibles.find((fila) => fila.id === seleccionadoId) ?? null;
  const plantilla = vista?.terminal.plantilla_ticket ?? terminal.plantilla_ticket;
  const turnoVivo = turnoAbierto && vista?.turno.estado === "abierto";
  const puedeRegistrar = puedeEscribir && turnoVivo && !debeHidratar;
  const cajaNombre = cuentas.find((cuenta) => cuenta.id === terminal.cuenta_efectivo_id)?.nombre ?? null;
  const filtrada = leerTexto(params, "q") !== "";

  function seleccionar(fila: PagoPOSFila) {
    setSeleccionadoId(fila.id);
    setHojaAbierta(true);
  }

  function cambiarTipo(valor: string | null) {
    router.replace(urlLista("/pos/pagos", params, { tipo: valor === "retiro" ? "retiro" : null, pagina: null }), {
      scroll: false,
    });
  }

  function inverso(fila: PagoPOSFila) {
    setHojaAbierta(false);
    setPrellenado({
      tipo: fila.tipo === "ingreso" ? "retiro" : "ingreso",
      motivo: "otro",
      monto: fila.monto,
      notas: `Corrección del recibo No ${fila.numero}`,
    });
    setMovimientoAbierto(true);
  }

  async function imprimir(fila: PagoPOSFila) {
    setImprimiendo(fila.id);
    try {
      const resultado = await resumenTurnoPOS(fila.turno_id);
      if (!resultado.ok || !resultado.data) {
        toast.add({
          type: "error",
          title: "No se pudo preparar el recibo",
          description: resultado.ok ? "El turno del recibo no existe." : resultado.error,
        });
        return;
      }
      const vistaTurno = resultado.data;
      setTrabajo({
        incluirEsperado: false,
        datos: {
          movimiento: { ...fila, factura_ncf: fila.factura_ncf, cajero: null },
          turno: {
            id: vistaTurno.turno.id,
            numero: vistaTurno.turno.numero,
            base_inicial: vistaTurno.turno.base_inicial,
            estado: vistaTurno.turno.estado,
          },
          terminal: vistaTurno.terminal,
          empresa: vistaTurno.empresa,
          asiento: null,
          plantilla_ticket: vistaTurno.terminal.plantilla_ticket ?? terminal.plantilla_ticket,
          resumen: vistaTurno.resumen,
        },
      });
    } finally {
      setImprimiendo(null);
    }
  }

  return (
    <ContenedorLista className="p-4 md:p-6">
      <EncabezadoPagina
        titulo="Pagos"
        subtitulo="Entradas y salidas de efectivo de los turnos de esta terminal."
        acciones={
          puedeEscribir ? (
            <Button
              className="h-10 gap-1.5"
              disabled={!puedeRegistrar}
              onClick={() => {
                setPrellenado(null);
                setMovimientoAbierto(true);
              }}
            >
              <Plus aria-hidden="true" />
              Nuevo pago
            </Button>
          ) : null
        }
      />

      {errorVisible ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {errorVisible}
            <Button variant="outline" size="sm" onClick={() => router.refresh()}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {errorVisible === null && debeHidratar ? (
        <Alert>
          <AlertDescription>
            Mostrando los pagos guardados en este dispositivo. Se actualizarán al recuperar la conexión.
          </AlertDescription>
        </Alert>
      ) : null}

      {puedeEscribir && !turnoAbierto && !debeHidratar ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {`No hay un turno abierto en ${terminal.nombre}. Abre uno para registrar movimientos.`}
            <Button variant="outline" size="sm" render={<EnlacePos href="/pos/turnos" />}>
              Ir a Turnos
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={tipo} onValueChange={cambiarTipo}>
        <TabsList className="grid h-11 w-full grid-cols-2">
          <TabsTrigger value="ingreso">Ingresos</TabsTrigger>
          <TabsTrigger value="retiro">Egresos</TabsTrigger>
        </TabsList>
      </Tabs>

      <TarjetaLista data-lista="pagos">
        <BarraLista>
          <BuscadorLista
            parametros={params}
            valorInicial={leerTexto(params, "q")}
            placeholder="Buscar número de recibo…"
            ariaLabel="Buscar número de recibo"
          />
        </BarraLista>

        <div className="grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:divide-x lg:divide-border">
          <ListaPagos
            filas={filasVisibles}
            seleccionadoId={seleccionado?.id ?? null}
            onSeleccionar={seleccionar}
            tipo={tipo}
            filtrada={filtrada}
          />
          <DetallePago
            pago={seleccionado}
            cajaNombre={cajaNombre}
            puedeInversa={puedeRegistrar}
            imprimiendo={seleccionado !== null && imprimiendo === seleccionado.id}
            onImprimir={(fila) => void imprimir(fila)}
            onInverso={inverso}
            className="hidden lg:flex"
          />
        </div>

        <div className="border-border border-t px-4 py-3">
          <PaginadorLista
            base="/pos/pagos"
            params={params}
            resumen={resumenPagina}
            opciones={[25, 50, 100]}
            tamano={leerTamano(params)}
            mostrarEnVacio
          />
        </div>
      </TarjetaLista>

      <Sheet open={hojaAbierta && seleccionado !== null} onOpenChange={setHojaAbierta}>
        {/* `w-full!` vence al `data-[side=right]:w-3/4` de sheet.tsx: el detalle ocupa todo el móvil. */}
        <SheetContent side="right" className="w-full! overflow-y-auto p-0 sm:max-w-[480px]! lg:hidden">
          <SheetTitle className="sr-only">Detalle del recibo</SheetTitle>
          <DetallePago
            pago={seleccionado}
            cajaNombre={cajaNombre}
            puedeInversa={puedeRegistrar}
            imprimiendo={seleccionado !== null && imprimiendo === seleccionado.id}
            onImprimir={(fila) => void imprimir(fila)}
            onInverso={inverso}
          />
        </SheetContent>
      </Sheet>

      {vista ? (
        <DialogoMovimiento
          abierto={movimientoAbierto}
          onCerrar={() => {
            setMovimientoAbierto(false);
            setPrellenado(null);
          }}
          turnoId={vista.turno.id}
          resumen={vista.resumen}
          cuentas={cuentas}
          cuentaEfectivoId={terminal.cuenta_efectivo_id}
          prellenado={prellenado}
          onRegistrado={(datos) => {
            setRecibo(datos);
            toast.add({ type: "success", title: "Movimiento registrado." });
            router.refresh();
          }}
        />
      ) : null}

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
              onClick={() => recibo && setTrabajo({ datos: recibo, incluirEsperado: true })}
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

      {trabajo ? (
        <ImpresionPos
          titulo={`recibo-${trabajo.datos.movimiento.numero}`}
          ancho={plantilla.ancho_mm}
          onCerrar={() => setTrabajo(null)}
        >
          <TicketPos
            payload={armarTicketMovimiento(trabajo.datos, trabajo.datos.plantilla_ticket, {
              incluirEfectivoEsperado: trabajo.incluirEsperado,
            })}
          />
        </ImpresionPos>
      ) : null}
    </ContenedorLista>
  );
}
