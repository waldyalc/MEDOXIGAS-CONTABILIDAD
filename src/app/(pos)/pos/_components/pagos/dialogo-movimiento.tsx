"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "cn";

import { SelectorContacto } from "@/components/contactos/selector-contacto";
import { ArrowLeft, CircleArrowDown, CircleArrowUp, Loader2, Wallet, X } from "@/components/icons";
import { SelectCampo } from "@/components/select-campo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { registrarMovimientoTurno } from "@/lib/pos/acciones";
import { compararMontos, sumarMontos } from "@/lib/pos/calculo";
import type {
  MotivoMovimientoPOS,
  MovimientoTurnoPOSResultado,
  ResumenTurno,
  TipoMovimientoPOS,
} from "@/lib/pos/tipos";

import { capitalizar, formatoMonedaPOS, textoAMonto } from "../formato-pos";
import type { CuentaPOS } from "../servidor";

export interface PrellenadoMovimiento {
  tipo: TipoMovimientoPOS;
  motivo: MotivoMovimientoPOS;
  monto: string;
  notas: string;
}

type Paso = "tipo" | "formulario";
type PestanaEgreso = "gastos" | "factura";

function opcionesCuenta(cuentas: CuentaPOS[]) {
  return cuentas.map((cuenta) => ({ value: cuenta.id, label: `${cuenta.codigo} · ${cuenta.nombre}` }));
}

/** Payload de la RPC existente, sin campos nuevos (el formulario de Alegra no muestra ITBIS). */
function armarMovimiento({
  turnoId,
  tipo,
  esGasto,
  monto,
  cuenta,
  cuentaGasto,
  contactoId,
  notas,
}: {
  turnoId: string;
  tipo: TipoMovimientoPOS;
  esGasto: boolean;
  monto: string;
  cuenta: string;
  cuentaGasto: string;
  contactoId: string;
  notas: string;
}) {
  const notasLimpias = notas.trim();

  return {
    turno_id: turnoId,
    tipo,
    motivo: esGasto ? ("gasto_menor" as const) : ("otro" as const),
    monto,
    ...(esGasto
      ? {
          cuenta_gasto_id: cuentaGasto,
          subtotal: monto,
          itbis_tasa: "0",
          descripcion: (notasLimpias || "Gasto de caja del POS").slice(0, 200),
        }
      : { cuenta_contrapartida_id: cuenta }),
    ...(contactoId ? { contacto_id: contactoId } : {}),
    ...(notasLimpias ? { notas: notasLimpias } : {}),
  };
}

function EtiquetaObligatoria({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <Label htmlFor={htmlFor} className="text-pos-texto text-sm font-medium">
      {children}
      <span aria-hidden="true" className="text-pos-primario ml-0.5">
        *
      </span>
    </Label>
  );
}

