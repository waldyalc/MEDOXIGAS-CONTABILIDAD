"use client";

import { useMemo, useState, useTransition } from "react";

import { cn } from "cn";

import { DatePicker } from "@/components/date-picker";
import { CampoFormulario } from "@/components/formularios/campo-formulario";
import { FORM_INPUT } from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { registrarSaldosIniciales } from "@/lib/contabilidad/acciones";
import { centavosAValor, parsearCentavos } from "@/lib/facturacion/calculo";
import { requerido } from "@/lib/formularios/validacion";
import { formatearRd } from "@/lib/reportes/dinero";
import type { CuentaContable } from "@/lib/reportes/tipos";

interface MontoLinea {
  debito: string;
  credito: string;
}

const MONTO_VACIO: MontoLinea = { debito: "", credito: "" };

interface SaldosInicialesProps {
  cuentas: readonly CuentaContable[];
  /** Id de la cuenta de patrimonio "Ajustes iniciales" (config_contable). */
  cuentaAjustesId: string | null;
  fechaHoy: string;
}

function calcularTotales(cuentas: readonly CuentaContable[], montos: Record<string, MontoLinea>) {
  let debitos = 0;
  let creditos = 0;
  let cargadas = 0;
  let invalidas = 0;

  for (const cuenta of cuentas) {
    const monto = montos[cuenta.id];
    if (monto == null) continue;

    const debito = parsearCentavos(monto.debito);
    const credito = parsearCentavos(monto.credito);
    if (monto.debito.trim() !== "" && debito == null) invalidas += 1;
    if (monto.credito.trim() !== "" && credito == null) invalidas += 1;

    const deb = debito ?? 0;
    const cred = credito ?? 0;
    if (deb > 0 || cred > 0) cargadas += 1;
    debitos += deb;
    creditos += cred;
  }

  return { debitos, creditos, diferencia: Math.abs(debitos - creditos), cargadas, invalidas };
}

export function SaldosIniciales({ cuentas, cuentaAjustesId, fechaHoy }: SaldosInicialesProps) {
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(fechaHoy);
  const [descripcion, setDescripcion] = useState("");
  const [montos, setMontos] = useState<Record<string, MontoLinea>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const validacion = useValidacionFormulario();

  const cuentasCargables = useMemo(
    () => cuentas.filter((cuenta) => cuenta.activa && cuenta.acepta_movimientos && cuenta.es_caja_banco !== true),
    [cuentas],
  );

  const totales = useMemo(() => calcularTotales(cuentasCargables, montos), [cuentasCargables, montos]);

  const puedeGuardar = !pendiente && totales.cargadas > 0 && totales.diferencia === 0 && totales.invalidas === 0;

  function cambiarMonto(cuentaId: string, lado: "debito" | "credito", valor: string) {
    setMontos((actual) => {
      const previo = actual[cuentaId] ?? MONTO_VACIO;
      return {
        ...actual,
        [cuentaId]: { ...previo, [lado]: valor, [lado === "debito" ? "credito" : "debito"]: "" },
      };
    });
  }

  function guardar() {
    setError(null);
    if (!validacion.validar([requerido("si-fecha", fecha, "La fecha es requerida.")])) return;

    const lineas = cuentasCargables.flatMap((cuenta) => {
      const monto = montos[cuenta.id];
      if (monto == null) return [];

      const debito = parsearCentavos(monto.debito) ?? 0;
      const credito = parsearCentavos(monto.credito) ?? 0;
      if (debito === 0 && credito === 0) return [];

      return [{ cuenta_id: cuenta.id, debito: centavosAValor(debito), credito: centavosAValor(credito) }];
    });

    if (lineas.length === 0) {
      setError("Carga al menos un saldo inicial.");
      return;
    }

    startTransition(async () => {
      const resultado = await registrarSaldosIniciales({
        fecha,
        ...(descripcion.trim() !== "" ? { descripcion: descripcion.trim() } : {}),
        lineas,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setMontos({});
      setDescripcion("");
      setAbierto(false);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>Saldos iniciales</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Saldos iniciales</DialogTitle>
          <DialogDescription>
            Carga el saldo de apertura de cada cuenta. Los débitos y créditos deben quedar iguales; usa la cuenta de
            patrimonio «Ajustes iniciales» como contrapartida.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4">
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <CampoFormulario htmlFor="si-fecha" label="Fecha" required error={validacion.errorDe("si-fecha")}>
              <DatePicker
                id="si-fecha"
                value={fecha}
                onChange={(valor) => {
                  setFecha(valor);
                  validacion.limpiar("si-fecha");
                }}
                aria-invalid={Boolean(validacion.errorDe("si-fecha"))}
                className={FORM_INPUT}
              />
            </CampoFormulario>

            <CampoFormulario htmlFor="si-descripcion" label="Descripción">
              <Input
                id="si-descripcion"
                value={descripcion}
                onChange={(event) => setDescripcion(event.target.value)}
                maxLength={500}
                placeholder="Saldos iniciales"
                className={FORM_INPUT}
              />
            </CampoFormulario>
          </div>

          <div className="max-h-[46vh] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="w-36 text-right">Débito</TableHead>
                  <TableHead className="w-36 text-right">Crédito</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cuentasCargables.map((cuenta) => {
                  const monto = montos[cuenta.id] ?? MONTO_VACIO;
                  return (
                    <TableRow key={cuenta.id}>
                      <TableCell className="whitespace-normal">
                        <span className="text-muted-foreground mr-2 tabular-nums">{cuenta.codigo}</span>
                        {cuenta.nombre}
                        {cuenta.id === cuentaAjustesId ? (
                          <span className="text-muted-foreground ml-2 text-xs">· contrapartida</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          inputMode="decimal"
                          placeholder="0.00"
                          aria-label={`Débito de ${cuenta.nombre}`}
                          value={monto.debito}
                          onChange={(event) => cambiarMonto(cuenta.id, "debito", event.target.value)}
                          className="h-8 text-right tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          inputMode="decimal"
                          placeholder="0.00"
                          aria-label={`Crédito de ${cuenta.nombre}`}
                          value={monto.credito}
                          onChange={(event) => cambiarMonto(cuenta.id, "credito", event.target.value)}
                          className="h-8 text-right tabular-nums"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatearRd(totales.debitos)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatearRd(totales.creditos)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Diferencia</TableCell>
                  <TableCell
                    colSpan={2}
                    className={cn(
                      "text-right font-medium tabular-nums",
                      totales.diferencia !== 0 && "text-destructive",
                    )}
                  >
                    {formatearRd(totales.diferencia)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          <p className="text-muted-foreground text-xs">
            Las cuentas de caja y banco cargan su saldo inicial desde el módulo Bancos. Una cuenta con saldo inicial
            registrado no admite otra carga.
          </p>

          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" className="h-11 rounded-[12px] px-6" />}>
            Cancelar
          </DialogClose>
          <Button type="button" disabled={!puedeGuardar} onClick={guardar} className="h-11 rounded-[12px] px-6">
            {pendiente ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
