"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2, Pencil, Plus } from "lucide-react";

import { FORM_INPUT, FORM_TEXTAREA, FormField } from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requerido } from "@/lib/formularios/validacion";
import { actualizarVendedor, crearVendedor } from "@/lib/vendedores/acciones";
import type { Vendedor } from "@/lib/vendedores/tipos";

export function VendedoresCliente({
  vendedores,
  puedeEditar,
}: {
  readonly vendedores: Vendedor[];
  readonly puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<Vendedor | null>(null);
  const [nombre, setNombre] = useState("");
  const [identificacion, setIdentificacion] = useState("");
  const [observacion, setObservacion] = useState("");
  const [activo, setActivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const validacion = useValidacionFormulario();

  function abrirNuevo() {
    setEditando(null);
    setNombre("");
    setIdentificacion("");
    setObservacion("");
    setActivo(true);
    setError(null);
    validacion.limpiarTodo();
    setAbierto(true);
  }

  function abrirEditar(vendedor: Vendedor) {
    setEditando(vendedor);
    setNombre(vendedor.nombre);
    setIdentificacion(vendedor.identificacion ?? "");
    setObservacion(vendedor.observacion ?? "");
    setActivo(vendedor.activo);
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

    if (!validacion.validar([requerido("vendedor-nombre", nombre, "El nombre es requerido.")])) return;

    const entrada = {
      nombre: nombre.trim(),
      ...(identificacion.trim() ? { identificacion: identificacion.trim() } : {}),
      ...(observacion.trim() ? { observacion: observacion.trim() } : {}),
      activo,
    };

    iniciar(async () => {
      const resultado = editando ? await actualizarVendedor(editando.id, entrada) : await crearVendedor(entrada);

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
        <p className="text-muted-foreground text-sm">El vendedor es opcional en los documentos de venta.</p>
        {puedeEditar ? (
          <Button type="button" onClick={abrirNuevo}>
            <Plus />
            Nuevo vendedor
          </Button>
        ) : null}
      </div>

      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Identificación</TableHead>
              <TableHead>Observación</TableHead>
              <TableHead>Estado</TableHead>
              {puedeEditar ? (
                <TableHead className="w-10">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendedores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={puedeEditar ? 5 : 4} className="text-muted-foreground py-10 text-center">
                  Todavía no hay vendedores.
                </TableCell>
              </TableRow>
            ) : (
              vendedores.map((vendedor) => (
                <TableRow key={vendedor.id}>
                  <TableCell className="font-medium">{vendedor.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{vendedor.identificacion?.trim() || "—"}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[420px] truncate">
                    {vendedor.observacion?.trim() || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={vendedor.activo ? "secondary" : "destructive"}>
                      {vendedor.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  {puedeEditar ? (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${vendedor.nombre}`}
                        onClick={() => abrirEditar(vendedor)}
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
            <DialogTitle>{editando ? "Editar vendedor" : "Nuevo vendedor"}</DialogTitle>
          </DialogHeader>
          <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
            <FormField htmlFor="vendedor-nombre" label="Nombre" required error={validacion.errorDe("vendedor-nombre")}>
              <Input
                id="vendedor-nombre"
                value={nombre}
                onChange={(evento) => {
                  setNombre(evento.target.value);
                  validacion.limpiar("vendedor-nombre");
                }}
                maxLength={120}
                required
                disabled={pendiente}
                className={FORM_INPUT}
              />
            </FormField>
            <FormField htmlFor="vendedor-identificacion" label="Identificación">
              <Input
                id="vendedor-identificacion"
                value={identificacion}
                onChange={(evento) => setIdentificacion(evento.target.value)}
                maxLength={60}
                placeholder="Cédula o código interno"
                disabled={pendiente}
                className={FORM_INPUT}
              />
            </FormField>
            <FormField htmlFor="vendedor-observacion" label="Observación">
              <Textarea
                id="vendedor-observacion"
                value={observacion}
                onChange={(evento) => setObservacion(evento.target.value)}
                maxLength={500}
                disabled={pendiente}
                className={FORM_TEXTAREA}
              />
            </FormField>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="vendedor-activo">Activo</Label>
              <Switch id="vendedor-activo" checked={activo} onCheckedChange={setActivo} disabled={pendiente} />
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
