"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronDown, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { calcularLinea, centavosAValor, parsearCentavos } from "@/lib/facturacion/calculo";
import { formatoMonedaCentavos } from "@/lib/facturacion/formato";
import type { ContactoResumen } from "@/lib/facturacion/tipos";
import { crearGastoMenor } from "@/lib/gastos/acciones";
import type { CuentaGasto } from "@/lib/gastos/tipos";

interface Props {
  cuentas: CuentaGasto[];
  proveedores: ContactoResumen[];
  cuentaPorDefecto: string;
  fechaHoy: string;
}

export function GastoForm({ cuentas, proveedores, cuentaPorDefecto, fechaHoy }: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(fechaHoy);
  const [itbisTasa, setItbisTasa] = useState("0");
  const [cuentaId, setCuentaId] = useState(cuentaPorDefecto);
  const [proveedorId, setProveedorId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const proveedoresItems = proveedores.map((proveedor) => ({ value: proveedor.id, label: proveedor.nombre }));
  const subtotalCentavos = parsearCentavos(monto) ?? 0;
  const calculo = calcularLinea({
    cantidad: 1,
    precioCentavos: subtotalCentavos,
    itbisTasa: Number(itbisTasa),
  });

  function guardar() {
    setError(null);

    if (!descripcion.trim()) {
      setError("Escribe la descripción del gasto.");
      return;
    }
    if (subtotalCentavos <= 0) {
      setError("El monto debe ser mayor que cero.");
      return;
    }

    iniciar(async () => {
      const resultado = await crearGastoMenor({
        fecha,
        descripcion: descripcion.trim(),
        subtotal: centavosAValor(subtotalCentavos),
        itbis_tasa: Number(itbisTasa),
        cuenta_gasto_id: cuentaId || undefined,
        contacto_id: proveedorId || undefined,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push("/dashboard/gastos");
    });
  }

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Datos del gasto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="descripcion">Descripción *</Label>
            <Input
              id="descripcion"
              required
              placeholder="Ej. Compra de útiles de oficina"
              value={descripcion}
              onChange={(evento) => setDescripcion(evento.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="monto">Monto *</Label>
            <Input
              id="monto"
              inputMode="decimal"
              required
              placeholder="0.00"
              value={monto}
              onChange={(evento) => setMonto(evento.target.value)}
            />
            <p className="text-muted-foreground text-xs">Monto sin ITBIS.</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fecha">Fecha *</Label>
            <Input id="fecha" type="date" required value={fecha} onChange={(evento) => setFecha(evento.target.value)} />
          </div>

          <div className="col-span-full">
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between border-t py-2 text-sm font-medium">
                Más opciones
                <ChevronDown className="size-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid gap-4 pt-2 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="itbis">ITBIS %</Label>
                    <NativeSelect
                      id="itbis"
                      className="w-full"
                      value={itbisTasa}
                      onChange={(evento) => setItbisTasa(evento.target.value)}
                    >
                      <NativeSelectOption value="0">0 %</NativeSelectOption>
                      <NativeSelectOption value="16">16 %</NativeSelectOption>
                      <NativeSelectOption value="18">18 %</NativeSelectOption>
                    </NativeSelect>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cuenta">Cuenta de gasto</Label>
                    <NativeSelect
                      id="cuenta"
                      className="w-full"
                      value={cuentaId}
                      onChange={(evento) => setCuentaId(evento.target.value)}
                    >
                      {cuentas.map((cuenta) => (
                        <NativeSelectOption key={cuenta.id} value={cuenta.id}>
                          {cuenta.codigo} · {cuenta.nombre}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <Label htmlFor="proveedor">Proveedor</Label>
                    <Combobox
                      items={proveedoresItems}
                      onValueChange={(item: { value: string; label: string } | null) =>
                        setProveedorId(item?.value ?? "")
                      }
                    >
                      <ComboboxInput id="proveedor" className="w-full" placeholder="Buscar proveedor…" showClear />
                      <ComboboxContent>
                        <ComboboxEmpty>Sin resultados</ComboboxEmpty>
                        <ComboboxList>
                          {(item: { value: string; label: string }) => (
                            <ComboboxItem key={item.value} value={item}>
                              {item.label}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-col gap-3 rounded-xl bg-muted/50 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatoMonedaCentavos(calculo.subtotalCentavos)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">ITBIS</span>
          <span>{formatoMonedaCentavos(calculo.itbisCentavos)}</span>
        </div>
        <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
          <span>Total</span>
          <span>{formatoMonedaCentavos(calculo.totalCentavos)}</span>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" render={<Link href="/dashboard/gastos" />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Guardar gasto
        </Button>
      </div>
    </form>
  );
}
