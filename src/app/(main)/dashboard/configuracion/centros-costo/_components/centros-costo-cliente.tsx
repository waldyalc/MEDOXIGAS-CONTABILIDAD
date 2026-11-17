"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2, Pencil, Plus, Tags } from "lucide-react";

import { CampoFormulario } from "@/components/formularios/campo-formulario";
import { FORM_INPUT, FORM_TEXTAREA } from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { type ColumnaLista, PillEstado, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { actualizarCentroCosto, crearCentroCosto } from "@/lib/centros-costo/acciones";
import type { CentroCosto } from "@/lib/centros-costo/tipos";
import { requerido } from "@/lib/formularios/validacion";

const columnasCentros: readonly ColumnaLista<CentroCosto>[] = [
  {
    clave: "codigo",
    encabezado: "Código",
    celda: (centro) => <span className="font-mono text-sm">{centro.codigo}</span>,
  },
  {
    clave: "nombre",
    encabezado: "Nombre",
    celda: (centro) => <span className="font-medium">{centro.nombre}</span>,
  },
  {
    clave: "descripcion",
    encabezado: "Descripción",
    celda: (centro) => (
      <span className="text-muted-foreground max-w-[420px] truncate">{centro.descripcion?.trim() || "—"}</span>
    ),
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (centro) => (
      <PillEstado tono={centro.activo ? "exito" : "neutro"}>{centro.activo ? "Activo" : "Inactivo"}</PillEstado>
    ),
  },
];

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
  const validacion = useValidacionFormulario();

  function abrirNuevo() {
    setEditando(null);
    setCodigo("");
    setNombre("");
    setDescripcion("");
    setActivo(true);
    setError(null);
    validacion.limpiarTodo();
    setAbierto(true);
  }

  function abrirEditar(centro: CentroCosto) {
    setEditando(centro);
    setCodigo(centro.codigo);
    setNombre(centro.nombre);
    setDescripcion(centro.descripcion ?? "");
    setActivo(centro.activo);
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

    if (
      !validacion.validar([
        requerido("centro-codigo", codigo, "El código es requerido."),
        requerido("centro-nombre", nombre, "El nombre es requerido."),
      ])
    ) {
      return;
    }

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

      <TarjetaLista data-lista="configuracion-centros-costo">
        <TablaLista
          columnas={columnasCentros}
          filas={centros}
          claveFila={(centro) => centro.id}
          acciones={
            puedeEditar
              ? (centro) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar ${centro.nombre}`}
                    onClick={() => abrirEditar(centro)}
                  >
                    <Pencil />
                  </Button>
                )
              : undefined
          }
          vacio={{
            titulo: "¡Aún no tienes centros de costo!",
            descripcion: "Crea el primero para clasificar facturas, compras y asientos.",
            icono: <Tags className="size-10" />,
            accion: puedeEditar ? (
              <Button type="button" onClick={abrirNuevo}>
                <Plus />
                Nuevo centro
              </Button>
            ) : undefined,
          }}
        />
      </TarjetaLista>

      <Dialog open={abierto} onOpenChange={cambiarAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar centro de costo" : "Nuevo centro de costo"}</DialogTitle>
          </DialogHeader>
          <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
            <CampoFormulario
              htmlFor="centro-codigo"
              label="Código"
              required
              error={validacion.errorDe("centro-codigo")}
            >
              <Input
                id="centro-codigo"
                value={codigo}
                onChange={(evento) => {
                  setCodigo(evento.target.value);
                  validacion.limpiar("centro-codigo");
                }}
                maxLength={30}
                placeholder="Ej. CC-01"
                required
                disabled={pendiente}
                className={FORM_INPUT}
              />
            </CampoFormulario>
            <CampoFormulario
              htmlFor="centro-nombre"
              label="Nombre"
              required
              error={validacion.errorDe("centro-nombre")}
            >
              <Input
                id="centro-nombre"
                value={nombre}
                onChange={(evento) => {
                  setNombre(evento.target.value);
                  validacion.limpiar("centro-nombre");
                }}
                maxLength={120}
                required
                disabled={pendiente}
                className={FORM_INPUT}
              />
            </CampoFormulario>
            <CampoFormulario htmlFor="centro-descripcion" label="Descripción">
              <Textarea
                id="centro-descripcion"
                value={descripcion}
                onChange={(evento) => setDescripcion(evento.target.value)}
                maxLength={500}
                disabled={pendiente}
                className={FORM_TEXTAREA}
              />
            </CampoFormulario>
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
