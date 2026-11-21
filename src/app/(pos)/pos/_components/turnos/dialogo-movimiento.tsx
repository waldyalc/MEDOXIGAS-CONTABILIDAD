"use client";

import { useEffect, useMemo, useState } from "react";

import { Loader2 } from "@/components/icons";
import { SelectCampo } from "@/components/select-campo";
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
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { registrarMovimientoTurno } from "@/lib/pos/acciones";
import { calcularLineaPOS, compararMontos, sumarMontos } from "@/lib/pos/calculo";
import type {
  MotivoMovimientoPOS,
  MovimientoTurnoPOSResultado,
  ResumenTurno,
  TipoMovimientoPOS,
} from "@/lib/pos/tipos";

import { BuscadorFacturaPos } from "../devoluciones/buscador-factura-pos";
import { capitalizar, textoAMonto } from "../formato-pos";
import type { CuentaPOS } from "../servidor";
import type { FacturaCandidataPOS } from "../tipos";

export interface PrellenadoMovimiento {
  tipo: TipoMovimientoPOS;
  motivo: MotivoMovimientoPOS;
  monto: string;
  notas: string;
}

const MOTIVOS_INGRESO = [
  { value: "fondo_caja", label: "Fondo de caja" },
  { value: "cobro_factura", label: "Cobro de factura" },
  { value: "otro", label: "Otro ingreso" },
] as const;

const MOTIVOS_RETIRO = [
  { value: "retiro_caja", label: "Retiro de caja" },
  { value: "gasto_menor", label: "Gasto menor" },
  { value: "deposito_banco", label: "Depósito al banco" },
  { value: "otro", label: "Otro retiro" },
] as const;

function opcionesCuenta(cuentas: CuentaPOS[], soloBanco: boolean) {
  return cuentas
    .filter((cuenta) => (soloBanco ? cuenta.es_caja_banco : true))
    .map((cuenta) => ({ value: cuenta.id, label: `${cuenta.codigo} · ${cuenta.nombre}` }));
}

