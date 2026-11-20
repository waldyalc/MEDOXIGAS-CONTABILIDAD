"use client";

import { useState } from "react";

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
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import type { Impuesto } from "@/lib/impuestos/tipos";
import { calcularLineaPOS } from "@/lib/pos/calculo";

import { useCarritoPOS } from "../carrito-pos-provider";
import { textoAMonto } from "../formato-pos";

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
  const [monto, setMonto] = useState("");
  const [itbis, setItbis] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const montoValido = textoAMonto(monto);
  const total = calcularLineaPOS({
    cantidad: "1",
    precio: montoValido ?? "0",
    itbis_tasa: itbis,
    descuento_pct: "0",
  }).total;

  function cerrar() {
    setDescripcion("");
    setMonto("");
    setItbis("0");
    setError(null);
    onCerrar();
  }

  function aplicar() {
    if (bloqueado) return;
    if (descripcion.trim() === "") {
      setError("La descripción es obligatoria.");
      return;
    }
    if (montoValido === null || Number(montoValido) <= 0) {
      setError("El monto debe ser mayor a cero.");
      return;
    }

    agregarLineaLibre({ descripcion: descripcion.trim(), monto: montoValido, itbisTasa: itbis });
    cerrar();
  }

  return (
    <Dialog open={abierto} onOpenChange={(nuevo) => (nuevo ? null : cerrar())}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Venta simple</DialogTitle>
          <DialogDescription>Agrega una línea libre con descripción y monto.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {bloqueado ? (
            <p className="text-destructive text-sm">Quita la cotización para agregar una venta simple.</p>
          ) : null}

          <div className="flex flex-col gap-1">
            <Label htmlFor="simple-descripcion">Descripción *</Label>
            <Input
              id="simple-descripcion"
              value={descripcion}
              maxLength={200}
              placeholder="Ej. Servicio de instalación"
              onChange={(evento) => setDescripcion(evento.target.value)}
              disabled={bloqueado}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="simple-monto">Monto *</Label>
              <InputGroup className="h-10">
                <InputGroupAddon>
                  <InputGroupText>RD$</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="simple-monto"
                  value={monto}
                  inputMode="decimal"
                  disabled={bloqueado}
                  onChange={(evento) => setMonto(evento.target.value)}
                />
              </InputGroup>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="simple-itbis">ITBIS</Label>
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
                <SelectTrigger id="simple-itbis" className="h-10 w-full">
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
          </div>

          <div className="bg-muted/40 flex items-center justify-between rounded-lg px-3 py-2">
            <span className="text-sm">Total</span>
            <span className="text-lg font-semibold tabular-nums">{formatoMoneda(total)}</span>
          </div>

          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button className="h-12" disabled={bloqueado} onClick={aplicar}>
            Aplicar a la venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
