"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Info, Loader2 } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { iniciarConciliacion } from "@/lib/bancos/acciones";
import type { CuentaSeleccion } from "@/lib/bancos/tipos";
import { rutaConciliacion } from "@/lib/enlaces";
import { centavosAValor, parsearCentavos } from "@/lib/facturacion/calculo";

interface Props {
  cuentas: CuentaSeleccion[];
  borradores: Record<string, string>;
  cuentaInicial: string;
  fechaHoy: string;
}

export function FormNuevaConciliacion({ cuentas, borradores, cuentaInicial, fechaHoy }: Props) {
  const router = useRouter();
  const [cuentaId, setCuentaId] = useState(cuentaInicial);
  const [fechaCorte, setFechaCorte] = useState(fechaHoy);
  const [saldo, setSaldo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const opciones = cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} · ${cuenta.nombre}`,
  }));
  const borrador = cuentaId ? borradores[cuentaId] : undefined;

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const saldoCentavos = parsearCentavos(saldo);
    if (saldoCentavos === null) {
      setError("Escribe el saldo del extracto.");
      return;
    }

    iniciar(async () => {
      const resultado = await iniciarConciliacion({
        cuenta_id: cuentaId,
        fecha_hasta: fechaCorte,
        saldo_bancario: centavosAValor(saldoCentavos),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(rutaConciliacion(resultado.id));
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Datos de la conciliación</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="conciliacion-cuenta">Cuenta *</Label>
            <Select
              items={opciones}
              value={cuentaId}
              onValueChange={(valor: string | null) => setCuentaId(valor ?? "")}
            >
              <SelectTrigger id="conciliacion-cuenta" className="w-full">
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
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="conciliacion-fecha">Fecha de corte *</Label>
            <DatePicker id="conciliacion-fecha" value={fechaCorte} onChange={setFechaCorte} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="conciliacion-saldo">Saldo del extracto *</Label>
            <InputGroup>
              <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                RD$
              </InputGroupAddon>
              <InputGroupInput
                id="conciliacion-saldo"
                inputMode="decimal"
                placeholder="0.00"
                value={saldo}
                onChange={(evento) => setSaldo(evento.target.value)}
                required
                disabled={pendiente}
              />
            </InputGroup>
          </div>

          <p className="text-muted-foreground text-sm sm:col-span-2">
            Los movimientos se toman desde el día siguiente al último corte conciliado. Si es la primera conciliación,
            desde el primer movimiento de la cuenta.
          </p>
        </CardContent>
      </Card>

      {borrador ? (
        <Alert>
          <Info />
          <AlertTitle>Ya hay un borrador para esta cuenta</AlertTitle>
          <AlertDescription>
            Al continuar se abrirá la conciliación en borrador para que marques sus movimientos.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/bancos/conciliaciones")}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente || !cuentaId || cuentas.length === 0}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          {borrador ? "Continuar borrador" : "Crear conciliación"}
        </Button>
      </div>
    </form>
  );
}