export function DialogoMovimiento({
  abierto,
  onCerrar,
  turnoId,
  resumen,
  cuentas,
  cuentaEfectivoId,
  prellenado,
  onRegistrado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  turnoId: string;
  resumen: ResumenTurno;
  cuentas: CuentaPOS[];
  cuentaEfectivoId: string;
  prellenado: PrellenadoMovimiento | null;
  onRegistrado: (datos: MovimientoTurnoPOSResultado) => void;
}) {
  const [tipo, setTipo] = useState<TipoMovimientoPOS>("ingreso");
  const [motivo, setMotivo] = useState<MotivoMovimientoPOS>("fondo_caja");
  const [monto, setMonto] = useState("");
  const [cuenta, setCuenta] = useState("");
  const [notas, setNotas] = useState("");
  const [factura, setFactura] = useState<FacturaCandidataPOS | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [cuentaGasto, setCuentaGasto] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [itbisTasa, setItbisTasa] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setTipo(prellenado?.tipo ?? "ingreso");
    setMotivo(prellenado?.motivo ?? "fondo_caja");
    setMonto(prellenado?.monto ?? "");
    setNotas(prellenado?.notas ?? "");
    setCuenta("");
    setFactura(null);
    setDescripcion("");
    setCuentaGasto("");
    setSubtotal("");
    setItbisTasa("0");
    setError(null);
  }, [abierto, prellenado]);

  const motivos = tipo === "ingreso" ? MOTIVOS_INGRESO : MOTIVOS_RETIRO;
  const esGasto = motivo === "gasto_menor";
  const esCobro = motivo === "cobro_factura";
  const esDeposito = motivo === "deposito_banco";
  const requiereCuenta = !esGasto && !esCobro;

  const totalGasto = calcularLineaPOS({
    cantidad: "1",
    precio: textoAMonto(subtotal) ?? "0",
    descuento_pct: "0",
    itbis_tasa: itbisTasa,
  }).total;

  const montoFinal = esGasto ? totalGasto : (textoAMonto(monto) ?? "0");
  const montoValido = compararMontos(montoFinal, "0") > 0;
  const maxCobro = factura?.saldo ?? "0";
  const cobroExcede = esCobro && compararMontos(montoFinal, maxCobro) > 0;
  const esperadoDespues = sumarMontos([
    resumen.efectivo.efectivo_esperado,
    tipo === "ingreso" ? montoFinal : `-${montoFinal}`,
  ]);
  const dejaNegativo = tipo === "retiro" && compararMontos(esperadoDespues, "0") < 0;

  const cuentasMovimiento = useMemo(
    () => opcionesCuenta(cuentas, esDeposito).filter((opcion) => opcion.value !== cuentaEfectivoId),
    [cuentas, esDeposito, cuentaEfectivoId],
  );
  const cuentasGasto = useMemo(
    () =>
      cuentas
        .filter((cuenta) => cuenta.tipo === "gasto" || cuenta.tipo === "costo")
        .map((cuenta) => ({ value: cuenta.id, label: `${cuenta.codigo} · ${cuenta.nombre}` })),
    [cuentas],
  );

  function cambiarTipo(nuevo: string | null) {
    const siguiente: TipoMovimientoPOS = nuevo === "retiro" ? "retiro" : "ingreso";
    setTipo(siguiente);
    setMotivo(siguiente === "ingreso" ? "fondo_caja" : "retiro_caja");
    setFactura(null);
    setError(null);
  }

  async function registrar() {
    if (!montoValido) {
      setError("El monto del movimiento debe ser mayor a cero.");
      return;
    }
    if (esCobro && !factura) {
      setError("Selecciona la factura que se está cobrando.");
      return;
    }
    if (esCobro && cobroExcede) {
      setError("El monto del cobro no puede superar el saldo de la factura.");
      return;
    }
    if (requiereCuenta && cuenta === "") {
      setError("La cuenta de contrapartida es obligatoria.");
      return;
    }
    if (esGasto && (cuentaGasto === "" || descripcion.trim() === "" || !textoAMonto(subtotal))) {
      setError("Completa la descripción, la cuenta de gasto y el subtotal.");
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      const resultado = await registrarMovimientoTurno({
        turno_id: turnoId,
        tipo,
        motivo,
        monto: montoFinal,
        ...(requiereCuenta && cuenta ? { cuenta_contrapartida_id: cuenta } : {}),
        ...(esCobro && factura ? { factura_id: factura.id } : {}),
        ...(esGasto
          ? {
              cuenta_gasto_id: cuentaGasto,
              subtotal: textoAMonto(subtotal) ?? "0",
              itbis_tasa: itbisTasa,
              descripcion: descripcion.trim(),
            }
          : {}),
        ...(notas.trim() ? { notas: notas.trim() } : {}),
      });

      if (!resultado.ok) {
        setError(capitalizar(resultado.error));
        return;
      }

      onRegistrado(resultado.data);
      onCerrar();
    } catch {
      setError("No sabemos si el movimiento se registró. Revisa los movimientos del turno antes de repetirlo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(nuevo) => (nuevo ? null : onCerrar())}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
          <DialogDescription>Ingreso o retiro de efectivo del turno.</DialogDescription>
        </DialogHeader>

        <Tabs value={tipo} onValueChange={cambiarTipo}>
          <TabsList variant="line">
            <TabsTrigger value="ingreso">Ingreso</TabsTrigger>
            <TabsTrigger value="retiro">Retiro</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="motivo-movimiento">Motivo</Label>
            <Select
              items={motivos.map((opcion) => ({ value: opcion.value, label: opcion.label }))}
              value={motivo}
              onValueChange={(valor) => {
                if (!valor) return;
                setMotivo(valor as MotivoMovimientoPOS);
                setFactura(null);
                setError(null);
              }}
            >
              <SelectTrigger id="motivo-movimiento" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {motivos.map((opcion) => (
                  <SelectItem key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {esCobro ? (
            factura ? (
              <div className="bg-muted/40 flex flex-col gap-1 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{factura.ncf ?? `Factura No ${factura.numero}`}</span>
                  <Button variant="ghost" size="sm" onClick={() => setFactura(null)}>
                    Cambiar
                  </Button>
                </div>
                <span className="text-muted-foreground">{factura.cliente_nombre}</span>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span>Total {formatoMoneda(factura.total)}</span>
                  <span>Pagado {formatoMoneda(factura.pagado)}</span>
                  <span className="font-medium">Saldo {formatoMoneda(factura.saldo)}</span>
                </div>
              </div>
            ) : (
              <BuscadorFacturaPos
                soloConSaldo
                onSeleccionar={(seleccionada) => {
                  setFactura(seleccionada);
                  setMonto(seleccionada.saldo);
                }}
              />
            )
          ) : null}

          {esGasto ? (
            <>
              <div className="flex flex-col gap-1">
                <Label htmlFor="gasto-descripcion">Descripción</Label>
                <Input
                  id="gasto-descripcion"
                  value={descripcion}
                  maxLength={200}
                  onChange={(evento) => setDescripcion(evento.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="gasto-cuenta">Cuenta de gasto</Label>
                <SelectCampo
                  id="gasto-cuenta"
                  opciones={cuentasGasto}
                  valor={cuentaGasto}
                  onCambio={setCuentaGasto}
                  etiquetaVacia="Selecciona la cuenta…"
                  buscable
                  requerido
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="gasto-subtotal">Subtotal</Label>
                  <InputGroup className="h-10">
                    <InputGroupAddon>
                      <InputGroupText>RD$</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="gasto-subtotal"
                      value={subtotal}
                      inputMode="decimal"
                      onChange={(evento) => setSubtotal(evento.target.value)}
                    />
                  </InputGroup>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="gasto-itbis">ITBIS</Label>
                  <InputGroup className="h-10">
                    <InputGroupInput
                      id="gasto-itbis"
                      value={itbisTasa}
                      inputMode="decimal"
                      onChange={(evento) => setItbisTasa(evento.target.value)}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>%</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </div>
              </div>
              <div className="bg-muted/40 flex items-center justify-between rounded-lg px-3 py-2 text-sm">
                <span>Total</span>
                <span className="font-semibold tabular-nums">{formatoMoneda(totalGasto)}</span>
              </div>
            </>
          ) : null}

          {!esGasto ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="monto-movimiento">{esCobro ? "Monto del cobro" : "Monto"}</Label>
              <InputGroup className="h-10">
                <InputGroupAddon>
                  <InputGroupText>RD$</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="monto-movimiento"
                  value={monto}
                  inputMode="decimal"
                  aria-invalid={cobroExcede}
                  onChange={(evento) => setMonto(evento.target.value)}
                />
              </InputGroup>
              {cobroExcede ? (
                <p className="text-destructive text-xs">El cobro no puede superar el saldo de la factura.</p>
              ) : null}
            </div>
          ) : null}

          {requiereCuenta ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="cuenta-movimiento">Cuenta de contrapartida</Label>
              <SelectCampo
                id="cuenta-movimiento"
                opciones={cuentasMovimiento}
                valor={cuenta}
                onCambio={setCuenta}
                etiquetaVacia="Selecciona la cuenta…"
                buscable
                requerido
              />
              {esDeposito && cuentasMovimiento.length === 0 ? (
                <p className="text-destructive text-xs">
                  Para depositar al banco, la cuenta de destino debe ser de caja o banco.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <Label htmlFor="notas-movimiento">Notas</Label>
            <Textarea
              id="notas-movimiento"
              value={notas}
              maxLength={500}
              onChange={(evento) => setNotas(evento.target.value)}
            />
          </div>

          <div className="border-border flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span className="text-muted-foreground">Efectivo esperado después</span>
            <span className="font-semibold tabular-nums">{formatoMoneda(esperadoDespues)}</span>
          </div>

          {dejaNegativo ? (
            <Alert variant="destructive">
              <AlertDescription>El retiro deja la caja en negativo.</AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button className="h-12" disabled={enviando || dejaNegativo || !montoValido} onClick={() => void registrar()}>
            {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {enviando ? "Registrando…" : tipo === "ingreso" ? "Registrar ingreso" : "Registrar retiro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
