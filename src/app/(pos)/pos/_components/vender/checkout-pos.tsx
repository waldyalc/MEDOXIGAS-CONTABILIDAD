"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";
import { createPortal } from "react-dom";

import {
  ArrowLeftRight,
  Ban,
  Banknote,
  CalendarClock,
  CreditCard,
  Landmark,
  Loader2,
  Plus,
  Split,
  Trash2,
  X,
} from "@/components/icons";
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
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import type { ContactoBuscado } from "@/lib/contactos/seleccion";
import type { Empresa } from "@/lib/facturacion/tipos";
import { completarVenta } from "@/lib/pos/acciones";
import {
  armarPagosCombinadoPOS,
  calcularLineaPOS,
  calcularTotalesCombinadoPOS,
  centavosATexto,
  centavosDeDecimal,
  compararMontos,
  type PagoPOSArmado,
  sumarMontos,
} from "@/lib/pos/calculo";
import { esConsumidorFinalPOS } from "@/lib/pos/consumidor-final";
import { esquemaVenta, MAXIMO_PAGOS_VENTA, mensajeValidacion } from "@/lib/pos/esquemas";
import { armarTicketOffline, type EntradaTicketOffline, type TicketPOSPayload } from "@/lib/pos/impresion";
import type { MetodoPOS, PlantillaTicket, VentaPOSResultado } from "@/lib/pos/tipos";
import { createClient } from "@/lib/supabase/client";

import { useCarritoPOS } from "../carrito-pos-provider";
import { capitalizar, formatoMonedaPOS, hoyRD, textoAMonto } from "../formato-pos";
import { useOfflinePOS } from "../offline-pos-provider";
import { ConfirmacionOffline } from "./confirmacion-offline";
import { ConfirmacionVenta } from "./confirmacion-venta";

type ModoCobro = "efectivo" | "tarjeta" | "transferencia" | "combinado" | "credito";
type MetodoCombinadoPOS = "efectivo" | "tarjeta" | "transferencia";

interface FilaCombinada {
  id: string;
  metodo: MetodoPOS;
  monto: string;
  recibido: string;
  /** Banco destino cuando el método es transferencia. */
  cuenta_id: string;
}

const METODOS_COMBINADOS: MetodoCombinadoPOS[] = ["efectivo", "tarjeta", "transferencia"];

const ETIQUETAS_COMBINADO: Record<MetodoCombinadoPOS, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

const NINGUNO = "__ninguno";

/** Agrupa las dos tarjetas del backend en la opción única «Tarjeta». */
function metodoCombinadoVisible(metodo: MetodoPOS): MetodoCombinadoPOS {
  return metodo === "tarjeta_credito" || metodo === "tarjeta_debito" ? "tarjeta" : metodo;
}

function nuevoId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function centavos(monto: string | null | undefined): number {
  return centavosDeDecimal(monto) ?? 0;
}

function mayor(a: string, b: string): string {
  return centavosDeDecimal(a) != null && compararMontos(a, b) >= 0 ? a : b;
}

function menor(a: string, b: string): string {
  return compararMontos(a, b) <= 0 ? a : b;
}

