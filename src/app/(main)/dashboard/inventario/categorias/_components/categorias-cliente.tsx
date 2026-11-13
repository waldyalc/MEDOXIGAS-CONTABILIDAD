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
import { actualizarCategoria, crearCategoria } from "@/lib/inventario/acciones";
import type { CategoriaProducto } from "@/lib/inventario/tipos";

export function CategoriasCliente({
  categorias,
  puedeEditar,
}: {
  categorias: CategoriaProducto[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<CategoriaProducto | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [activo, setActivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function abrirNueva() {
    setEditando(null);
    setNombre("");
    setDescripcion("");
    setActivo(true);
    setError(null);
    setAbierto(true);
  }

  function abrirEditar(categoria: CategoriaProducto) {
    setEditando(categoria);
    setNombre(categoria.nombre);
    setDescripcion(categoria.descripcion ?? "");
    setActivo(categoria.activo);
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
      nombre: nombre.trim(),
      ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
      activo,
    };

    iniciar(async () => {
      const resultado = editando ? await actualizarCategoria(editando.id, entrada) : await crearCategoria(entrada);

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
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Categorías</h1>
          <p className="text-muted-foreground text-sm">Agrupa los productos para encontrarlos y reportarlos mejor.</p>
        </div>
        {puedeEditar ? (
          <Button type="button" onClick={abrirNueva}>
            <Plus />
            Nueva categoría
          </Button>
        ) : null}
      </div>

      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow>
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
            {categorias.length === 0 ? (
              <TableRow>
                <TableCell colSpan={puedeEditar ? 4 : 3} className="text-muted-foreground py-10 text-center">
                  Todavía no hay categorías.
                </TableCell>
              </TableRow>
            ) : (
              categorias.map((categoria) => (
                <TableRow key={categoria.id}>
                  <TableCell className="font-medium">{categoria.nombre}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[420px] truncate">
                    {categoria.descripcion?.trim() || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={categoria.activo ? "secondary" : "destructive"}>
                      {categoria.activo ? "Activa" : "Inactiva"}
                    </Badge>
                  </TableCell>
                  {puedeEditar ? (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${categoria.nombre}`}
                        onClick={() => abrirEditar(categoria)}
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
            <DialogTitle>{editando ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={enviar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria-nombre">Nombre *</Label>
              <Input
                id="categoria-nombre"
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
                maxLength={120}
                required
                disabled={pendiente}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria-descripcion">Descripción</Label>
              <Textarea
                id="categoria-descripcion"
                value={descripcion}
                onChange={(evento) => setDescripcion(evento.target.value)}
                maxLength={500}
                disabled={pendiente}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="categoria-activa">Activa</Label>
              <Switch id="categoria-activa" checked={activo} onCheckedChange={setActivo} disabled={pendiente} />
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
