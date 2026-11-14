"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2, Pencil, Plus } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import { FORM_INPUT, FORM_SELECT, FormField } from "@/components/formularios/formulario";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hoyRD } from "@/lib/facturacion/formato";
import { guardarTasaCambio } from "@/lib/monedas/acciones";
import type { MonedaConTasa, TasaCambio } from "@/lib/monedas/tipos";

const formatoTasa = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 6 });

const formatoFecha = new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "2-digit", year: "numeric" });

function fechaVisible(fecha: string): string {
  return formatoFecha.format(new Date(`${fecha}T12:00:00`));
}

export function MonedasCliente({
  monedas,
  tasas,
  puedeEditar,
}: {
  readonly monedas: MonedaConTasa[];
  readonly tasas: TasaCambio[];
  readonly puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [monedaCodigo, setMonedaCodigo] = useState("");
  const [fecha, setFecha] = useState(hoyRD());
  const [tasa, setTasa] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const editables = monedas.filter((moneda) => !moneda.es_base && moneda.activo);
  const opciones = editables.map((moneda) => ({
    value: moneda.codigo,
    label: `${moneda.codigo} · ${moneda.nombre}`,
  }));
  const nombres = new Map(monedas.map((moneda) => [moneda.codigo, moneda.nombre]));

  function abrirNueva() {
    setMonedaCodigo(editables[0]?.codigo ?? "");
    setFecha(hoyRD());
    setTasa("");
    setError(null);
    setAbierto(true);
  }

  function abrirEdicion(item: TasaCambio) {
    setMonedaCodigo(item.moneda_codigo);
    setFecha(item.fecha);
    setTasa(String(item.tasa));
    setError(null);
    setAbierto(true);
  }

  function enviar() {
    setError(null);

    iniciar(async () => {
      const resultado = await guardarTasaCambio({ moneda_codigo: monedaCodigo, fecha, tasa });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          La moneda base es DOP. Las demás llevan una tasa editable por fecha; si repites la fecha, se corrige.
        </p>
        {puedeEditar ? (
          <Button type="button" onClick={abrirNueva}>
            <Plus />
            Registrar tasa
          </Button>
        ) : null}
      </div>

      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Símbolo</TableHead>
              <TableHead>Última tasa</TableHead>
              <TableHead>Fecha de la tasa</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monedas.map((moneda) => (
              <TableRow key={moneda.codigo}>
                <TableCell className="font-mono text-sm">{moneda.codigo}</TableCell>
                <TableCell className="font-medium">
                  {moneda.nombre}
                  {moneda.es_base ? (
                    <Badge variant="secondary" className="ml-2">
                      Base
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">{moneda.simbolo}</TableCell>
                <TableCell className="tabular-nums">
                  {moneda.ultimaTasa == null ? "—" : formatoTasa.format(moneda.ultimaTasa)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {moneda.ultimaFecha ? fechaVisible(moneda.ultimaFecha) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={moneda.activo ? "secondary" : "destructive"}>
                    {moneda.activo ? "Activa" : "Inactiva"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Historial de tasas</h2>
        <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Moneda</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Tasa</TableHead>
                {puedeEditar ? (
                  <TableHead className="w-10">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={puedeEditar ? 4 : 3} className="text-muted-foreground py-10 text-center">
                    Todavía no hay tasas registradas.
                  </TableCell>
                </TableRow>
              ) : (
                tasas.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.moneda_codigo} · {nombres.get(item.moneda_codigo) ?? ""}
                    </TableCell>
                    <TableCell>{fechaVisible(item.fecha)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoTasa.format(item.tasa)}</TableCell>
                    {puedeEditar ? (
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar tasa de ${item.moneda_codigo} del ${fechaVisible(item.fecha)}`}
                          onClick={() => abrirEdicion(item)}
                        >
                          <Pencil />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar tasa de cambio</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <FormField htmlFor="tasa-moneda" label="Moneda" required>
              <Select
                items={opciones}
                value={monedaCodigo}
                onValueChange={(valor: string | null) => setMonedaCodigo(valor ?? "")}
              >
                <SelectTrigger id="tasa-moneda" className={FORM_SELECT}>
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
            </FormField>
            <FormField htmlFor="tasa-fecha" label="Fecha" required>
              <DatePicker id="tasa-fecha" value={fecha} onChange={setFecha} />
            </FormField>
            <FormField htmlFor="tasa-valor" label="Tasa en DOP" required>
              <Input
                id="tasa-valor"
                inputMode="decimal"
                value={tasa}
                onChange={(evento) => setTasa(evento.target.value)}
                placeholder="Ej. 58.50"
                disabled={pendiente}
                className={FORM_INPUT}
              />
            </FormField>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="outline" disabled={pendiente} className="h-11 rounded-[12px] px-6" />
                }
              >
                Cancelar
              </DialogClose>
              <Button
                type="button"
                onClick={enviar}
                disabled={pendiente || !monedaCodigo}
                className="h-11 rounded-[12px] px-6"
              >
                {pendiente ? <Loader2 className="animate-spin" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