export function CheckoutPos({
  abierto,
  onCerrar,
  terminal,
  turno,
  empresa,
  cuentas,
  contactos,
  consumidorFinalId,
  plantillaTicket,
  plantillaFactura,
  plantillaCotizacion,
  onVerHistorial,
}: {
  abierto: boolean;
  onCerrar: () => void;
  terminal: {
    id: string;
    nombre: string;
    contacto_defecto_id: string;
    cuenta_efectivo_id: string;
    cuenta_tarjeta_debito_id: string | null;
    cuenta_tarjeta_credito_id: string | null;
    cuenta_transferencia_id: string | null;
  };
  turno: { id: string; numero: number } | null;
  empresa: Empresa | null;
  cuentas: { id: string; nombre: string; es_caja_banco?: boolean; tipo_banco?: string | null }[];
  contactos: ContactoBuscado[];
  consumidorFinalId: string | null;
  plantillaTicket: PlantillaTicket;
  plantillaFactura: { mostrarLogo: boolean; notas: string; terminos: string };
  plantillaCotizacion: { mostrarLogo: boolean; notas: string; terminos: string };
  onVerHistorial: (ncf: string | null) => void;
}) {
  const router = useRouter();
  const carrito = useCarritoPOS();
  const offline = useOfflinePOS();
  const [ticketOffline, setTicketOffline] = useState<TicketPOSPayload | null>(null);
  const { activa, totales } = carrito;
  const [vista, setVista] = useState<"metodos" | "detalle">("metodos");
  const [modo, setModo] = useState<ModoCobro>("efectivo");
  const [recibido, setRecibido] = useState("");
  const [aplicado, setAplicado] = useState("");
  const [filas, setFilas] = useState<FilaCombinada[]>([]);
  const [bancoTransferenciaId, setBancoTransferenciaId] = useState("");
  const [notas, setNotas] = useState("");
  const [vendedores, setVendedores] = useState<{ id: string; nombre: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [lento, setLento] = useState(false);
  const [perdido, setPerdido] = useState(false);
  const [venta, setVenta] = useState<VentaPOSResultado | null>(null);

  const total = totales.total;
  const cotizacion = activa.cotizacion;
  const esConsumidorFinal = esConsumidorFinalPOS(activa.contactoId, consumidorFinalId);
  const nombreCuenta = (id: string | null) =>
    id ? (cuentas.find((cuenta) => cuenta.id === id)?.nombre ?? null) : null;
  const cuentasActivas = useMemo(() => new Set(cuentas.map((cuenta) => cuenta.id)), [cuentas]);
  const cuentasBanco = useMemo(() => {
    const bancos = cuentas.filter((cuenta) => cuenta.es_caja_banco === true && cuenta.tipo_banco === "banco");
    if (bancos.length > 0) return bancos;
    const respaldo = cuentas.find((cuenta) => cuenta.id === terminal.cuenta_transferencia_id);
    return respaldo ? [respaldo] : [];
  }, [cuentas, terminal.cuenta_transferencia_id]);
  const bancoPreseleccionado = useMemo(() => {
    if (cuentasBanco.length === 1) return cuentasBanco[0]?.id ?? "";
    const delTerminal = terminal.cuenta_transferencia_id;
    return delTerminal && cuentasBanco.some((cuenta) => cuenta.id === delTerminal) ? delTerminal : "";
  }, [cuentasBanco, terminal.cuenta_transferencia_id]);

  const cuentaTarjetaCredito =
    terminal.cuenta_tarjeta_credito_id && cuentasActivas.has(terminal.cuenta_tarjeta_credito_id)
      ? terminal.cuenta_tarjeta_credito_id
      : null;
  const cuentaTarjetaDebito =
    terminal.cuenta_tarjeta_debito_id && cuentasActivas.has(terminal.cuenta_tarjeta_debito_id)
      ? terminal.cuenta_tarjeta_debito_id
      : null;
  const cuentaTarjetaId = cuentaTarjetaCredito ?? cuentaTarjetaDebito;
  const metodoTarjetaBackend: MetodoPOS = cuentaTarjetaCredito ? "tarjeta_credito" : "tarjeta_debito";
  const motivoTarjeta = cuentaTarjetaId ? null : "La terminal no tiene una cuenta configurada para tarjeta.";

  const hayTransferencia = cuentasBanco.length > 0;
  const hayCombinado = Boolean(cuentaTarjetaId) || hayTransferencia;
  const sinCaja = !cuentasActivas.has(terminal.cuenta_efectivo_id);

  useEffect(() => {
    if (!abierto) return;
    setVista("metodos");
    setModo("efectivo");
    setFilas([]);
    setBancoTransferenciaId(bancoPreseleccionado);
    setNotas("");
    setError(null);
    setAviso(false);
    setLento(false);
    setPerdido(false);
    setVenta(null);
    setTicketOffline(null);
  }, [abierto, bancoPreseleccionado]);

  useEffect(() => {
    if (!abierto || venta) return;
    setRecibido(total);
    setAplicado(total);
  }, [abierto, total, venta]);

  useEffect(() => {
    if (!abierto) return;
    let activo = true;
    const supabase = createClient();
    supabase
      .from("vendedores")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => {
        if (activo) setVendedores(data ?? []);
      });
    return () => {
      activo = false;
    };
  }, [abierto]);

  useEffect(() => {
    if (!enviando) {
      setLento(false);
      return;
    }
    const lentoId = setTimeout(() => setLento(true), 8000);
    const perdidoId = setTimeout(() => setPerdido(true), 20000);
    return () => {
      clearTimeout(lentoId);
      clearTimeout(perdidoId);
    };
  }, [enviando]);

  const recibidoNum = textoAMonto(recibido);
  const aplicadoSimple = textoAMonto(aplicado);

  const simpleEfectivo = recibidoNum !== null && Number(recibidoNum) > 0;
  const aplicadoEfectivo = simpleEfectivo ? menor(recibidoNum, total) : "0.00";
  const cambioEfectivo = simpleEfectivo ? centavosATexto(Math.max(0, centavos(recibidoNum) - centavos(total))) : "0.00";
  const creditoEfectivo = centavosATexto(Math.max(0, centavos(total) - centavos(aplicadoEfectivo)));

  const aplicadoOtro = aplicadoSimple ?? "0.00";
  const excedeOtro = compararMontos(aplicadoOtro, total) > 0;
  const creditoOtro = excedeOtro ? "0.00" : centavosATexto(Math.max(0, centavos(total) - centavos(aplicadoOtro)));

  const totalesCombinados = calcularTotalesCombinadoPOS(filas, total);
  const sumaCombinada = totalesCombinados.aplicado;
  const excedeCombinado = totalesCombinados.excede;
  const porCobrarCombinado = totalesCombinados.porCobrar;
  const hayCreditoCombinado = totalesCombinados.hayCredito;
  const cambioCombinado = totalesCombinados.cambio;

  const credito =
    modo === "credito"
      ? total
      : modo === "combinado"
        ? porCobrarCombinado
        : modo === "efectivo"
          ? creditoEfectivo
          : creditoOtro;
  const porCobrarVisible = centavos(credito) > 0;
  const cambioVisible =
    (modo === "efectivo" && centavos(cambioEfectivo) > 0) || (modo === "combinado" && centavos(cambioCombinado) > 0);

  const motivoTransferencia = hayTransferencia
    ? null
    : "No hay cuentas bancarias activas configuradas para transferencia.";

  const sumaAplicada =
    modo === "credito"
      ? 0
      : modo === "combinado"
        ? centavos(sumaCombinada)
        : modo === "efectivo"
          ? centavos(aplicadoEfectivo)
          : centavos(aplicadoOtro);

  const filaCombinadaInvalida = totalesCombinados.invalido;
  const bancoCombinadoPendiente = filas.some((fila) => fila.metodo === "transferencia" && fila.cuenta_id === "");

  const ctaDeshabilitado =
    enviando ||
    perdido ||
    sinCaja ||
    activa.lineas.length === 0 ||
    (modo !== "credito" && sumaAplicada <= 0) ||
    excedeOtro ||
    excedeCombinado ||
    (modo === "transferencia" && bancoTransferenciaId === "") ||
    (modo === "combinado" && (filas.length === 0 || filaCombinadaInvalida || bancoCombinadoPendiente)) ||
    (modo === "efectivo" && !simpleEfectivo);

  const etiquetaCta =
    modo === "credito" ? `Vender a crédito ${formatoMonedaPOS(total)}` : `Cobrar ${formatoMonedaPOS(total)}`;

  const pills = useMemo(() => {
    const opciones = new Set<string>();
    opciones.add(total);
    for (const base of [50, 100, 200, 500, 1000]) {
      const siguiente = Math.ceil(centavos(total) / (base * 100)) * (base * 100);
      if (siguiente > centavos(total)) opciones.add(centavosATexto(siguiente));
    }
    return [...opciones].slice(0, 5);
  }, [total]);

  function elegirMetodo(nuevo: ModoCobro) {
    setModo(nuevo);
    setVista("detalle");
    if (nuevo === "transferencia") setBancoTransferenciaId((actual) => actual || bancoPreseleccionado);
    if (nuevo === "combinado" && filas.length === 0) agregarFila();
  }

  function cuentaInicialDe(metodo: MetodoCombinadoPOS): string {
    if (metodo === "tarjeta") return cuentaTarjetaId ?? "";
    if (metodo === "transferencia") return bancoTransferenciaId || bancoPreseleccionado;
    return "";
  }

  function agregarFila() {
    // Se puede repetir el método: dos efectivos o dos transferencias de bancos
    // distintos son pagos separados y la RPC crea un recibo por cada fila.
    const metodo = METODOS_COMBINADOS.find((candidato) => metodoDisponible(candidato));
    if (!metodo) return;
    const restante = centavosATexto(
      Math.max(0, centavos(total) - centavos(sumarMontos(filas.map((fila) => fila.monto || "0")))),
    );
    const monto = centavos(restante) > 0 ? restante : "";
    setFilas((actuales) => [
      ...actuales,
      {
        id: nuevoId(),
        metodo: metodo === "tarjeta" ? metodoTarjetaBackend : metodo,
        monto,
        recibido: monto,
        cuenta_id: cuentaInicialDe(metodo),
      },
    ]);
  }

  function metodoDisponible(metodo: MetodoCombinadoPOS): boolean {
    if (metodo === "efectivo") return true;
    if (metodo === "tarjeta") return Boolean(cuentaTarjetaId);
    return hayTransferencia;
  }

  function armarPagos(): PagoPOSArmado[] {
    if (modo === "credito") return [];
    if (modo === "combinado") return armarPagosCombinadoPOS(filas, hayCreditoCombinado);
    if (modo === "efectivo") {
      return [
        {
          metodo: "efectivo",
          monto: aplicadoEfectivo,
          monto_recibido: mayor(recibidoNum ?? "0", aplicadoEfectivo),
        },
      ];
    }
    if (modo === "tarjeta") {
      return [
        {
          metodo: metodoTarjetaBackend,
          monto: aplicadoOtro,
          ...(cuentaTarjetaId ? { cuenta_id: cuentaTarjetaId } : {}),
        },
      ];
    }
    return [{ metodo: "transferencia", monto: aplicadoOtro, cuenta_id: bancoTransferenciaId }];
  }

  function lineasPayload() {
    return activa.lineas.map((linea) => ({
      producto_id: linea.productoId,
      descripcion: linea.descripcion,
      cantidad: linea.cantidad,
      unidad_id: linea.unidadId,
      precio: linea.precio,
      descuento_pct: linea.descuentoPct,
      itbis_tasa: linea.itbisTasa,
      impuesto_id: linea.impuestoId,
    }));
  }

  async function cobrar() {
    if (ctaDeshabilitado) return;
    if (porCobrarVisible && esConsumidorFinal) {
      setAviso(true);
      return;
    }
    setAviso(false);
    setEnviando(true);
    setError(null);
    setPerdido(false);

    const pagos = armarPagos();
    const recibidoOffline = sumarMontos(pagos.map((pago) => pago.monto_recibido ?? pago.monto));
    const entrada = {
      terminal_id: terminal.id,
      contacto_defecto_id: cotizacion ? null : (consumidorFinalId ?? terminal.contacto_defecto_id),
      contacto_id: cotizacion ? null : activa.contactoId || null,
      lista_precio_id: cotizacion ? null : activa.listaPrecioId || null,
      numeracion_id: activa.numeracionId || null,
      vendedor_id: cotizacion ? null : activa.vendedorId || null,
      ...(notas.trim() ? { notas: notas.trim() } : {}),
      fecha: hoyRD(),
      ...(cotizacion ? { cotizacion_id: cotizacion.id } : { lineas: lineasPayload() }),
      pagos,
    };

    let envioRemoto = false;
    try {
      if (!navigator.onLine || offline.estado === "offline") {
        if (cotizacion) throw new Error("Conéctate para convertir una cotización y evitar facturarla dos veces.");
        if (porCobrarVisible)
          throw new Error("Conéctate para verificar el crédito del cliente antes de vender a crédito.");
        const cliente = contactos.find((contacto) => contacto.id === activa.contactoId);
        if (!cliente)
          throw new Error("El cliente no está disponible en la caché. Selecciona uno cargado antes de cobrar.");
        const validada = esquemaVenta.safeParse(entrada);
        if (!validada.success) throw new Error(mensajeValidacion(validada.error));
        const detalle: Omit<EntradaTicketOffline, "folio"> = {
          empresa,
          cliente,
          plantilla: plantillaTicket,
          fecha: new Date().toISOString(),
          ...totales,
          recibido: recibidoOffline,
          cambio: centavosATexto(Math.max(0, centavos(recibidoOffline) - centavos(total))),
          lineas: activa.lineas.map((linea) => ({
            id: linea.id,
            producto_id: linea.productoId,
            producto_nombre: linea.descripcion,
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
            ...calcularLineaPOS({
              cantidad: linea.cantidad,
              precio: linea.precio,
              descuento_pct: linea.descuentoPct,
              itbis_tasa: linea.itbisTasa,
            }),
          })),
        };
        const operacion = await offline.encolar("venta", validada.data, { pestana: activa, ticket: detalle });
        setTicketOffline(armarTicketOffline({ ...detalle, folio: operacion.folio }));
        carrito.reiniciarTrasVenta();
        return;
      }
      envioRemoto = true;
      const resultado = await completarVenta(entrada);
      if (!resultado.ok) {
        setError(capitalizar(resultado.error));
        return;
      }
      setVenta(resultado.data);
      carrito.reiniciarTrasVenta();
      toast.add({ type: "success", title: "Venta registrada." });
      router.refresh();
    } catch (causa) {
      if (!envioRemoto) {
        setError(
          causa instanceof Error
            ? causa.message
            : "No se pudo guardar. No entregues la venta hasta confirmar el guardado.",
        );
      } else {
        setPerdido(true);
      }
    } finally {
      setEnviando(false);
    }
  }

  function cerrar(nuevo: boolean) {
    if (nuevo) return;
    // La X y «Cancelar» cierran el cobro de inmediato: el carrito se conserva
    // y la venta no se registra. Mientras se envía la venta no se puede cerrar.
    if (enviando) return;
    onCerrar();
  }

  const camposCobro = (
    <CamposCobro
      vendedores={vendedores}
      vendedorId={activa.vendedorId}
      onVendedor={carrito.setVendedor}
      notas={notas}
      onNotas={setNotas}
      vendedorDeshabilitado={cotizacion !== null}
    />
  );

  return (
    <>
      <Dialog open={abierto} onOpenChange={cerrar}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[640px]">
          {ticketOffline ? (
            <ConfirmacionOffline ticket={ticketOffline} onCerrar={onCerrar} />
          ) : venta ? (
            <>
              <DialogTitle className="sr-only">Venta registrada</DialogTitle>
              <DialogDescription className="sr-only">La venta se cobró correctamente.</DialogDescription>
              <ConfirmacionVenta
                venta={venta}
                empresa={empresa}
                plantillaTicket={plantillaTicket}
                plantillaFactura={plantillaFactura}
                plantillaCotizacion={plantillaCotizacion}
                onNuevaVenta={onCerrar}
                onVerHistorial={onVerHistorial}
                onCerrar={onCerrar}
              />
            </>
          ) : (
            <>
              <DialogHeader className="gap-1">
                <DialogTitle className="text-pos-texto text-2xl font-semibold">Pagar factura</DialogTitle>
                <DialogDescription className="text-pos-texto-suave text-sm">
                  {turno ? `${terminal.nombre} · Turno No ${turno.numero}` : terminal.nombre}
                </DialogDescription>
              </DialogHeader>

              <div className="relative flex flex-col items-center gap-0.5">
                {vista === "detalle" ? (
                  <button
                    type="button"
                    className="text-pos-primario hover:text-pos-primario-hover absolute top-0 right-0 flex items-center gap-1 text-sm font-medium transition-colors"
                    onClick={() => setVista("metodos")}
                  >
                    <ArrowLeftRight className="size-3.5" aria-hidden="true" />
                    Cambiar método
                  </button>
                ) : null}
                <span className="text-pos-icono text-xs font-medium tracking-wide uppercase">Total</span>
                <span className="text-pos-texto text-2xl font-semibold tabular-nums">{formatoMonedaPOS(total)}</span>
                {vista === "detalle" && porCobrarVisible ? (
                  <span className="text-pos-texto-suave text-base">
                    Por cobrar:{" "}
                    <span className="font-semibold text-[#e11d48] tabular-nums dark:text-rose-400">
                      {formatoMonedaPOS(credito)}
                    </span>
                  </span>
                ) : vista === "detalle" && cambioVisible ? (
                  <span className="text-pos-texto-suave text-base">
                    Cambio:{" "}
                    <span className="font-semibold text-[#e11d48] tabular-nums dark:text-rose-400">
                      {formatoMonedaPOS(modo === "combinado" ? cambioCombinado : cambioEfectivo)}
                    </span>
                  </span>
                ) : null}
                <span className="text-pos-texto-suave text-xs">
                  {cotizacion ? `Cotización No ${cotizacion.numero}` : carrito.activa.nombre}
                </span>
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {sinCaja ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {`La terminal ${terminal.nombre} no tiene una cuenta de efectivo activa. Corrige la configuración en Contabilidad.`}
                  </AlertDescription>
                </Alert>
              ) : null}

              {perdido ? (
                <Alert variant="destructive">
                  <AlertDescription className="flex flex-col items-start gap-2">
                    No sabemos si la venta se registró. Revisa el Historial antes de volver a cobrar.
                    <Button variant="outline" size="sm" onClick={() => onVerHistorial(null)}>
                      Ver Historial
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : lento ? (
                <Alert>
                  <AlertDescription>
                    La conexión está lenta. La venta sigue en curso; no cierres la pestaña.
                  </AlertDescription>
                </Alert>
              ) : null}

              {vista === "metodos" ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Tile
                      icono={<Banknote aria-hidden="true" />}
                      titulo="Efectivo"
                      activo={false}
                      onClick={() => elegirMetodo("efectivo")}
                    />
                    <Tile
                      icono={<CreditCard aria-hidden="true" />}
                      titulo="Tarjeta"
                      activo={false}
                      motivo={motivoTarjeta}
                      onClick={() => elegirMetodo("tarjeta")}
                    />
                    <Tile
                      icono={<Landmark aria-hidden="true" />}
                      titulo="Transferencia"
                      activo={false}
                      motivo={motivoTransferencia}
                      onClick={() => elegirMetodo("transferencia")}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-pos-linea h-px flex-1" aria-hidden="true" />
                    <span className="text-pos-texto-suave text-xs">Otros métodos</span>
                    <span className="bg-pos-linea h-px flex-1" aria-hidden="true" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Tile
                      icono={<Split aria-hidden="true" />}
                      titulo="Combinado"
                      activo={false}
                      motivo={hayCombinado ? null : "No hay un método de pago adicional configurado en la terminal."}
                      onClick={() => elegirMetodo("combinado")}
                    />
                    <Tile
                      icono={<CalendarClock aria-hidden="true" />}
                      titulo="Crédito"
                      activo={false}
                      onClick={() => elegirMetodo("credito")}
                    />
                  </div>
                  <DialogFooter className="-mx-4 mt-2 -mb-4 flex-row justify-end gap-2 rounded-b-xl border-0 bg-transparent p-4">
                    <Button variant="outline" className="h-10 rounded-[8px] px-5 text-sm" onClick={() => cerrar(false)}>
                      Cancelar
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  {modo === "efectivo" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="efectivo-recibido">Valor del pago en efectivo *</Label>
                          <InputGroup className="h-12 rounded-[5px]">
                            <InputGroupAddon>
                              <InputGroupText>RD$</InputGroupText>
                            </InputGroupAddon>
                            <InputGroupInput
                              id="efectivo-recibido"
                              value={recibido}
                              inputMode="decimal"
                              onChange={(evento) => setRecibido(evento.target.value)}
                            />
                          </InputGroup>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="bg-pos-linea h-px flex-1" aria-hidden="true" />
                          <span className="text-pos-texto-suave text-xs">Opciones rápidas</span>
                          <span className="bg-pos-linea h-px flex-1" aria-hidden="true" />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {pills.map((pill) => (
                            <Button
                              key={pill}
                              type="button"
                              variant="outline"
                              size="sm"
                              className={cn(
                                "h-9 rounded-[5px]",
                                recibido === pill && "border-pos-primario text-pos-primario hover:text-pos-primario",
                              )}
                              onClick={() => setRecibido(pill)}
                            >
                              {pill === total ? `Exacto ${formatoMonedaPOS(pill)}` : formatoMonedaPOS(pill)}
                            </Button>
                          ))}
                        </div>
                        {!simpleEfectivo ? (
                          <p className="text-destructive text-xs">Escribe el efectivo recibido.</p>
                        ) : null}
                      </div>
                      {camposCobro}
                    </div>
                  ) : null}

                  {modo === "tarjeta" || modo === "transferencia" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="monto-aplicado">Valor del pago *</Label>
                          <InputGroup className="h-12 rounded-[5px]">
                            <InputGroupAddon>
                              <InputGroupText>RD$</InputGroupText>
                            </InputGroupAddon>
                            <InputGroupInput
                              id="monto-aplicado"
                              value={aplicado}
                              inputMode="decimal"
                              aria-invalid={excedeOtro}
                              onChange={(evento) => setAplicado(evento.target.value)}
                            />
                          </InputGroup>
                        </div>
                        {excedeOtro ? (
                          <p className="text-destructive text-xs">
                            La suma de los pagos no puede exceder el total de la venta.
                          </p>
                        ) : null}
                        {modo === "transferencia" ? (
                          <div className="flex flex-col gap-2">
                            <Label>Banco destino *</Label>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {cuentasBanco.map((cuenta) => (
                                <button
                                  key={cuenta.id}
                                  type="button"
                                  aria-pressed={bancoTransferenciaId === cuenta.id}
                                  onClick={() => setBancoTransferenciaId(cuenta.id)}
                                  className={cn(
                                    "flex items-center gap-2 rounded-lg border p-3 text-left text-sm font-medium transition-colors",
                                    bancoTransferenciaId === cuenta.id
                                      ? "border-pos-primario bg-pos-acento text-pos-acento-texto"
                                      : "border-border hover:bg-muted",
                                  )}
                                >
                                  <Landmark className="size-4 shrink-0" aria-hidden="true" />
                                  {cuenta.nombre}
                                </button>
                              ))}
                            </div>
                            {bancoTransferenciaId === "" ? (
                              <p className="text-destructive text-xs">Selecciona el banco destino.</p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      {camposCobro}
                    </div>
                  ) : null}

                  {modo === "combinado" ? (
                    <div className="flex flex-col gap-2">
                      {filas.map((fila) => {
                        const metodoVisible = metodoCombinadoVisible(fila.metodo);
                        const opciones = METODOS_COMBINADOS.filter(
                          (candidato) => candidato === metodoVisible || metodoDisponible(candidato),
                        ).map((candidato) => ({ value: candidato, label: ETIQUETAS_COMBINADO[candidato] }));
                        return (
                          <div key={fila.id} className="border-border flex flex-col gap-2 rounded-lg border p-2">
                            <div className="flex items-center gap-2">
                              <Select
                                items={opciones}
                                value={metodoVisible}
                                onValueChange={(valor) => {
                                  if (!valor) return;
                                  setFilas((actuales) =>
                                    actuales.map((actual) =>
                                      actual.id === fila.id
                                        ? {
                                            ...actual,
                                            metodo: valor === "tarjeta" ? metodoTarjetaBackend : valor,
                                            recibido: valor === "efectivo" ? actual.monto : "0.00",
                                            cuenta_id: cuentaInicialDe(valor),
                                          }
                                        : actual,
                                    ),
                                  );
                                }}
                              >
                                <SelectTrigger className="h-10 flex-1" aria-label="Método de pago">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent alignItemWithTrigger={false}>
                                  {opciones.map((opcion) => (
                                    <SelectItem key={opcion.value} value={opcion.value}>
                                      {opcion.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <InputGroup className="h-10 w-36">
                                <InputGroupAddon>
                                  <InputGroupText>RD$</InputGroupText>
                                </InputGroupAddon>
                                <InputGroupInput
                                  value={fila.monto}
                                  inputMode="decimal"
                                  aria-label={`Monto de ${ETIQUETAS_COMBINADO[metodoVisible]}`}
                                  onChange={(evento) =>
                                    setFilas((actuales) =>
                                      actuales.map((actual) =>
                                        actual.id === fila.id ? { ...actual, monto: evento.target.value } : actual,
                                      ),
                                    )
                                  }
                                />
                              </InputGroup>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive size-10"
                                aria-label="Quitar método"
                                disabled={filas.length === 1}
                                onClick={() =>
                                  setFilas((actuales) => actuales.filter((actual) => actual.id !== fila.id))
                                }
                              >
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </div>

                            {fila.metodo === "transferencia" ? (
                              <div className="flex flex-col gap-1">
                                <Label htmlFor={`banco-${fila.id}`} className="text-xs">
                                  Banco destino *
                                </Label>
                                <Select
                                  items={[
                                    { value: NINGUNO, label: "Seleccionar banco" },
                                    ...cuentasBanco.map((cuenta) => ({ value: cuenta.id, label: cuenta.nombre })),
                                  ]}
                                  value={fila.cuenta_id === "" ? NINGUNO : fila.cuenta_id}
                                  onValueChange={(valor) => {
                                    const cuentaId = !valor || valor === NINGUNO ? "" : valor;
                                    setFilas((actuales) =>
                                      actuales.map((actual) =>
                                        actual.id === fila.id ? { ...actual, cuenta_id: cuentaId } : actual,
                                      ),
                                    );
                                  }}
                                >
                                  <SelectTrigger id={`banco-${fila.id}`} className="h-10" aria-label="Banco destino">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent alignItemWithTrigger={false}>
                                    <SelectItem value={NINGUNO}>Seleccionar banco</SelectItem>
                                    {cuentasBanco.map((cuenta) => (
                                      <SelectItem key={cuenta.id} value={cuenta.id}>
                                        {cuenta.nombre}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {fila.cuenta_id === "" ? (
                                  <p className="text-destructive text-xs">Selecciona el banco destino.</p>
                                ) : null}
                              </div>
                            ) : null}

                            {fila.metodo === "efectivo" ? (
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`recibido-${fila.id}`} className="text-xs">
                                  Efectivo recibido
                                </Label>
                                <InputGroup className="h-9 w-36">
                                  <InputGroupAddon>
                                    <InputGroupText>RD$</InputGroupText>
                                  </InputGroupAddon>
                                  <InputGroupInput
                                    id={`recibido-${fila.id}`}
                                    value={hayCreditoCombinado ? fila.monto : fila.recibido}
                                    inputMode="decimal"
                                    disabled={hayCreditoCombinado}
                                    onChange={(evento) =>
                                      setFilas((actuales) =>
                                        actuales.map((actual) =>
                                          actual.id === fila.id ? { ...actual, recibido: evento.target.value } : actual,
                                        ),
                                      )
                                    }
                                  />
                                </InputGroup>
                                <span className="text-muted-foreground text-xs">
                                  {`Cambio ${formatoMonedaPOS(
                                    centavosATexto(
                                      Math.max(
                                        0,
                                        centavos(hayCreditoCombinado ? fila.monto : fila.recibido) -
                                          centavos(fila.monto),
                                      ),
                                    ),
                                  )}`}
                                </span>
                              </div>
                            ) : null}

                            <p className="text-muted-foreground text-xs">
                              Cuenta: {nombreCuenta(cuentaDeFila(fila, terminal, cuentaTarjetaId)) ?? "—"}
                            </p>
                          </div>
                        );
                      })}

                      <Button
                        variant="outline"
                        className="h-10 gap-1.5"
                        disabled={filas.length >= MAXIMO_PAGOS_VENTA}
                        onClick={agregarFila}
                      >
                        <Plus aria-hidden="true" />
                        Agregar método
                      </Button>

                      {filas.length >= MAXIMO_PAGOS_VENTA ? (
                        <p className="text-muted-foreground text-xs">
                          Una venta admite hasta {MAXIMO_PAGOS_VENTA} pagos.
                        </p>
                      ) : null}

                      {excedeCombinado ? (
                        <p className="text-destructive text-xs">
                          La suma de los pagos no puede exceder el total de la venta.
                        </p>
                      ) : null}
                      {filaCombinadaInvalida ? (
                        <p className="text-destructive text-xs">Completa cada fila con un monto mayor a cero.</p>
                      ) : null}
                      {bancoCombinadoPendiente ? (
                        <p className="text-destructive text-xs">Selecciona el banco destino de cada transferencia.</p>
                      ) : null}

                      {camposCobro}
                    </div>
                  ) : null}

                  {modo === "credito" ? <div className="grid gap-3 sm:grid-cols-2">{camposCobro}</div> : null}

                  <DialogFooter className="-mx-4 mt-2 -mb-4 flex-row justify-end gap-2 rounded-b-xl border-0 bg-transparent p-4">
                    <Button
                      variant="outline"
                      className="h-10 rounded-[8px] px-5 text-sm"
                      disabled={enviando}
                      onClick={() => cerrar(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="bg-pos-primario hover:bg-pos-primario-hover h-10 rounded-[8px] px-5 text-sm text-white"
                      disabled={ctaDeshabilitado}
                      onClick={() => void cobrar()}
                    >
                      {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                      {enviando ? "Procesando venta…" : etiquetaCta}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {aviso
        ? createPortal(
            <div
              role="alert"
              aria-live="assertive"
              className="fixed top-5 right-5 z-[100] flex w-[calc(100%-2rem)] max-w-[390px] items-start gap-3 rounded-[8px] bg-[#ffe4e6] p-3 text-slate-900 shadow-lg dark:bg-rose-950/85 dark:text-rose-50"
            >
              <Ban className="mt-0.5 size-5 shrink-0 text-[#e11d48] dark:text-rose-400" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-sm leading-tight font-semibold">Algunos campos necesitan tu atención</p>
                <p className="text-sm text-slate-700 dark:text-rose-100/80">
                  Revisa los campos marcados antes de guardar.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-slate-500 hover:bg-rose-200/60 hover:text-slate-700 dark:text-rose-200 dark:hover:bg-rose-900/60"
                aria-label="Cerrar aviso"
                onClick={() => setAviso(false)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function cuentaDeFila(
  fila: FilaCombinada,
  terminal: { cuenta_efectivo_id: string },
  cuentaTarjetaId: string | null,
): string | null {
  if (fila.metodo === "efectivo") return terminal.cuenta_efectivo_id;
  if (fila.metodo === "transferencia") return fila.cuenta_id === "" ? null : fila.cuenta_id;
  return cuentaTarjetaId;
}

function CamposCobro({
  vendedores,
  vendedorId,
  onVendedor,
  notas,
  onNotas,
  vendedorDeshabilitado,
}: {
  vendedores: { id: string; nombre: string }[];
  vendedorId: string;
  onVendedor: (vendedorId: string) => void;
  notas: string;
  onNotas: (notas: string) => void;
  vendedorDeshabilitado: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {vendedores.length > 0 ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="cobro-vendedor">Vendedor</Label>
          <Select
            items={[
              { value: NINGUNO, label: "Seleccionar" },
              ...vendedores.map((vendedor) => ({ value: vendedor.id, label: vendedor.nombre })),
            ]}
            value={vendedorId === "" ? NINGUNO : vendedorId}
            onValueChange={(valor) => onVendedor(valor === NINGUNO ? "" : (valor ?? ""))}
            disabled={vendedorDeshabilitado}
          >
            <SelectTrigger id="cobro-vendedor" className="h-12 w-full rounded-[5px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value={NINGUNO}>Seleccionar</SelectItem>
              {vendedores.map((vendedor) => (
                <SelectItem key={vendedor.id} value={vendedor.id}>
                  {vendedor.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <Label htmlFor="cobro-observaciones">Observaciones</Label>
        <Textarea
          id="cobro-observaciones"
          value={notas}
          maxLength={500}
          placeholder="Ingresa tu observación"
          className="min-h-[100px] rounded-[5px]"
          onChange={(evento) => onNotas(evento.target.value)}
        />
      </div>
    </div>
  );
}

function Tile({
  icono,
  titulo,
  activo,
  motivo,
  onClick,
}: {
  icono: ReactNode;
  titulo: string;
  activo: boolean;
  motivo?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      title={motivo ?? undefined}
      disabled={Boolean(motivo)}
      onClick={onClick}
      className={cn(
        "border-border flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-lg border p-3 transition-colors",
        activo ? "border-pos-primario bg-pos-acento text-pos-acento-texto" : "hover:bg-muted",
        motivo && "cursor-not-allowed opacity-50",
      )}
    >
      <span className="[&_svg]:size-7">{icono}</span>
      <span className="text-sm font-medium">{titulo}</span>
    </button>
  );
}