/**
 * «Nuevo pago» del POS (PLAN POS 2, Punto 5): primero la tarjeta de tipo
 * (Ingreso verde / Egreso rojo) y después el formulario de Alegra. Todo se
 * mapea a la RPC existente `pos_registrar_movimiento_turno`:
 * - Ingreso y el retiro prellenado por «Inverso» → motivo `otro`.
 * - Egreso → Gastos generales → `gasto_menor` (ITBIS 0, como Alegra).
 * - Pago a factura de proveedor todavía no tiene puente al POS.
 */
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
  const [paso, setPaso] = useState<Paso>("tipo");
  const [tipo, setTipo] = useState<TipoMovimientoPOS>("ingreso");
  const [pestana, setPestana] = useState<PestanaEgreso>("gastos");
  const [monto, setMonto] = useState("");
  const [cuenta, setCuenta] = useState("");
  const [cuentaGasto, setCuentaGasto] = useState("");
  const [contactoId, setContactoId] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setPaso(prellenado ? "formulario" : "tipo");
    setTipo(prellenado?.tipo ?? "ingreso");
    setPestana("gastos");
    setMonto(prellenado?.monto ?? "");
    setNotas(prellenado?.notas ?? "");
    setCuenta("");
    setCuentaGasto("");
    setContactoId("");
    setError(null);
  }, [abierto, prellenado]);

  const enFormulario = paso === "formulario";
  const esIngreso = tipo === "ingreso";
  const esGasto = tipo === "retiro" && prellenado === null;
  const esFacturaProveedor = esGasto && pestana === "factura";
  const mostrarFormulario = enFormulario && !esFacturaProveedor;

  const montoFinal = textoAMonto(monto) ?? "0";
  const montoValido = compararMontos(montoFinal, "0") > 0;
  const esperadoDespues = sumarMontos([resumen.efectivo.efectivo_esperado, esIngreso ? montoFinal : `-${montoFinal}`]);
  const dejaNegativo = !esIngreso && montoValido && compararMontos(esperadoDespues, "0") < 0;

  const cuentasGasto = useMemo(
    () =>
      cuentas
        .filter((cuenta) => cuenta.tipo === "gasto" || cuenta.tipo === "costo")
        .map((cuenta) => ({ value: cuenta.id, label: `${cuenta.codigo} · ${cuenta.nombre}` })),
    [cuentas],
  );
  const cuentasContrapartida = useMemo(
    () => opcionesCuenta(cuentas.filter((cuenta) => cuenta.id !== cuentaEfectivoId)),
    [cuentas, cuentaEfectivoId],
  );

  const cuentaElegida = esGasto ? cuentaGasto : cuenta;
  const puedeRegistrar = montoValido && cuentaElegida !== "" && !dejaNegativo && !enviando;

  function etiquetaAccion() {
    if (esIngreso) return "Registrar ingreso";
    if (esGasto) return "Registrar pago";
    return "Registrar retiro";
  }

  function elegirTipo(nuevo: TipoMovimientoPOS) {
    setTipo(nuevo);
    setPaso("formulario");
    setPestana("gastos");
    setCuenta("");
    setCuentaGasto("");
    setContactoId("");
    setError(null);
  }

  function volver() {
    setPaso("tipo");
    setError(null);
  }

  async function registrar() {
    if (esFacturaProveedor) return;
    if (!montoValido) {
      setError("El total a pagar debe ser mayor a cero.");
      return;
    }
    if (cuentaElegida === "") {
      setError("La cuenta contable es obligatoria.");
      return;
    }
    if (dejaNegativo) {
      setError("El egreso deja la caja en negativo.");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const resultado = await registrarMovimientoTurno(
        armarMovimiento({ turnoId, tipo, esGasto, monto: montoFinal, cuenta, cuentaGasto, contactoId, notas }),
      );

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
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[92dvh] w-full flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-[800px]"
      >
        {paso === "tipo" ? (
          <>
            <header className="border-pos-linea flex h-[60px] shrink-0 items-center border-b px-5">
              <DialogTitle className="text-pos-texto font-heading text-xl leading-7 font-semibold">
                Nuevo pago
              </DialogTitle>
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-pos-icono hover:text-pos-texto ml-auto"
                  />
                }
              >
                <X aria-hidden="true" />
                <span className="sr-only">Cerrar</span>
              </DialogClose>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-14">
              <DialogDescription className="text-pos-texto text-base">
                Selecciona el tipo de movimiento que vas a registrar.
              </DialogDescription>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => elegirTipo("ingreso")}
                  className="focus-visible:ring-pos-primario flex min-h-[250px] flex-col items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white transition-colors outline-none hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-offset-2 max-sm:min-h-[150px]"
                >
                  <CircleArrowDown className="size-6" aria-hidden="true" />
                  <span className="text-base font-medium">Ingreso</span>
                </button>
                <button
                  type="button"
                  onClick={() => elegirTipo("retiro")}
                  className="focus-visible:ring-pos-primario flex min-h-[250px] flex-col items-center justify-center gap-2 rounded-lg bg-rose-600 text-white transition-colors outline-none hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-offset-2 max-sm:min-h-[150px]"
                >
                  <CircleArrowUp className="size-6" aria-hidden="true" />
                  <span className="text-base font-medium">Egreso</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <header className="border-pos-linea flex h-20 shrink-0 items-center gap-1 border-b px-5">
              {prellenado === null ? (
                <Button type="button" variant="ghost" size="icon" className="text-pos-texto -ml-2" onClick={volver}>
                  <ArrowLeft aria-hidden="true" />
                  <span className="sr-only">Volver</span>
                </Button>
              ) : null}
              <DialogTitle className="text-pos-texto font-heading text-xl leading-7 font-semibold">
                Nuevo pago
              </DialogTitle>
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-pos-icono hover:text-pos-texto ml-auto"
                  />
                }
              >
                <X aria-hidden="true" />
                <span className="sr-only">Cerrar</span>
              </DialogClose>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-6">
              <DialogDescription className="sr-only">
                Registra un ingreso o egreso de efectivo del turno abierto.
              </DialogDescription>

              {esGasto ? (
                <div
                  role="tablist"
                  aria-label="Tipo de egreso"
                  className="bg-muted border-pos-linea flex h-12 rounded-lg border p-1"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={pestana === "gastos"}
                    onClick={() => setPestana("gastos")}
                    className={cn(
                      "text-pos-texto-suave hover:text-pos-texto flex-1 rounded-md text-sm font-semibold transition-colors",
                      pestana === "gastos" && "text-pos-texto bg-card shadow-sm dark:bg-white/10",
                    )}
                  >
                    Gastos generales
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={pestana === "factura"}
                    onClick={() => setPestana("factura")}
                    className={cn(
                      "text-pos-texto-suave hover:text-pos-texto flex-1 rounded-md text-sm font-semibold transition-colors",
                      pestana === "factura" && "text-pos-texto bg-card shadow-sm dark:bg-white/10",
                    )}
                  >
                    Pago a factura de proveedor
                  </button>
                </div>
              ) : null}

              {esFacturaProveedor ? (
                <div className="border-pos-linea bg-pos-panel mt-4 rounded-lg border p-5">
                  <p className="text-pos-texto text-base font-semibold">No disponible en el POS todavía</p>
                  <p className="text-pos-texto-suave mt-2 text-sm">
                    Pagar una factura de proveedor desde la caja necesita guardar el turno y el movimiento en el pago.
                    Esa conexión todavía no existe. Por ahora, regístralo en Compras → Pagos.
                  </p>
                </div>
              ) : null}

              {mostrarFormulario ? (
                <form
                  id="formulario-movimiento-pos"
                  className={cn("flex flex-col gap-4", esGasto && "mt-6")}
                  onSubmit={(evento) => {
                    evento.preventDefault();
                    void registrar();
                  }}
                >
                  <div className="grid gap-x-2.5 gap-y-5 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="pago-contacto" className="text-pos-texto text-sm font-medium">
                        {esIngreso ? "Cliente" : "Proveedor"}
                      </Label>
                      <SelectorContacto
                        id="pago-contacto"
                        contactos={[]}
                        valor={contactoId}
                        onCambio={(contacto) => setContactoId(contacto?.id ?? "")}
                        tipoInicial={esIngreso ? "cliente" : "proveedor"}
                        placeholder="Seleccionar"
                        className="bg-card has-[[data-slot=input-group-control]:focus-visible]:border-pos-primario has-[[data-slot=input-group-control]:focus-visible]:ring-pos-primario/30 h-12 w-full rounded-[10px] text-base"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="pago-metodo" className="text-pos-texto text-sm font-medium">
                        Método de pago
                        <span aria-hidden="true" className="text-pos-primario ml-0.5">
                          *
                        </span>
                      </Label>
                      <output
                        id="pago-metodo"
                        aria-label="Método de pago: Efectivo, el único disponible en el turno"
                        className="border-input bg-card text-pos-texto flex h-12 items-center justify-between gap-2 rounded-[10px] border px-3 text-base"
                      >
                        <span className="flex items-center gap-2">
                          <Wallet className="text-pos-icono size-4" aria-hidden="true" />
                          Efectivo
                        </span>
                        <span className="text-pos-texto-suave text-xs">Solo efectivo</span>
                      </output>
                    </div>

                    <div className="flex flex-col gap-2">
                      <EtiquetaObligatoria htmlFor="pago-cuenta">Cuenta contable</EtiquetaObligatoria>
                      <SelectCampo
                        id="pago-cuenta"
                        opciones={esGasto ? cuentasGasto : cuentasContrapartida}
                        valor={esGasto ? cuentaGasto : cuenta}
                        onCambio={esGasto ? setCuentaGasto : setCuenta}
                        etiquetaVacia="Seleccionar"
                        buscable
                        requerido
                        className="bg-card focus-visible:border-pos-primario focus-visible:ring-pos-primario/30 h-12 w-full rounded-[10px] text-base"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <EtiquetaObligatoria htmlFor="pago-total">
                        {esIngreso ? "Total" : "Total a pagar"}
                      </EtiquetaObligatoria>
                      <InputGroup className="bg-card has-[[data-slot=input-group-control]:focus-visible]:border-pos-primario has-[[data-slot=input-group-control]:focus-visible]:ring-pos-primario/30 h-12 rounded-[10px]">
                        <InputGroupAddon>
                          <InputGroupText className="text-pos-texto-suave">RD$</InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                          id="pago-total"
                          value={monto}
                          inputMode="decimal"
                          placeholder="0"
                          aria-invalid={monto !== "" && !montoValido}
                          onChange={(evento) => setMonto(evento.target.value)}
                        />
                      </InputGroup>
                    </div>

                    <div className="flex flex-col gap-2 sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="pago-observaciones" className="text-pos-texto text-sm font-medium">
                          Observaciones
                        </Label>
                        <span className="text-pos-texto-suave text-xs tabular-nums">{notas.length}/300</span>
                      </div>
                      <Textarea
                        id="pago-observaciones"
                        value={notas}
                        maxLength={300}
                        placeholder="Observaciones"
                        className="bg-card focus-visible:border-pos-primario focus-visible:ring-pos-primario/30 min-h-[106px] resize-none rounded-[10px] text-base"
                        onChange={(evento) => setNotas(evento.target.value)}
                      />
                    </div>
                  </div>

                  {dejaNegativo ? (
                    <Alert variant="destructive">
                      <AlertDescription>El egreso deja la caja en negativo.</AlertDescription>
                    </Alert>
                  ) : null}

                  {error ? (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                </form>
              ) : null}
            </div>

            <footer className="border-pos-linea bg-pos-panel flex shrink-0 flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className={cn("text-xs", dejaNegativo ? "text-destructive" : "text-pos-texto-suave")}>
                Efectivo esperado después: <span className="tabular-nums">{formatoMonedaPOS(esperadoDespues)}</span>
              </p>
              <Button
                type="submit"
                form="formulario-movimiento-pos"
                className="bg-pos-primario hover:bg-pos-primario-hover h-12 w-full px-6 text-base font-medium text-white disabled:bg-pos-primario/30 disabled:text-white/90 sm:w-auto"
                disabled={!puedeRegistrar || esFacturaProveedor}
              >
                {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {enviando ? "Registrando…" : etiquetaAccion()}
              </Button>
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
