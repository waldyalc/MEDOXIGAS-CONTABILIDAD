"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2, Pencil, Plus, Tag } from "lucide-react";

import { CampoFormulario } from "@/components/formularios/campo-formulario";
import { FORM_INPUT, FORM_TEXTAREA } from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import {
  type ColumnaLista,
  ContenedorLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { requerido } from "@/lib/formularios/validacion";
import { actualizarCategoria, crearCategoria } from "@/lib/inventario/acciones";
import type { CategoriaProducto } from "@/lib/inventario/tipos";

const columnas: readonly ColumnaLista<CategoriaProducto>[] = [
  {
    clave: "nombre",
    encabezado: "Nombre",
    celda: (categoria) => <span className="font-medium">{categoria.nombre}</span>,
  },
  {
    clave: "descripcion",
    encabezado: "Descripción",
    celda: (categoria) => (
      <span className="text-muted-foreground max-w-[420px] truncate">{categoria.descripcion?.trim() || "—"}</span>
    ),
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (categoria) => (
      <PillEstado tono={categoria.activo ? "exito" : "neutro"}>{categoria.activo ? "Activa" : "Inactiva"}</PillEstado>
    ),
  },
];

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
  const validacion = useValidacionFormulario();

  function abrirNueva() {
    setEditando(null);
    setNombre("");
    setDescripcion("");
    setActivo(true);
    setError(null);
    validacion.limpiarTodo();
    setAbierto(true);
  }

  function abrirEditar(categoria: CategoriaProducto) {
    setEditando(categoria);
    setNombre(categoria.nombre);
    setDescripcion(categoria.descripcion ?? "");
    setActivo(categoria.activo);
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

    if (!validacion.validar([requerido("categoria-nombre", nombre, "El nombre es requerido.")])) return;

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
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Categorías"
        subtitulo="Agrupa los productos para encontrarlos y reportarlos mejor."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Inventario", href: "/dashboard/inventario" },
          { etiqueta: "Categorías" },
        ]}
        acciones={
          puedeEditar ? (
            <Button type="button" onClick={abrirNueva}>
              <Plus />
              Nueva categoría
            </Button>
          ) : null
        }
      />

      <TarjetaLista data-lista="inventario-categorias">
        <TablaLista
          columnas={columnas}
          filas={categorias}
          claveFila={(categoria) => categoria.id}
          acciones={
            puedeEditar
              ? (categoria) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar ${categoria.nombre}`}
                    onClick={() => abrirEditar(categoria)}
                  >
                    <Pencil />
                  </Button>
                )
              : undefined
          }
          vacio={{
            titulo: "¡Aún no tienes categorías!",
            descripcion: "Crea la primera para agrupar tus productos.",
            icono: <Tag className="size-10" />,
            accion: puedeEditar ? (
              <Button type="button" onClick={abrirNueva}>
                <Plus />
                Nueva categoría
              </Button>
            ) : undefined,
          }}
        />
      </TarjetaLista>

      <Dialog open={abierto} onOpenChange={cambiarAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
            <CampoFormulario
              htmlFor="categoria-nombre"
              label="Nombre"
              required
              error={validacion.errorDe("categoria-nombre")}
            >
              <Input
                id="categoria-nombre"
                value={nombre}
                onChange={(evento) => {
                  setNombre(evento.target.value);
                  validacion.limpiar("categoria-nombre");
                }}
                maxLength={120}
                required
                disabled={pendiente}
                className={FORM_INPUT}
              />
            </CampoFormulario>
            <CampoFormulario htmlFor="categoria-descripcion" label="Descripción">
              <Textarea
                id="categoria-descripcion"
                value={descripcion}
                onChange={(evento) => setDescripcion(evento.target.value)}
                maxLength={500}
                disabled={pendiente}
                className={FORM_TEXTAREA}
              />
            </CampoFormulario>
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
    </ContenedorLista>
  );
}
