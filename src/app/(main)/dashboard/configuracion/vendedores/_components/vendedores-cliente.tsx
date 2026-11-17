"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2, Pencil, Plus, Users } from "lucide-react";

import { FORM_INPUT, FORM_TEXTAREA, FormField } from "@/components/formularios/formulario";
import { type ColumnaLista, PillEstado, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { actualizarVendedor, crearVendedor } from "@/lib/vendedores/acciones";
import type { Vendedor } from "@/lib/vendedores/tipos";

const columnasVendedores: readonly ColumnaLista<Vendedor>[] = [
  {
    clave: "nombre",
    encabezado: "Nombre",
    celda: (vendedor) => <span className="font-medium">{vendedor.nombre}</span>,
  },
  {
    clave: "identificacion",
    encabezado: "Identificación",
    celda: (vendedor) => <span className="text-muted-foreground">{vendedor.identificacion?.trim() || "—"}</span>,
  },
  {
    clave: "observacion",
    encabezado: "Observación",
    celda: (vendedor) => (
      <span className="text-muted-foreground max-w-[420px] truncate">{vendedor.observacion?.trim() || "—"}</span>
    ),
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (vendedor) => (
      <PillEstado tono={vendedor.activo ? "exito" : "neutro"}>{vendedor.activo ? "Activo" : "Inactivo"}</PillEstado>
    ),
  },
];

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

  function abrirNuevo() {
    setEditando(null);
    setNombre("");
    setIdentificacion("");
    setObservacion("");
    setActivo(true);
    setError(null);
    setAbierto(true);
  }

  function abrirEditar(vendedor: Vendedor) {
    setEditando(vendedor);
    setNombre(vendedor.nombre);
    setIdentificacion(vendedor.identificacion ?? "");
    setObservacion(vendedor.observacion ?? "");
    setActivo(vendedor.activo);
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

      <TarjetaLista data-lista="configuracion-vendedores">
        <TablaLista
          columnas={columnasVendedores}
          filas={vendedores}
          claveFila={(vendedor) => vendedor.id}
          acciones={
            puedeEditar
              ? (vendedor) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar ${vendedor.nombre}`}
                    onClick={() => abrirEditar(vendedor)}
                  >
                    <Pencil />
                  </Button>
                )
              : undefined
          }
          vacio={{
            titulo: "¡Aún no tienes vendedores!",
            descripcion: "Crea el primer vendedor para asignarlo a tus documentos de venta.",
            icono: <Users className="size-10" />,
            accion: puedeEditar ? (
              <Button type="button" onClick={abrirNuevo}>
                <Plus />
                Nuevo vendedor
              </Button>
            ) : undefined,
          }}
        />
      </TarjetaLista>

      <Dialog open={abierto} onOpenChange={cambiarAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar vendedor" : "Nuevo vendedor"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={enviar} className="flex flex-col gap-4">
            <FormField htmlFor="vendedor-nombre" label="Nombre" required>
              <Input
                id="vendedor-nombre"
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
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
