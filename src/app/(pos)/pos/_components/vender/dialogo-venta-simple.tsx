"use client";

import { useState } from "react";

import { cn } from "cn";

import { Delete } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import type { Impuesto } from "@/lib/impuestos/tipos";
import { calcularLineaPOS } from "@/lib/pos/calculo";

import { useCarritoPOS } from "../carrito-pos-provider";
import { textoAMonto } from "../formato-pos";

type Operador = "+" | "−" | "×" | "÷";

const TECLAS: { tecla: string; tipo: "digito" | "util" | "operador" }[][] = [
  [
    { tecla: "ce", tipo: "util" },
    { tecla: "C", tipo: "util" },
    { tecla: "%", tipo: "util" },
    { tecla: "÷", tipo: "operador" },
  ],
  [
    { tecla: "7", tipo: "digito" },
    { tecla: "8", tipo: "digito" },
    { tecla: "9", tipo: "digito" },
    { tecla: "×", tipo: "operador" },
  ],
  [
    { tecla: "4", tipo: "digito" },
    { tecla: "5", tipo: "digito" },
    { tecla: "6", tipo: "digito" },
    { tecla: "−", tipo: "operador" },
  ],
  [
    { tecla: "1", tipo: "digito" },
    { tecla: "2", tipo: "digito" },
    { tecla: "3", tipo: "digito" },
    { tecla: "+", tipo: "operador" },
  ],
  [
    { tecla: ".", tipo: "digito" },
    { tecla: "0", tipo: "digito" },
    { tecla: "borrar", tipo: "digito" },
    { tecla: "=", tipo: "operador" },
  ],
];

function evaluar(a: number, op: Operador, b: number): number | null {
  if (op === "+") return a + b;
  if (op === "−") return a - b;
  if (op === "×") return a * b;
  return b === 0 ? null : a / b;
}

function recortar(n: number): string {
  return String(Math.round(n * 10000) / 10000);
}

function etiquetaTecla(tecla: string): string {
  if (tecla === "borrar") return "Borrar";
  if (tecla === "ce") return "Borrar entrada";
  return tecla;
}

