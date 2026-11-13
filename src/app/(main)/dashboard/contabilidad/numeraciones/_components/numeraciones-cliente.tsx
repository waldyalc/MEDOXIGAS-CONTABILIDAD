"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { etiquetaTipoComprobante } from "@/lib/facturacion/comprobantes";
import { formatoDia, formatoEntero } from "@/lib/formato";
import { actualizarNumeracion } from "@/lib/numeraciones/acciones";
import type { Numeracion } from "@/lib/numeraciones/tipos";

function EstadoBadge({ activa }: { activa: boolean }) {
  if (!activa) return <Badge variant="secondary">Inactiva</Badge>;

  return (
    <Badge variant="outline" className="border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">
      Activa
    </Badge>
  );
}

function FormularioNumeracion({
  numeracion,
  onGuardado,
}: {
  readonly numeracion: Numeracion;
  readonly onGuardado: () => void;
}) {
  const [activa, setActiva] = useState(numeracion.activa);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);

    iniciar(async () => {
      const resultado = await actualizarNumeracion({
        id: numeracion.id,
        nombre: String(datos.get("nombre") ?? ""),
        siguiente: String(datos.get("siguiente") ?? ""),
        hasta: String(datos.get("hasta") ?? ""),
        vence: String(datos.get("vence") ?? ""),
        activa,
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
        <p className="text-muted-foreground rounded-lg bg-muted/50 px-3 py-2 text-sm">
          {etiquetaTipoComprobante(numeracion.tipo_comprobante)} · Prefijo {numeracion.prefijo}
        </p>

        <Field>
          <FieldLabel htmlFor="nombre">Nombre *</FieldLabel>
          <Input id="nombre" name="nombre" required maxLength={120} defaultValue={numeracion.nombre} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="siguiente">Siguiente *</FieldLabel>
            <Input
              id="siguiente"
              name="siguiente"
              type="number"
              min={1}
              step={1}
              required
              defaultValue={numeracion.siguiente}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="hasta">Hasta</FieldLabel>
            <Input
              id="hasta"
              name="hasta"
              type="number"
              min={1}
              step={1}
              defaultValue={numeracion.hasta ?? ""}
              placeholder="Sin límite"
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="vence">Vencimiento del NCF</FieldLabel>
          <Input id="vence" name="vence" type="date" defaultValue={numeracion.vence ?? ""} />
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <Label htmlFor="activa">Activa</Label>
          <Switch id="activa" checked={activa} onCheckedChange={setActiva} />
        </div>

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

export function NumeracionesCliente({
  numeraciones,
  puedeEditar,
}: {
  readonly numeraciones: Numeracion[];
  readonly puedeEditar: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<Numeracion | null>(null);

  function cambiarDialogo(abierto: boolean) {
    if (!abierto) setEditando(null);
  }

  function cerrarTrasGuardar() {
    setEditando(null);
    router.refresh();
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Prefijo</TableHead>
            <TableHead className="text-right">Siguiente</TableHead>
            <TableHead className="text-right">Hasta</TableHead>
            <TableHead>Vence</TableHead>
            <TableHead>Activa</TableHead>
            {puedeEditar ? (
              <TableHead className="w-10">
                <span className="sr-only">Acciones</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {numeraciones.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={puedeEditar ? 8 : 7}
                className="text-muted-foreground h-24 text-center whitespace-normal"
              >
                No hay numeraciones registradas.
              </TableCell>
            </TableRow>
          ) : (
            numeraciones.map((numeracion) => (
              <TableRow key={numeracion.id}>
                <TableCell className="whitespace-nowrap">
                  {etiquetaTipoComprobante(numeracion.tipo_comprobante)}
                </TableCell>
                <TableCell className="font-medium">{numeracion.nombre}</TableCell>
                <TableCell className="font-mono text-xs">{numeracion.prefijo}</TableCell>
                <TableCell className="text-right tabular-nums">{formatoEntero(numeracion.siguiente)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {numeracion.hasta == null ? "—" : formatoEntero(numeracion.hasta)}
                </TableCell>
                <TableCell className="tabular-nums">{formatoDia(numeracion.vence)}</TableCell>
                <TableCell>
                  <EstadoBadge activa={numeracion.activa} />
                </TableCell>
                {puedeEditar ? (
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar numeración ${numeracion.prefijo}`}
                      onClick={() => setEditando(numeracion)}
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

      <Dialog open={editando != null} onOpenChange={cambiarDialogo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar numeración</DialogTitle>
          </DialogHeader>
          {editando ? (
            <FormularioNumeracion key={editando.id} numeracion={editando} onGuardado={cerrarTrasGuardar} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
