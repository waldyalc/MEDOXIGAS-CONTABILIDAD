"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2, Pencil, Plus } from "lucide-react";

import { CampoFormulario } from "@/components/formularios/campo-formulario";
import { FORM_INPUT } from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requerido } from "@/lib/formularios/validacion";
import { actualizarAlmacen, crearAlmacen } from "@/lib/inventario/acciones";
import type { Almacen } from "@/lib/inventario/tipos";

export function AlmacenesCliente({ almacenes, puedeEditar }: { almacenes: Almacen[]; puedeEditar: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<Almacen | null>(null);
  const [nombre, setNombre] = useState("");
  const [activo, setActivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const validacion = useValidacionFormulario();

  const esPrincipal = editando?.es_principal ?? false;

  function abrirNuevo() {
    setEditando(null);
    setNombre("");
    setActivo(true);
    setError(null);
    validacion.limpiarTodo();
    setAbierto(true);
  }

  function abrirEditar(almacen: Almacen) {
    setEditando(almacen);
    setNombre(almacen.nombre);
    setActivo(almacen.activo);
    setError(null);
    validacion.limpiarTodo();
    setAbierto(true);
  }

  function cambiarAbierto(abrir: boolean) {
    setAbierto(abrir);
    if (!abrir) {
      setEditando(null);
      setError(null);
      validacion.limpiarTodo();
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    if (!validacion.validar([requerido("almacen-nombre", nombre, "El nombre es requerido.")])) return;

    const entrada = {
      nombre: nombre.trim(),
      ...(esPrincipal ? {} : { activo }),
    };

    iniciar(async () => {
      const resultado = editando ? await actualizarAlmacen(editando.id, entrada) : await crearAlmacen(entrada);

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
          <h1 className="text-3xl tracking-tight">Almacenes</h1>
          <p className="text-muted-foreground text-sm">
            Los ajustes de inventario eligen el almacén; el Principal viene por defecto.
          </p>
        </div>
        {puedeEditar ? (
          <Button type="button" onClick={abrirNuevo}>
            <Plus />
            Nuevo almacén
          </Button>
        ) : null}
      </div>

      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Principal</TableHead>
              <TableHead>Estado</TableHead>
              {puedeEditar ? (
                <TableHead className="w-10">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {almacenes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={puedeEditar ? 4 : 3} className="text-muted-foreground py-10 text-center">
                  No hay almacenes configurados.
                </TableCell>
              </TableRow>
            ) : (
              almacenes.map((almacen) => (
                <TableRow key={almacen.id}>
                  <TableCell className="font-medium">{almacen.nombre}</TableCell>
                  <TableCell>{almacen.es_principal ? <Badge variant="default">Principal</Badge> : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={almacen.activo ? "secondary" : "destructive"}>
                      {almacen.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  {puedeEditar ? (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${almacen.nombre}`}
                        onClick={() => abrirEditar(almacen)}
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
            <DialogTitle>{editando ? "Editar almacén" : "Nuevo almacén"}</DialogTitle>
          </DialogHeader>
          <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
            <CampoFormulario
              htmlFor="almacen-nombre"
              label="Nombre"
              required
              error={validacion.errorDe("almacen-nombre")}
            >
              <Input
                id="almacen-nombre"
                value={nombre}
                onChange={(evento) => {
                  setNombre(evento.target.value);
                  validacion.limpiar("almacen-nombre");
                }}
                maxLength={120}
                required
                disabled={pendiente}
                className={FORM_INPUT}
              />
            </CampoFormulario>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <Label htmlFor="almacen-activo">Activo</Label>
                {esPrincipal ? (
                  <span className="text-muted-foreground text-xs">El almacén principal no se puede desactivar.</span>
                ) : null}
              </div>
              <Switch
                id="almacen-activo"
                checked={esPrincipal ? true : activo}
                onCheckedChange={setActivo}
                disabled={pendiente || esPrincipal}
              />
            </div>

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
              <Button type="submit" disabled={pendiente} className="h-11 rounded-[12px] px-6">
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
