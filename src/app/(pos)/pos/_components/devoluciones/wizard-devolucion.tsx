"use client";

import { useCallback, useEffect, useState } from "react";

import { cn } from "cn";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { crearDevolucionPOS } from "@/lib/pos/acciones";
import { calcularLineaPOS, centavosATexto, centavosDeDecimal, compararMontos, sumarMontos } from "@/lib/pos/calculo";
import type { DevolucionPOSResultado, PlantillaTicket, TipoReembolsoPOS } from "@/lib/pos/tipos";

import { datosDevolucionPOS } from "../acciones-pos";
import { capitalizar, textoAMonto } from "../formato-pos";
import type { DatosDevolucionPOS } from "../tipos";
import { BuscadorFacturaPos } from "./buscador-factura-pos";
import { ConfirmacionDevolucion } from "./confirmacion-devolucion";

const TIPOS: { value: TipoReembolsoPOS; titulo: string; descripcion: string }[] = [
  {
    value: "credito_factura",
    titulo: "Crédito a factura",
    descripcion: "No sale dinero de la caja. Reduce el saldo de la factura o deja saldo a favor.",
  },
  { value: "efectivo", titulo: "Efectivo", descripcion: "Sale efectivo del cajón de esta terminal." },
  {
    value: "combinado",
    titulo: "Combinado",
    descripcion: "Una parte en efectivo y otra a crédito. Ambas deben ser mayores a cero.",
  },
];

const PASOS = ["Factura y tipo", "Productos y cliente", "Detalle del reembolso"];

function inicializarCantidades(datos: DatosDevolucionPOS): Record<string, string> {
  const cantidades: Record<string, string> = {};
  for (const linea of datos.lineas) cantidades[linea.id] = "0.00";
  return cantidades;
}

