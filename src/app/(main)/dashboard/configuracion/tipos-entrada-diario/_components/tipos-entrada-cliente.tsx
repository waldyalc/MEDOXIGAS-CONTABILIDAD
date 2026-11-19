"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2, NotebookText, Pencil, Plus } from "lucide-react";

import { CampoFormulario } from "@/components/formularios/campo-formulario";
import { FORM_INPUT } from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { type ColumnaLista, PillEstado, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { requerido } from "@/lib/formularios/validacion";
import { actualizarTipoEntrada, crearTipoEntrada } from "@/lib/tipos-entrada-diario/acciones";
import type { TipoEntradaDiario } from "@/lib/tipos-entrada-diario/tipos";

const columnasTipos: readonly ColumnaLista<TipoEntradaDiario>[] = [
  {
    clave: "nombre",
    encabezado: "Nombre",
    celda: (tipo) => <span className="font-medium">{tipo.nombre}</span>,
  },
  {
    clave: "prefijo",
    encabezado: "Prefijo",
    celda: (tipo) => <span className="font-mono text-sm">{tipo.prefijo}</span>,
  },
  {
    clave: "siguiente",
    encabezado: "Siguiente número",
    celda: (tipo) => <span className="font-mono text-sm tabular-nums">{tipo.siguiente}</span>,
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (tipo) => (
      <PillEstado tono={tipo.activo ? "exito" : "neutro"}>{tipo.activo ? "Activo" : "Inactivo"}</PillEstado>
    ),
  },
];

export function TiposEntradaCliente({
  tipos,
  puedeEditar,
}: {
  readonly tipos: TipoEntradaDiario[];
  readonly puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<TipoEntradaDiario | null>(null);
  const [nombre, setNombre] = useState("");
  const [prefijo, setPrefijo] = useState("");
  const [activo, setActivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const validacion = useValidacionFormulario();

  function abrirNuevo() {
    setEditando(null);
    setNombre("");
    setPrefijo("");
    setActivo(true);
    setError(null);
    validacion.limpiarTodo();
    setAbierto(true);
  }

  function abrirEditar(tipo: TipoEntradaDiario) {
    setEditando(tipo);
    setNombre(tipo.nombre);
    setPrefijo(tipo.prefijo);
    setActivo(tipo.activo);
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
        requerido("tipo-nombre", nombre, "El nombre es requerido."),
        requerido("tipo-prefijo", prefijo, "El prefijo es requerido."),
      ])
    ) {
      return;
    }

    const entrada = { nombre: nombre.trim(), prefijo: prefijo.trim(), activo };

    iniciar(async () => {
      const resultado = editando ? await actualizarTipoEntrada(editando.id, entrada) : await crearTipoEntrada(entrada);

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
          Cada tipo numera sus asientos de forma independiente, con su prefijo (ej. AC-1, NO-1).
        </p>
        {puedeEditar ? (
          <Button type="button" onClick={abrirNuevo}>
            <Plus />
            Nuevo tipo
          </Button>
        ) : null}
      </div>

      <TarjetaLista data-lista="configuracion-tipos-entrada">
        <TablaLista
          columnas={columnasTipos}
          filas={tipos}
          claveFila={(tipo) => tipo.id}
          acciones={
            puedeEditar
              ? (tipo) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar ${tipo.nombre}`}
                    onClick={() => abrirEditar(tipo)}
                  >
                    <Pencil />
                  </Button>
                )
              : undefined
          }
          vacio={{
            titulo: "¡Aún no tienes tipos de entrada!",
            descripcion: "Crea el primero para numerar tus asientos manuales.",
            icono: <NotebookText className="size-10" />,
            accion: puedeEditar ? (
              <Button type="button" onClick={abrirNuevo}>
                <Plus />
                Nuevo tipo
              </Button>
            ) : undefined,
          }}
        />
      </TarjetaLista>

      <Dialog open={abierto} onOpenChange={cambiarAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar tipo de entrada" : "Nuevo tipo de entrada"}</DialogTitle>
          </DialogHeader>
          <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
            <CampoFormulario htmlFor="tipo-nombre" label="Nombre" required error={validacion.errorDe("tipo-nombre")}>
              <Input
                id="tipo-nombre"
                value={nombre}
                onChange={(evento) => {
                  setNombre(evento.target.value);
                  validacion.limpiar("tipo-nombre");
                }}
                maxLength={120}
                required
                disabled={pendiente}
                className={FORM_INPUT}
                placeholder="Ej. Costo de ventas"
              />
            </CampoFormulario>
            <CampoFormulario htmlFor="tipo-prefijo" label="Prefijo" required error={validacion.errorDe("tipo-prefijo")}>
              <Input
                id="tipo-prefijo"
                value={prefijo}
                onChange={(evento) => {
                  setPrefijo(evento.target.value);
                  validacion.limpiar("tipo-prefijo");
                }}
                maxLength={10}
                required
                disabled={pendiente}
                className={FORM_INPUT}
                placeholder="Ej. CV"
              />
            </CampoFormulario>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="tipo-activo">Activo</Label>
              <Switch id="tipo-activo" checked={activo} onCheckedChange={setActivo} disabled={pendiente} />
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
