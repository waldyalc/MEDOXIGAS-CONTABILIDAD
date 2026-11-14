"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2, Pencil, Plus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { actualizarCentroCosto, crearCentroCosto } from "@/lib/centros-costo/acciones";
import type { CentroCosto } from "@/lib/centros-costo/tipos";

export function CentrosCostoCliente({
  centros,
  puedeEditar,
}: {
  readonly centros: CentroCosto[];
  readonly puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<CentroCosto | null>(null);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [activo, setActivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function abrirNuevo() {
    setEditando(null);
    setCodigo("");
    setNombre("");
    setDescripcion("");
    setActivo(true);
    setError(null);
    setAbierto(true);
  }

  function abrirEditar(centro: CentroCosto) {
    setEditando(centro);
    setCodigo(centro.codigo);
    setNombre(centro.nombre);
    setDescripcion(centro.descripcion ?? "");
    setActivo(centro.activo);
    setError(null);
    setAbierto(true);
  }

  function cambiarAbierto(abrir: boolean) {
    setAbierto(abrir);
    if (!abrir) {
      setEditando(null);
      setError(null);
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const entrada = {
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
      activo,
    };

    iniciar(async () => {
      const resultado = editando ? await actualizarCentroCosto(editando.id, entrada) : await crearCentroCosto(entrada);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setAbierto(false);
      setEditando(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Se eligen en «Más opciones» de facturas, cotizaciones, conduces y compras, y por línea en asientos manuales.
        </p>
        {puedeEditar ? (
          <Button type="button" onClick={abrirNuevo}>
            <Plus />
            Nuevo centro
          </Button>
        ) : null}
      </div>

      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Estado</TableHead>
              {puedeEditar ? (
                <TableHead className="w-10">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {centros.length === 0 ? (
              <TableRow>
                <TableCell colSpan={puedeEditar ? 5 : 4} className="text-muted-foreground py-10 text-center">
                  Todavía no hay centros de costo.
                </TableCell>
              </TableRow>
            ) : (
              centros.map((centro) => (
                <TableRow key={centro.id}>
                  <TableCell className="font-mono text-sm">{centro.codigo}</TableCell>
                  <TableCell className="font-medium">{centro.nombre}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[420px] truncate">
                    {centro.descripcion?.trim() || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={centro.activo ? "secondary" : "destructive"}>
                      {centro.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  {puedeEditar ? (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${centro.nombre}`}
                        onClick={() => abrirEditar(centro)}
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

      <Dialog open={abierto} onOpenChange={cambiarAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar centro de costo" : "Nuevo centro de costo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={enviar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="centro-codigo">Código *</Label>
              <Input
                id="centro-codigo"
                value={codigo}
                onChange={(evento) => setCodigo(evento.target.value)}
                maxLength={30}
                placeholder="Ej. CC-01"
                required
                disabled={pendiente}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="centro-nombre">Nombre *</Label>
              <Input
                id="centro-nombre"
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
                maxLength={120}
                required
                disabled={pendiente}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="centro-descripcion">Descripción</Label>
              <Textarea
                id="centro-descripcion"
                value={descripcion}
                onChange={(evento) => setDescripcion(evento.target.value)}
                maxLength={500}
                disabled={pendiente}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="centro-activo">Activo</Label>
              <Switch id="centro-activo" checked={activo} onCheckedChange={setActivo} disabled={pendiente} />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={pendiente} />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={pendiente}>
                {pendiente ? <Loader2 className="animate-spin" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