export function WizardDevolucion({
  abierto,
  onCerrar,
  terminal,
  cuentaEfectivoNombre,
  turno,
  efectivoEsperado,
  facturaInicial,
  plantilla,
  onCreada,
}: {
  abierto: boolean;
  onCerrar: () => void;
  terminal: { id: string; nombre: string; cuenta_efectivo_id: string };
  cuentaEfectivoNombre: string;
  turno: { id: string; numero: number } | null;
  efectivoEsperado: string;
  facturaInicial: string | null;
  plantilla: PlantillaTicket;
  onCreada: () => void;
}) {
  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState<DatosDevolucionPOS | null>(null);
  const [tipo, setTipo] = useState<TipoReembolsoPOS>("credito_factura");
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [efectivo, setEfectivo] = useState("0.00");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargandoFactura, setCargandoFactura] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<DevolucionPOSResultado | null>(null);
  const [confirmarCierre, setConfirmarCierre] = useState(false);

  const seleccionar = useCallback(async (facturaId: string, saltarAPaso2: boolean) => {
    setCargandoFactura(true);
    setError(null);
    try {
      const respuesta = await datosDevolucionPOS(facturaId);
      if (!respuesta.ok || !respuesta.data) {
        setError(respuesta.ok ? "La factura no existe o está anulada." : capitalizar(respuesta.error));
        return;
      }
      setDatos(respuesta.data);
      setCantidades(inicializarCantidades(respuesta.data));
      setTipo("credito_factura");
      setEfectivo("0.00");
      setNotas("");
      if (saltarAPaso2) setPaso(2);
    } catch {
      setError("La factura no existe o está anulada.");
    } finally {
      setCargandoFactura(false);
    }
  }, []);

  useEffect(() => {
    if (!abierto) return;
    setPaso(1);
    setDatos(null);
    setTipo("credito_factura");
    setCantidades({});
    setEfectivo("0.00");
    setNotas("");
    setError(null);
    setResultado(null);
    if (facturaInicial) void seleccionar(facturaInicial, true);
  }, [abierto, facturaInicial, seleccionar]);

  const lineasOriginales = datos?.lineas ?? [];
  const lineasConDisponible = lineasOriginales.filter((linea) => compararMontos(linea.pendiente, "0") > 0);

  const lineasCalculadas = lineasOriginales.map((linea) => {
    const cantidad = textoAMonto(cantidades[linea.id] ?? "0") ?? "0";
    const excede = compararMontos(cantidad, linea.pendiente) > 0;
    const totales = calcularLineaPOS({
      cantidad,
      precio: linea.precio,
      descuento_pct: linea.descuento_pct,
      itbis_tasa: linea.itbis_tasa,
    });
    return { linea, cantidad, excede, totales };
  });

  const seleccionadas = lineasCalculadas.filter((fila) => compararMontos(fila.cantidad, "0") > 0);
  const totalCalculado = sumarMontos(seleccionadas.map((fila) => fila.totales.total));
  const subtotalCalculado = sumarMontos(seleccionadas.map((fila) => fila.totales.subtotal));
  const itbisCalculado = sumarMontos(seleccionadas.map((fila) => fila.totales.itbis));
  const hayExcedida = lineasCalculadas.some((fila) => fila.excede);

  const maxPagado = datos
    ? centavosATexto(
        Math.max(
          0,
          (centavosDeDecimal(datos.factura.pagado) ?? 0) - (centavosDeDecimal(datos.efectivo_devuelto_previo) ?? 0),
        ),
      )
    : "0.00";
  const maxCaja = efectivoEsperado;
  const efectivoTotalPermitido =
    compararMontos(totalCalculado, maxPagado) <= 0 && compararMontos(totalCalculado, maxCaja) <= 0;

  const efectivoCombinado = textoAMonto(efectivo) ?? "0";
  const combinadoValido =
    compararMontos(efectivoCombinado, "0") > 0 &&
    compararMontos(efectivoCombinado, totalCalculado) < 0 &&
    compararMontos(efectivoCombinado, maxPagado) <= 0 &&
    compararMontos(efectivoCombinado, maxCaja) <= 0;
  const creditoCombinado =
    compararMontos(efectivoCombinado, totalCalculado) < 0
      ? centavosATexto((centavosDeDecimal(totalCalculado) ?? 0) - (centavosDeDecimal(efectivoCombinado) ?? 0))
      : "0.00";

  function puedeContinuar(): boolean {
    if (paso === 1) return datos !== null;
    if (paso === 2) return seleccionadas.length > 0 && !hayExcedida;
    if (paso === 3) {
      if (tipo === "credito_factura") return seleccionadas.length > 0;
      if (tipo === "efectivo") return efectivoTotalPermitido && seleccionadas.length > 0;
      return combinadoValido;
    }
    return false;
  }

  async function crear() {
    if (!datos || !turno) return;
    if (tipo === "efectivo" && !efectivoTotalPermitido) {
      setError("El reembolso en efectivo no puede exceder lo pagado ni el efectivo de la caja.");
      return;
    }
    if (tipo === "combinado" && !combinadoValido) {
      setError("El reembolso combinado requiere efectivo y crédito mayores a cero.");
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      const respuesta = await crearDevolucionPOS({
        terminal_id: terminal.id,
        factura_id: datos.factura.id,
        turno_id: turno.id,
        lineas: seleccionadas.map((fila) => ({
          factura_linea_id: fila.linea.id,
          cantidad: fila.cantidad,
        })),
        tipo_reembolso: tipo,
        ...(tipo === "credito_factura"
          ? {}
          : { monto_reembolso_efectivo: tipo === "efectivo" ? totalCalculado : efectivoCombinado }),
        ...(tipo === "credito_factura" ? {} : { cuenta_reembolso_id: terminal.cuenta_efectivo_id }),
        ...(notas.trim() ? { notas: notas.trim() } : {}),
      });

      if (!respuesta.ok) {
        setError(capitalizar(respuesta.error));
        return;
      }

      setResultado(respuesta.data);
      toast.add({ type: "success", title: "Devolución creada." });
      onCreada();
    } catch {
      setError("No sabemos si la devolución se registró. Revisa la lista antes de repetirla.");
    } finally {
      setEnviando(false);
    }
  }

  function intentarCerrar() {
    if (resultado) {
      cerrar();
      return;
    }
    if (datos || seleccionadas.length > 0) {
      setConfirmarCierre(true);
      return;
    }
    cerrar();
  }

  function cerrar() {
    setConfirmarCierre(false);
    onCerrar();
  }

  return (
    <>
      <Dialog open={abierto} onOpenChange={(nuevo) => (nuevo ? null : intentarCerrar())}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[960px]">
          {resultado ? (
            <ConfirmacionDevolucion
              resultado={resultado}
              plantilla={plantilla}
              onNueva={() => {
                setResultado(null);
                setDatos(null);
                setPaso(1);
                setCantidades({});
                setTipo("credito_factura");
                setEfectivo("0.00");
                setNotas("");
              }}
              onCerrar={cerrar}
            />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Nueva devolución</DialogTitle>
                <DialogDescription>
                  {turno ? `${terminal.nombre} · Turno No ${turno.numero}` : terminal.nombre}
                </DialogDescription>
              </DialogHeader>

              <ol className="flex flex-wrap items-center gap-2">
                {PASOS.map((etiqueta, indice) => {
                  const numero = indice + 1;
                  return (
                    <li
                      key={etiqueta}
                      aria-current={paso === numero ? "step" : undefined}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm",
                        paso === numero ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground",
                      )}
                    >
                      <span className="border-border flex size-5 items-center justify-center rounded-full border text-xs">
                        {numero}
                      </span>
                      {etiqueta}
                    </li>
                  );
                })}
              </ol>

              {turno === null ? (
                <Alert variant="destructive">
                  <AlertDescription>No hay un turno abierto. Abre un turno para devolver.</AlertDescription>
                </Alert>
              ) : null}

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {paso === 1 ? (
                <div className="flex flex-col gap-3">
                  {datos ? (
                    <div className="bg-muted/40 flex flex-col gap-1 rounded-lg p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{datos.factura.ncf ?? `Factura No ${datos.factura.numero}`}</span>
                        <Button variant="ghost" size="sm" onClick={() => setDatos(null)}>
                          Cambiar factura
                        </Button>
                      </div>
                      <span className="text-muted-foreground">{datos.factura.cliente_nombre}</span>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <span>Fecha {formatoDia(datos.factura.fecha)}</span>
                        <span>Total {formatoMoneda(datos.factura.total)}</span>
                        <span>Pagado {formatoMoneda(datos.factura.pagado)}</span>
                        <span>Crédito {formatoMoneda(datos.factura.credito)}</span>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {datos.lineas.length === 1 ? "1 línea" : `${datos.lineas.length} líneas`}
                      </span>
                    </div>
                  ) : (
                    <BuscadorFacturaPos
                      onSeleccionar={(factura) => void seleccionar(factura.id, false)}
                      placeholder="Buscar la factura por NCF, número o cliente…"
                    />
                  )}

                  {cargandoFactura ? (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Loader2 className="animate-spin" aria-hidden="true" />
                      Cargando factura…
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {TIPOS.map((opcion) => (
                      <button
                        key={opcion.value}
                        type="button"
                        aria-pressed={tipo === opcion.value}
                        className={cn(
                          "border-border hover:bg-muted flex min-h-24 flex-col items-start gap-1 rounded-lg border p-3 text-left",
                          tipo === opcion.value && "border-primary bg-primary/5",
                        )}
                        onClick={() => setTipo(opcion.value)}
                      >
                        <span className="text-sm font-medium">{opcion.titulo}</span>
                        <span className="text-muted-foreground text-xs">{opcion.descripcion}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {paso === 2 && datos ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{datos.factura.cliente_nombre}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCantidades(Object.fromEntries(datos.lineas.map((linea) => [linea.id, linea.pendiente])))
                      }
                    >
                      Devolver todo
                    </Button>
                  </div>

                  {lineasConDisponible.length === 0 ? (
                    <div className="border-border rounded-lg border px-4 py-8 text-center">
                      <p className="font-medium">Esta factura ya fue devuelta por completo.</p>
                    </div>
                  ) : (
                    <div className="border-border overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead className="text-right">Cantidad original</TableHead>
                            <TableHead className="text-right">Devuelta</TableHead>
                            <TableHead className="text-right">Disponible</TableHead>
                            <TableHead className="text-right">Cantidad a devolver</TableHead>
                            <TableHead className="text-right">Precio</TableHead>
                            <TableHead className="text-right">ITBIS</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lineasCalculadas.map(({ linea, cantidad, excede, totales }) => {
                            const devuelta = centavosATexto(
                              (centavosDeDecimal(linea.cantidad) ?? 0) - (centavosDeDecimal(linea.pendiente) ?? 0),
                            );
                            if (compararMontos(linea.pendiente, "0") <= 0) return null;
                            return (
                              <TableRow key={linea.id}>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="text-sm">{linea.descripcion}</span>
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="h-6 w-fit px-0 text-xs"
                                      onClick={() =>
                                        setCantidades((actuales) => ({ ...actuales, [linea.id]: linea.pendiente }))
                                      }
                                    >
                                      Devolver todo
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatoCantidad(linea.cantidad)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{formatoCantidad(devuelta)}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatoCantidad(linea.pendiente)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    value={cantidad}
                                    inputMode="decimal"
                                    aria-label={`Cantidad a devolver de ${linea.descripcion}`}
                                    aria-invalid={excede}
                                    className="h-10 w-24 text-right"
                                    onChange={(evento) =>
                                      setCantidades((actuales) => ({ ...actuales, [linea.id]: evento.target.value }))
                                    }
                                  />
                                  {excede ? (
                                    <p className="text-destructive text-xs">
                                      {`La cantidad no puede superar lo disponible por acreditar (${formatoCantidad(
                                        linea.pendiente,
                                      )}).`}
                                    </p>
                                  ) : null}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{formatoMoneda(linea.precio)}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatoMoneda(totales.itbis)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatoMoneda(totales.total)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <div className="bg-muted/40 ml-auto flex w-full max-w-xs flex-col gap-1 rounded-lg p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="tabular-nums">{formatoMoneda(subtotalCalculado)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ITBIS</span>
                      <span className="tabular-nums">{formatoMoneda(itbisCalculado)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 font-semibold">
                      <span>Total</span>
                      <span className="tabular-nums">{formatoMoneda(totalCalculado)}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {paso === 3 && datos ? (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {TIPOS.map((opcion) => {
                      const bloqueado = opcion.value === "efectivo" && !efectivoTotalPermitido;
                      return (
                        <button
                          key={opcion.value}
                          type="button"
                          aria-pressed={tipo === opcion.value}
                          title={
                            bloqueado
                              ? "El total supera lo pagado o el efectivo de la caja. Elige Combinado o Crédito a factura."
                              : undefined
                          }
                          disabled={bloqueado}
                          className={cn(
                            "border-border hover:bg-muted flex min-h-24 flex-col items-start gap-1 rounded-lg border p-3 text-left",
                            tipo === opcion.value && "border-primary bg-primary/5",
                            bloqueado && "cursor-not-allowed opacity-50",
                          )}
                          onClick={() => setTipo(opcion.value)}
                        >
                          <span className="text-sm font-medium">{opcion.titulo}</span>
                          <span className="text-muted-foreground text-xs">{opcion.descripcion}</span>
                        </button>
                      );
                    })}
                  </div>

                  {tipo === "credito_factura" ? (
                    <div className="bg-muted/40 flex flex-col gap-1 rounded-lg p-3 text-sm">
                      <p>{`Se acreditarán ${formatoMoneda(totalCalculado)} a la factura ${
                        datos.factura.ncf ?? `No ${datos.factura.numero}`
                      }.`}</p>
                      <p className="text-muted-foreground text-xs">
                        El cliente quedará con saldo a favor si la factura ya estaba pagada.
                      </p>
                    </div>
                  ) : null}

                  {tipo === "efectivo" ? (
                    <div className="bg-muted/40 flex flex-col gap-1 rounded-lg p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monto</span>
                        <span className="font-semibold tabular-nums">{formatoMoneda(totalCalculado)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cuenta</span>
                        <span>{cuentaEfectivoNombre}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Máximo por lo pagado</span>
                        <span className="tabular-nums">{formatoMoneda(maxPagado)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Máximo por la caja</span>
                        <span className="tabular-nums">{formatoMoneda(maxCaja)}</span>
                      </div>
                      {!efectivoTotalPermitido ? (
                        <p className="text-destructive text-xs">
                          El total supera lo pagado o el efectivo de la caja. Elige Combinado o Crédito a factura.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {tipo === "combinado" ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="bg-muted/40 flex flex-col gap-2 rounded-lg p-3">
                        <span className="text-sm font-medium">Efectivo</span>
                        <InputGroup className="h-10">
                          <InputGroupAddon>
                            <InputGroupText>RD$</InputGroupText>
                          </InputGroupAddon>
                          <InputGroupInput
                            value={efectivo}
                            inputMode="decimal"
                            aria-label="Efectivo del reembolso combinado"
                            onChange={(evento) => setEfectivo(evento.target.value)}
                          />
                        </InputGroup>
                        <span className="text-muted-foreground text-xs">Cuenta {cuentaEfectivoNombre}</span>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Máximo por lo pagado</span>
                          <span className="tabular-nums">{formatoMoneda(maxPagado)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Máximo por la caja</span>
                          <span className="tabular-nums">{formatoMoneda(maxCaja)}</span>
                        </div>
                      </div>
                      <div className="bg-muted/40 flex flex-col gap-2 rounded-lg p-3">
                        <span className="text-sm font-medium">Crédito a factura</span>
                        <span className="text-lg font-semibold tabular-nums">{formatoMoneda(creditoCombinado)}</span>
                        <span className="text-muted-foreground text-xs">
                          {`Factura ${datos.factura.ncf ?? `No ${datos.factura.numero}`}`}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          Queda como saldo a favor en la cuenta por cobrar.
                        </span>
                      </div>
                      {!combinadoValido ? (
                        <p className="text-destructive text-xs sm:col-span-2">
                          El reembolso combinado requiere efectivo y crédito mayores a cero, sin pasar los máximos.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="notas-devolucion">Notas</Label>
                    <Textarea
                      id="notas-devolucion"
                      value={notas}
                      maxLength={500}
                      onChange={(evento) => setNotas(evento.target.value)}
                    />
                  </div>

                  <div className="bg-muted/40 flex flex-col gap-1 rounded-lg p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="tabular-nums">{formatoMoneda(subtotalCalculado)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ITBIS</span>
                      <span className="tabular-nums">{formatoMoneda(itbisCalculado)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span className="tabular-nums">{formatoMoneda(totalCalculado)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Efectivo</span>
                      <span className="tabular-nums">
                        {formatoMoneda(
                          tipo === "credito_factura" ? "0" : tipo === "efectivo" ? totalCalculado : efectivoCombinado,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Crédito</span>
                      <span className="tabular-nums">
                        {formatoMoneda(
                          tipo === "credito_factura" ? totalCalculado : tipo === "efectivo" ? "0" : creditoCombinado,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Cuenta</span>
                      <span>{tipo === "credito_factura" ? "—" : cuentaEfectivoNombre}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <Button
                  variant="ghost"
                  disabled={paso === 1}
                  onClick={() => setPaso((actual) => Math.max(1, actual - 1))}
                >
                  Atrás
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={intentarCerrar} disabled={enviando}>
                    Cancelar
                  </Button>
                  {paso < 3 ? (
                    <Button
                      className="h-12"
                      disabled={!puedeContinuar() || cargandoFactura}
                      onClick={() => setPaso((actual) => Math.min(3, actual + 1))}
                    >
                      Continuar
                    </Button>
                  ) : (
                    <Button
                      className="h-12"
                      disabled={!puedeContinuar() || enviando || turno === null}
                      onClick={() => void crear()}
                    >
                      {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                      {enviando ? "Creando devolución…" : "Crear devolución"}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarCierre} onOpenChange={setConfirmarCierre}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar la devolución?</AlertDialogTitle>
            <AlertDialogDescription>Se perderá lo que llevas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={cerrar}>
              Cerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
