"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { crearTerminoPago } from "@/lib/configuracion/acciones";
import type { TerminoPago } from "@/lib/configuracion/tipos";
import { formatoEntero } from "@/lib/formato";

function FormularioTermino({ onGuardado }: { readonly onGuardado: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);

    iniciar(async () => {
      const resultado = await crearTerminoPago({
        nombre: String(datos.get("nombre") ?? ""),
        dias: String(datos.get("dias") ?? ""),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onGuardado();
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="nombre">Nombre *</FieldLabel>
          <Input id="nombre" name="nombre" required maxLength={80} placeholder="Ej. 45 días" />
        </Field>

        <Field>
          <FieldLabel htmlFor="dias">Días *</FieldLabel>
          <Input id="dias" name="dias" type="number" min={0} max={3650} step={1} required placeholder="0" />
        </Field>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </FieldGroup>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Guardar
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TerminosCliente({
  terminos,
  puedeCrear,
}: {
  readonly terminos: TerminoPago[];
  readonly puedeCrear: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  function cerrarTrasGuardar() {
    setAbierto(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">Los plazos que se podrán elegir en las facturas de venta.</p>
        {puedeCrear ? (
          <Button type="button" onClick={() => setAbierto(true)}>
            <Plus />
            Nuevo término
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Días</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {terminos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground h-24 text-center whitespace-normal">
                  No hay términos de pago registrados.
                </TableCell>
              </TableRow>
            ) : (
              terminos.map((termino) => (
                <TableRow key={termino.id}>
                  <TableCell className="font-medium">{termino.nombre}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoEntero(termino.dias)}</TableCell>
                  <TableCell>
                    {termino.activo ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                      >
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo término de pago</DialogTitle>
          </DialogHeader>
          <FormularioTermino onGuardado={cerrarTrasGuardar} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
