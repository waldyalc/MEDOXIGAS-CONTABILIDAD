"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { cn } from "cn";

import { SelectorContacto } from "@/components/contactos/selector-contacto";
import { ArrowLeftRight, Banknote, CalendarClock, CreditCard, Loader2, Plus, Split, Trash2 } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import type { ContactoBuscado } from "@/lib/contactos/seleccion";
import { formatoMoneda } from "@/lib/facturacion/formato";
import type { Empresa } from "@/lib/facturacion/tipos";
import { completarVenta } from "@/lib/pos/acciones";
import { centavosATexto, centavosDeDecimal, compararMontos, sumarMontos } from "@/lib/pos/calculo";
import type { MetodoPOS, PlantillaTicket, VentaPOSResultado } from "@/lib/pos/tipos";

import { useCarritoPOS } from "../carrito-pos-provider";
import { capitalizar, ETIQUETAS_METODO, hoyRD, textoAMonto } from "../formato-pos";
import { ConfirmacionVenta } from "./confirmacion-venta";

type ModoCobro = MetodoPOS | "combinado" | "credito";

interface FilaCombinada {
  id: string;
  metodo: MetodoPOS;
  monto: string;
  recibido: string;
}

const METODOS_COMBINADOS: MetodoPOS[] = ["efectivo", "tarjeta_debito", "tarjeta_credito", "transferencia"];

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
  const [modo, setModo] = useState<ModoCobro>("efectivo");
  const [recibido, setRecibido] = useState("");
  const [aplicado, setAplicado] = useState("");
  const [filas, setFilas] = useState<FilaCombinada[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [lento, setLento] = useState(false);
  const [perdido, setPerdido] = useState(false);
  const [venta, setVenta] = useState<VentaPOSResultado | null>(null);
  const [confirmarCierre, setConfirmarCierre] = useState(false);

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
    setModo("efectivo");
    setFilas([]);
    setError(null);
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
  const hayCredito = centavos(credito) > 0;

  const motivoDebito = cuentaDebito ? null : "La terminal no tiene una cuenta configurada para tarjeta débito.";
  const motivoCredito = cuentaCredito ? null : "La terminal no tiene una cuenta configurada para tarjeta crédito.";
  const motivoTransferencia = cuentaTransferencia
    ? null
    : "La terminal no tiene una cuenta configurada para transferencia.";
  const motivoCreditoCliente = esConsumidorFinal ? "No se puede vender a crédito al Consumidor Final." : null;

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
    (hayCredito && esConsumidorFinal) ||
    (modo === "efectivo" && !simpleEfectivo);

  const etiquetaCta =
    modo === "credito" ? `Vender a crédito ${formatoMoneda(total)}` : `Cobrar ${formatoMoneda(total)}`;

  const pills = useMemo(() => {
    const opciones = new Set<string>();
    opciones.add(total);
    for (const base of [50, 100, 200, 500, 1000]) {
      const siguiente = Math.ceil(centavos(total) / (base * 100)) * (base * 100);
      if (siguiente > centavos(total)) opciones.add(centavosATexto(siguiente));
    }
    return [...opciones].slice(0, 5);
  }, [total]);

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
    if (!nuevo) {
      if (enviando) return;
      if (venta) {
        onCerrar();
        return;
      }
      if (activa.lineas.length > 0) {
        setConfirmarCierre(true);
        return;
      }
      onCerrar();
    }
  }

  return (
    <>
      <Dialog open={abierto} onOpenChange={cerrar}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[720px]">
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
              <DialogHeader>
                <DialogTitle>Cobrar venta</DialogTitle>
                <DialogDescription>
                  {turno ? `${terminal.nombre} · Turno No ${turno.numero}` : terminal.nombre}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  {cotizacion ? `Cotización No ${cotizacion.numero}` : carrito.activa.nombre}
                </span>
                <span className="text-2xl font-semibold tabular-nums">{formatoMoneda(total)}</span>
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

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Tile
                  icono={<Banknote aria-hidden="true" />}
                  titulo="Efectivo"
                  cuenta={nombreCuenta(terminal.cuenta_efectivo_id)}
                  activo={modo === "efectivo"}
                  onClick={() => setModo("efectivo")}
                />
                <Tile
                  icono={<CreditCard aria-hidden="true" />}
                  titulo="Tarjeta débito"
                  cuenta={nombreCuenta(terminal.cuenta_tarjeta_debito_id)}
                  activo={modo === "tarjeta_debito"}
                  motivo={motivoDebito}
                  onClick={() => setModo("tarjeta_debito")}
                />
                <Tile
                  icono={<CreditCard aria-hidden="true" />}
                  titulo="Tarjeta crédito"
                  cuenta={nombreCuenta(terminal.cuenta_tarjeta_credito_id)}
                  activo={modo === "tarjeta_credito"}
                  motivo={motivoCredito}
                  onClick={() => setModo("tarjeta_credito")}
                />
                <Tile
                  icono={<ArrowLeftRight aria-hidden="true" />}
                  titulo="Transferencia"
                  cuenta={nombreCuenta(terminal.cuenta_transferencia_id)}
                  activo={modo === "transferencia"}
                  motivo={motivoTransferencia}
                  onClick={() => setModo("transferencia")}
                />
                <Tile
                  icono={<Split aria-hidden="true" />}
                  titulo="Combinado"
                  cuenta={null}
                  activo={modo === "combinado"}
                  motivo={hayCombinado ? null : "No hay un método de pago adicional configurado en la terminal."}
                  onClick={() => {
                    setModo("combinado");
                    if (filas.length === 0) agregarFila();
                  }}
                />
                <Tile
                  icono={<CalendarClock aria-hidden="true" />}
                  titulo="Crédito"
                  cuenta={null}
                  activo={modo === "credito"}
                  motivo={motivoCreditoCliente}
                  onClick={() => setModo("credito")}
                />
              </div>

              {modo === "efectivo" ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="efectivo-recibido">Efectivo recibido</Label>
                    <InputGroup className="h-10">
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
                  <div className="flex flex-wrap gap-1.5">
                    {pills.map((pill) => (
                      <Button
                        key={pill}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => setRecibido(pill)}
                      >
                        {pill === total ? "Exacto" : formatoMoneda(pill)}
                      </Button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1 border-t pt-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Aplicado a la venta</span>
                      <span className="tabular-nums">{formatoMoneda(aplicadoEfectivo)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cambio</span>
                      <span className="tabular-nums">{formatoMoneda(cambioEfectivo)}</span>
                    </div>
                  </div>
                  {!simpleEfectivo ? <p className="text-destructive text-xs">Escribe el efectivo recibido.</p> : null}
                </div>
              ) : null}

              {modo === "tarjeta_debito" || modo === "tarjeta_credito" || modo === "transferencia" ? (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="monto-aplicado">Monto aplicado</Label>
                  <InputGroup className="h-10">
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
                  {excedeOtro ? (
                    <p className="text-destructive text-xs">
                      La suma de los pagos no puede exceder el total de la venta.
                    </p>
                  ) : null}
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
                            <SelectTrigger className="h-10 flex-1">
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
                            onClick={() => setFilas((actuales) => actuales.filter((actual) => actual.id !== fila.id))}
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
                              {`Cambio ${formatoMoneda(
                                centavosATexto(
                                  Math.max(
                                    0,
                                    centavos(hayCreditoCombinado ? fila.monto : fila.recibido) - centavos(fila.monto),
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

                  <div className="flex flex-col gap-1 border-t pt-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total recibido</span>
                      <span className="tabular-nums">{formatoMoneda(sumaCombinada)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Por cobrar</span>
                      <span className="tabular-nums">{formatoMoneda(porCobrarCombinado)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cambio</span>
                      <span className="tabular-nums">{formatoMoneda(cambioCombinado)}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {hayCredito || modo === "credito" ? (
                <div className="bg-muted/40 flex flex-col gap-2 rounded-lg p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">Queda a crédito</span>
                    <span className="text-lg font-semibold tabular-nums">{formatoMoneda(credito)}</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {`La factura quedará por cobrar a nombre de ${nombreCliente(contactos, activa.contactoId)}.`}
                  </p>
                  {esConsumidorFinal ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        No se puede vender a crédito al Consumidor Final; selecciona un cliente o cobra el total.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {esConsumidorFinal && !cotizacion ? (
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Cliente para el crédito</Label>
                      <SelectorContacto
                        contactos={contactos}
                        valor={activa.contactoId}
                        onCambio={(contacto) => carrito.setContacto(contacto?.id ?? "")}
                        tipoInicial="cliente"
                        showClear={false}
                      />
                    </div>
                  ) : null}
                  {esConsumidorFinal && cotizacion ? (
                    <p className="text-destructive text-xs">Quita la cotización para cambiar de cliente.</p>
                  ) : null}
                </div>
              ) : null}

              <Button className="h-12 w-full text-base" disabled={ctaDeshabilitado} onClick={() => void cobrar()}>
                {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {enviando ? "Procesando venta…" : etiquetaCta}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmarCierre} onOpenChange={setConfirmarCierre}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>La venta no se ha cobrado. ¿Cerrar el cobro?</DialogTitle>
            <DialogDescription>El carrito se conserva.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmarCierre(false)}>
              Seguir cobrando
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmarCierre(false);
                onCerrar();
              }}
            >
              Cerrar cobro
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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

function nombreCliente(contactos: ContactoBuscado[], id: string): string {
  return contactos.find((contacto) => contacto.id === id)?.nombre ?? "Consumidor Final";
}

function Tile({
  icono,
  titulo,
  cuenta,
  activo,
  motivo,
  onClick,
}: {
  icono: ReactNode;
  titulo: string;
  cuenta: string | null;
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
        "border-border flex min-h-[72px] flex-col items-start gap-1 rounded-lg border p-2 text-left transition-colors",
        activo ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted",
        motivo && "cursor-not-allowed opacity-50",
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {icono}
        {titulo}
      </span>
      <span className="text-muted-foreground text-xs">{cuenta ?? "—"}</span>
    </button>
  );
}
