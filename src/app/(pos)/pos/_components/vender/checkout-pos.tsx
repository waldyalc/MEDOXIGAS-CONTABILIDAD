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
  Wallet,
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
import { centavosATexto, centavosDeDecimal, compararMontos, sumarMontos } from "@/lib/pos/calculo";
import type { MetodoPOS, PlantillaTicket, VentaPOSResultado } from "@/lib/pos/tipos";
import { createClient } from "@/lib/supabase/client";

import { useCarritoPOS } from "../carrito-pos-provider";
import { capitalizar, ETIQUETAS_METODO, formatoMonedaPOS, hoyRD, textoAMonto } from "../formato-pos";
import { ConfirmacionVenta } from "./confirmacion-venta";

type ModoCobro = MetodoPOS | "combinado" | "credito";

interface FilaCombinada {
  id: string;
  metodo: MetodoPOS;
  monto: string;
  recibido: string;
}

const METODOS_COMBINADOS: MetodoPOS[] = ["efectivo", "tarjeta_debito", "tarjeta_credito", "transferencia"];

const NINGUNO = "__ninguno";

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
  cuentas: { id: string; nombre: string }[];
  contactos: ContactoBuscado[];
  plantillaTicket: PlantillaTicket;
  plantillaFactura: { mostrarLogo: boolean; notas: string; terminos: string };
  plantillaCotizacion: { mostrarLogo: boolean; notas: string; terminos: string };
  onVerHistorial: (ncf: string | null) => void;
}) {
  const router = useRouter();
  const carrito = useCarritoPOS();
  const { activa, totales } = carrito;
  const [vista, setVista] = useState<"metodos" | "detalle">("metodos");
  const [modo, setModo] = useState<ModoCobro>("efectivo");
  const [recibido, setRecibido] = useState("");
  const [aplicado, setAplicado] = useState("");
  const [filas, setFilas] = useState<FilaCombinada[]>([]);
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
  const esConsumidorFinal = activa.contactoId === terminal.contacto_defecto_id;
  const nombreCuenta = (id: string | null) =>
    id ? (cuentas.find((cuenta) => cuenta.id === id)?.nombre ?? null) : null;
  const cuentasActivas = useMemo(() => new Set(cuentas.map((cuenta) => cuenta.id)), [cuentas]);

  const cuentaDebito = terminal.cuenta_tarjeta_debito_id && cuentasActivas.has(terminal.cuenta_tarjeta_debito_id);
  const cuentaCredito = terminal.cuenta_tarjeta_credito_id && cuentasActivas.has(terminal.cuenta_tarjeta_credito_id);
  const cuentaTransferencia = terminal.cuenta_transferencia_id && cuentasActivas.has(terminal.cuenta_transferencia_id);
  const hayCombinado = [cuentaDebito, cuentaCredito, cuentaTransferencia].some(Boolean);
  const sinCaja = !cuentasActivas.has(terminal.cuenta_efectivo_id);

  useEffect(() => {
    if (!abierto) return;
    setVista("metodos");
    setModo("efectivo");
    setFilas([]);
    setNotas("");
    setError(null);
    setAviso(false);
    setLento(false);
    setPerdido(false);
    setVenta(null);
  }, [abierto]);

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

  const sumaCombinada = sumarMontos(filas.map((fila) => fila.monto || "0"));
  const excedeCombinado = compararMontos(sumaCombinada, total) > 0;
  const porCobrarCombinado = excedeCombinado
    ? "0.00"
    : centavosATexto(Math.max(0, centavos(total) - centavos(sumaCombinada)));
  const hayCreditoCombinado = centavos(porCobrarCombinado) > 0;
  const cambioCombinado = hayCreditoCombinado
    ? "0.00"
    : centavosATexto(
        Math.max(
          0,
          filas
            .filter((fila) => fila.metodo === "efectivo")
            .reduce((suma, fila) => suma + Math.max(0, centavos(fila.recibido) - centavos(fila.monto)), 0),
        ),
      );

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

  const motivoDebito = cuentaDebito ? null : "La terminal no tiene una cuenta configurada para tarjeta débito.";
  const motivoCredito = cuentaCredito ? null : "La terminal no tiene una cuenta configurada para tarjeta crédito.";
  const motivoTransferencia = cuentaTransferencia
    ? null
    : "La terminal no tiene una cuenta configurada para transferencia.";

  const sumaAplicada =
    modo === "credito"
      ? 0
      : modo === "combinado"
        ? centavos(sumaCombinada)
        : modo === "efectivo"
          ? centavos(aplicadoEfectivo)
          : centavos(aplicadoOtro);

  const filaCombinadaInvalida = filas.some(
    (fila) =>
      centavos(fila.monto) <= 0 ||
      (fila.metodo === "efectivo" && !hayCreditoCombinado && centavos(fila.recibido) < centavos(fila.monto)),
  );

  const ctaDeshabilitado =
    enviando ||
    perdido ||
    sinCaja ||
    activa.lineas.length === 0 ||
    (modo !== "credito" && sumaAplicada <= 0) ||
    excedeOtro ||
    excedeCombinado ||
    (modo === "combinado" && (filas.length === 0 || filaCombinadaInvalida)) ||
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
    if (nuevo === "combinado" && filas.length === 0) agregarFila();
  }

  function agregarFila() {
    const disponibles = METODOS_COMBINADOS.filter(
      (metodo) => !filas.some((fila) => fila.metodo === metodo) && metodoDisponible(metodo),
    );
    const metodo = disponibles[0];
    if (!metodo) return;
    const restante = centavosATexto(
      Math.max(0, centavos(total) - centavos(sumarMontos(filas.map((fila) => fila.monto || "0")))),
    );
    const monto = centavos(restante) > 0 ? restante : total;
    setFilas((actuales) => [...actuales, { id: nuevoId(), metodo, monto, recibido: monto }]);
  }

  function metodoDisponible(metodo: MetodoPOS): boolean {
    if (metodo === "efectivo") return true;
    if (metodo === "tarjeta_debito") return Boolean(cuentaDebito);
    if (metodo === "tarjeta_credito") return Boolean(cuentaCredito);
    return Boolean(cuentaTransferencia);
  }

  function armarPagos() {
    if (modo === "credito") return [];
    if (modo === "combinado") {
      return filas
        .filter((fila) => centavos(fila.monto) > 0)
        .map((fila) => {
          const monto = textoAMonto(fila.monto) ?? "0.00";
          return {
            metodo: fila.metodo,
            monto,
            ...(fila.metodo === "efectivo"
              ? {
                  monto_recibido: hayCreditoCombinado ? monto : mayor(textoAMonto(fila.recibido) ?? "0.00", monto),
                }
              : {}),
          };
        });
    }
    if (modo === "efectivo") {
      return [
        {
          metodo: "efectivo" as const,
          monto: aplicadoEfectivo,
          monto_recibido: mayor(recibidoNum ?? "0", aplicadoEfectivo),
        },
      ];
    }
    return [{ metodo: modo, monto: aplicadoOtro }];
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

    const entrada = {
      terminal_id: terminal.id,
      contacto_defecto_id: cotizacion ? null : terminal.contacto_defecto_id,
      contacto_id: cotizacion ? null : activa.contactoId || null,
      lista_precio_id: cotizacion ? null : activa.listaPrecioId || null,
      numeracion_id: activa.numeracionId || null,
      vendedor_id: cotizacion ? null : activa.vendedorId || null,
      ...(notas.trim() ? { notas: notas.trim() } : {}),
      fecha: hoyRD(),
      ...(cotizacion ? { cotizacion_id: cotizacion.id } : { lineas: lineasPayload() }),
      pagos: armarPagos(),
    };

    try {
      const resultado = await completarVenta(entrada);
      if (!resultado.ok) {
        setError(capitalizar(resultado.error));
        return;
      }
      setVenta(resultado.data);
      carrito.reiniciarTrasVenta();
      toast.add({ type: "success", title: "Venta registrada." });
      router.refresh();
    } catch {
      setPerdido(true);
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
          {venta ? (
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
                      titulo="Tarjeta crédito"
                      activo={false}
                      motivo={motivoCredito}
                      onClick={() => elegirMetodo("tarjeta_credito")}
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
                  <div className="grid grid-cols-3 gap-2">
                    <Tile
                      icono={<Wallet aria-hidden="true" />}
                      titulo="Tarjeta débito"
                      activo={false}
                      motivo={motivoDebito}
                      onClick={() => elegirMetodo("tarjeta_debito")}
                    />
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

                  {modo === "tarjeta_debito" || modo === "tarjeta_credito" || modo === "transferencia" ? (
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
                      </div>
                      {camposCobro}
                    </div>
                  ) : null}

                  {modo === "combinado" ? (
                    <div className="flex flex-col gap-2">
                      {filas.map((fila) => {
                        const metodo = fila.metodo;
                        return (
                          <div key={fila.id} className="border-border flex flex-col gap-2 rounded-lg border p-2">
                            <div className="flex items-center gap-2">
                              <Select
                                items={METODOS_COMBINADOS.filter(
                                  (candidato) =>
                                    candidato === fila.metodo ||
                                    (!filas.some((otra) => otra.id !== fila.id && otra.metodo === candidato) &&
                                      metodoDisponible(candidato)),
                                ).map((candidato) => ({ value: candidato, label: ETIQUETAS_METODO[candidato] }))}
                                value={metodo}
                                onValueChange={(valor) => {
                                  if (!valor) return;
                                  setFilas((actuales) =>
                                    actuales.map((actual) =>
                                      actual.id === fila.id
                                        ? {
                                            ...actual,
                                            metodo: valor,
                                            recibido: valor === "efectivo" ? actual.monto : "0.00",
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
                                  {METODOS_COMBINADOS.filter(
                                    (candidato) =>
                                      candidato === fila.metodo ||
                                      (!filas.some((otra) => otra.id !== fila.id && otra.metodo === candidato) &&
                                        metodoDisponible(candidato)),
                                  ).map((candidato) => (
                                    <SelectItem key={candidato} value={candidato}>
                                      {ETIQUETAS_METODO[candidato]}
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
                                  aria-label={`Monto de ${ETIQUETAS_METODO[fila.metodo]}`}
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
                              Cuenta: {nombreCuenta(cuentaDeMetodo(fila.metodo, terminal)) ?? "—"}
                            </p>
                          </div>
                        );
                      })}

                      <Button
                        variant="outline"
                        className="h-10 gap-1.5"
                        disabled={
                          filas.length >= 4 ||
                          METODOS_COMBINADOS.every(
                            (metodo) => filas.some((fila) => fila.metodo === metodo) || !metodoDisponible(metodo),
                          )
                        }
                        onClick={agregarFila}
                      >
                        <Plus aria-hidden="true" />
                        Agregar método
                      </Button>

                      {excedeCombinado ? (
                        <p className="text-destructive text-xs">
                          La suma de los pagos no puede exceder el total de la venta.
                        </p>
                      ) : null}
                      {filaCombinadaInvalida ? (
                        <p className="text-destructive text-xs">Completa cada fila con un monto mayor a cero.</p>
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

function cuentaDeMetodo(
  metodo: MetodoPOS,
  terminal: {
    cuenta_efectivo_id: string;
    cuenta_tarjeta_debito_id: string | null;
    cuenta_tarjeta_credito_id: string | null;
    cuenta_transferencia_id: string | null;
  },
): string | null {
  if (metodo === "efectivo") return terminal.cuenta_efectivo_id;
  if (metodo === "tarjeta_debito") return terminal.cuenta_tarjeta_debito_id;
  if (metodo === "tarjeta_credito") return terminal.cuenta_tarjeta_credito_id;
  return terminal.cuenta_transferencia_id;
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