export function DialogoVentaSimple({
  abierto,
  onCerrar,
  impuestos,
  bloqueado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  impuestos: Impuesto[];
  bloqueado: boolean;
}) {
  const { agregarLineaLibre } = useCarritoPOS();
  const [descripcion, setDescripcion] = useState("");
  const [entrada, setEntrada] = useState("");
  const [pendiente, setPendiente] = useState<{ acc: number; op: Operador } | null>(null);
  const [expresion, setExpresion] = useState("");
  const [recienEvaluado, setRecienEvaluado] = useState(false);
  const [itbis, setItbis] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const mostrado = entrada === "" && pendiente ? recortar(pendiente.acc) : entrada || "0";
  const montoValido = textoAMonto(entrada === "" && pendiente ? recortar(pendiente.acc) : entrada);
  const total = calcularLineaPOS({
    cantidad: "1",
    precio: montoValido ?? "0",
    itbis_tasa: itbis,
    descuento_pct: "0",
  }).total;

  function limpiarTodo() {
    setEntrada("");
    setPendiente(null);
    setExpresion("");
    setRecienEvaluado(false);
  }

  function cerrar() {
    setDescripcion("");
    limpiarTodo();
    setItbis("0");
    setError(null);
    onCerrar();
  }

  function teclaDigito(digito: string) {
    if (recienEvaluado) {
      setEntrada(digito);
      setRecienEvaluado(false);
      setExpresion("");
      return;
    }
    setEntrada((actual) => (actual.replace("-", "").replace(".", "").length >= 12 ? actual : actual + digito));
  }

  function teclaPunto() {
    if (recienEvaluado) {
      setEntrada("0.");
      setRecienEvaluado(false);
      setExpresion("");
      return;
    }
    setEntrada((actual) => (actual.includes(".") ? actual : `${actual === "" ? "0" : actual}.`));
  }

  function teclaBorrar() {
    if (recienEvaluado) {
      limpiarTodo();
      return;
    }
    setEntrada((actual) => actual.slice(0, -1));
  }

  function teclaPorcentaje() {
    if (entrada === "") return;
    setEntrada(recortar(Number(entrada) / 100));
  }

  function teclaOperador(op: Operador) {
    if (entrada === "") {
      if (pendiente) {
        setPendiente({ acc: pendiente.acc, op });
        setExpresion(`${recortar(pendiente.acc)} ${op}`);
      }
      return;
    }
    const numero = Number(entrada);
    if (!Number.isFinite(numero)) return;
    let acc = numero;
    if (pendiente) {
      const resultado = evaluar(pendiente.acc, pendiente.op, numero);
      if (resultado === null) {
        limpiarTodo();
        return;
      }
      acc = resultado;
    }
    setPendiente({ acc, op });
    setExpresion(`${recortar(acc)} ${op}`);
    setEntrada("");
    setRecienEvaluado(false);
  }

  function teclaIgual() {
    if (!pendiente || entrada === "") return;
    const resultado = evaluar(pendiente.acc, pendiente.op, Number(entrada));
    if (resultado === null) {
      limpiarTodo();
      return;
    }
    setExpresion(`${recortar(pendiente.acc)} ${pendiente.op} ${entrada} =`);
    setPendiente(null);
    setEntrada(recortar(resultado));
    setRecienEvaluado(true);
  }

  function pulsar(tecla: string) {
    if (bloqueado) return;
    setError(null);
    if (tecla === "+" || tecla === "−" || tecla === "×" || tecla === "÷") {
      teclaOperador(tecla);
      return;
    }
    if (tecla >= "0" && tecla <= "9") {
      teclaDigito(tecla);
      return;
    }
    const acciones: Record<string, () => void> = {
      ce: () => setEntrada(""),
      C: limpiarTodo,
      "%": teclaPorcentaje,
      borrar: teclaBorrar,
      ".": teclaPunto,
      "=": teclaIgual,
    };
    acciones[tecla]?.();
  }

  function aplicar() {
    if (bloqueado) return;
    if (montoValido === null || Number(montoValido) <= 0) {
      setError("El monto debe ser mayor a cero.");
      return;
    }

    agregarLineaLibre({
      descripcion: descripcion.trim() === "" ? "Venta simple" : descripcion.trim(),
      monto: montoValido,
      itbisTasa: itbis,
    });
    cerrar();
  }

  return (
    <Dialog open={abierto} onOpenChange={(nuevo) => (nuevo ? null : cerrar())}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogTitle className="sr-only">Venta simple</DialogTitle>
        <DialogDescription className="sr-only">Agrega una línea libre con descripción y monto.</DialogDescription>

        <div className="flex flex-col gap-3">
          {bloqueado ? (
            <p className="text-destructive text-sm">Quita la cotización para agregar una venta simple.</p>
          ) : null}

          <div className="flex flex-col gap-1">
            <Label htmlFor="simple-descripcion">Nombre de la venta</Label>
            <Input
              id="simple-descripcion"
              value={descripcion}
              maxLength={200}
              placeholder="Venta simple"
              onChange={(evento) => setDescripcion(evento.target.value)}
              disabled={bloqueado}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="simple-itbis" className="text-muted-foreground text-xs">
              ITBIS
            </Label>
            <Select
              items={[
                { value: "0", label: "Exento (0%)" },
                ...impuestos
                  .filter((impuesto) => impuesto.tipo === "itbis")
                  .map((impuesto) => ({
                    value: String(impuesto.tarifa),
                    label: `${impuesto.nombre} (${formatoCantidad(impuesto.tarifa)}%)`,
                  })),
              ]}
              value={itbis}
              onValueChange={(valor) => setItbis(valor ?? "0")}
              disabled={bloqueado}
            >
              <SelectTrigger id="simple-itbis" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="0">Exento (0%)</SelectItem>
                {impuestos
                  .filter((impuesto) => impuesto.tipo === "itbis")
                  .map((impuesto) => (
                    <SelectItem key={impuesto.id} value={String(impuesto.tarifa)}>
                      {`${impuesto.nombre} (${formatoCantidad(impuesto.tarifa)}%)`}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-input flex flex-col items-end gap-0.5 rounded-lg border px-3 py-3">
            <span className="text-muted-foreground h-4 text-xs tabular-nums">{expresion}</span>
            <span className="text-3xl font-semibold tabular-nums">{`RD$${mostrado}`}</span>
            <span className="text-muted-foreground text-xs">{`Total con ITBIS: ${formatoMoneda(total)}`}</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {TECLAS.flat().map(({ tecla, tipo }) => (
              <button
                key={tecla}
                type="button"
                disabled={bloqueado}
                aria-label={etiquetaTecla(tecla)}
                onClick={() => pulsar(tecla)}
                className={cn(
                  "flex h-12 items-center justify-center rounded-lg text-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  tipo === "operador" && "bg-primary text-primary-foreground hover:bg-primary/90",
                  tipo === "util" && "bg-primary/10 text-primary hover:bg-primary/15",
                  tipo === "digito" && "border-border hover:bg-muted border",
                )}
              >
                {tecla === "borrar" ? <Delete className="size-5" aria-hidden="true" /> : tecla}
              </button>
            ))}
          </div>

          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}

          <Button className="h-12 w-full text-base" disabled={bloqueado} onClick={aplicar}>
            Aplicar a la venta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
