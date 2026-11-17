"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Hash, Loader2, Pencil } from "lucide-react";

import { FORM_INPUT, FormField } from "@/components/formularios/formulario";
import { PaginadorLocal } from "@/components/listas/paginador-local";
import { BarraLista, type ColumnaLista, PillEstado, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatoDia, formatoEntero } from "@/lib/formato";
import { actualizarNumeracion } from "@/lib/numeraciones/acciones";
import type { Numeracion } from "@/lib/numeraciones/tipos";

import { etiquetaTipoDocumento, opcionesTipoDocumento } from "./tipos-documento";

const POR_PAGINA = 25;

const COLUMNAS: readonly ColumnaLista<Numeracion>[] = [
  {
    clave: "tipo",
    encabezado: "Tipo de documento",
    celda: (numeracion) => etiquetaTipoDocumento(numeracion.tipo_comprobante),
  },
  {
    clave: "nombre",
    encabezado: "Nombre",
    celda: (numeracion) => <span className="text-foreground font-medium">{numeracion.nombre}</span>,
  },
  {
    clave: "prefijo",
    encabezado: "Prefijo",
    celda: (numeracion) => <span className="font-mono text-xs">{numeracion.prefijo}</span>,
  },
  {
    clave: "siguiente",
    encabezado: "Siguiente",
    alineacion: "derecha",
    celda: (numeracion) => formatoEntero(numeracion.siguiente),
  },
  {
    clave: "hasta",
    encabezado: "Hasta",
    alineacion: "derecha",
    celda: (numeracion) => formatoEntero(numeracion.hasta),
  },
  {
    clave: "vence",
    encabezado: "Vence",
    celda: (numeracion) => formatoDia(numeracion.vence),
  },
  {
    clave: "activa",
    encabezado: "Activa",
    celda: (numeracion) => (
      <PillEstado tono={numeracion.activa ? "exito" : "neutro"}>{numeracion.activa ? "Activa" : "Inactiva"}</PillEstado>
    ),
  },
];

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
      <div className="flex flex-col gap-4">
        <p className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm">
          {etiquetaTipoDocumento(numeracion.tipo_comprobante)} · Prefijo {numeracion.prefijo}
        </p>

        <FormField htmlFor="nombre" label="Nombre" required>
          <Input
            id="nombre"
            name="nombre"
            required
            maxLength={120}
            defaultValue={numeracion.nombre}
            className={FORM_INPUT}
          />
        </FormField>

        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <FormField htmlFor="siguiente" label="Siguiente" required>
            <Input
              id="siguiente"
              name="siguiente"
              type="number"
              min={1}
              step={1}
              required
              defaultValue={numeracion.siguiente}
              className={FORM_INPUT}
            />
          </FormField>
          <FormField htmlFor="hasta" label="Hasta">
            <Input
              id="hasta"
              name="hasta"
              type="number"
              min={1}
              step={1}
              defaultValue={numeracion.hasta ?? ""}
              placeholder="Sin límite"
              className={FORM_INPUT}
            />
          </FormField>
        </div>

        <FormField htmlFor="vence" label="Vencimiento del NCF">
          <Input id="vence" name="vence" type="date" defaultValue={numeracion.vence ?? ""} className={FORM_INPUT} />
        </FormField>

        <div className="border-border flex items-center justify-between gap-3 rounded-xl border p-3">
          <Label htmlFor="activa">Activa</Label>
          <Switch id="activa" checked={activa} onCheckedChange={setActiva} />
        </div>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" className="h-11 rounded-[12px] px-6" />}>
          Cancelar
        </DialogClose>
        <Button type="submit" disabled={pendiente} className="h-11 rounded-[12px] px-6">
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
  const [tipo, setTipo] = useState("");
  const [pagina, setPagina] = useState(0);

  const opciones = opcionesTipoDocumento(numeraciones);
  const filtradas = tipo === "" ? numeraciones : numeraciones.filter((fila) => fila.tipo_comprobante === tipo);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = filtradas.slice(paginaActual * POR_PAGINA, (paginaActual + 1) * POR_PAGINA);

  function cambiarDialogo(abierto: boolean) {
    if (!abierto) setEditando(null);
  }

  function cerrarTrasGuardar() {
    setEditando(null);
    router.refresh();
  }

  function cambiarTipo(valor: string) {
    setTipo(valor);
    setPagina(0);
  }

  return (
    <>
      <TarjetaLista data-lista="numeraciones">
        <BarraLista className="h-auto min-h-14 flex-wrap py-2 sm:h-14 sm:py-0">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="tipo-documento" className="text-muted-foreground text-sm font-normal">
              Tipo de documento
            </Label>
            <SelectCampo
              id="tipo-documento"
              valor={tipo}
              onCambio={cambiarTipo}
              opciones={opciones}
              etiquetaVacia="Todos los tipos"
              aria-label="Tipo de documento"
              className="h-8 w-[220px]"
            />
          </div>
        </BarraLista>

        <TablaLista
          columnas={COLUMNAS}
          filas={visibles}
          claveFila={(numeracion) => numeracion.id}
          vacio={{
            filtrada: tipo !== "",
            titulo: tipo === "" ? "No hay numeraciones registradas" : "Sin resultados",
            descripcion:
              tipo === ""
                ? "No hay secuencias de NCF para mostrar."
                : `No hay numeraciones del tipo ${etiquetaTipoDocumento(tipo)}.`,
            icono: <Hash className="size-10" />,
          }}
          acciones={
            puedeEditar
              ? (numeracion) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar numeración ${numeracion.prefijo}`}
                    onClick={() => setEditando(numeracion)}
                  >
                    <Pencil />
                  </Button>
                )
              : undefined
          }
        />

        <PaginadorLocal
          total={filtradas.length}
          pagina={paginaActual}
          setPagina={setPagina}
          porPagina={POR_PAGINA}
          etiqueta="numeraciones"
          className="border-border h-14 border-t px-4 text-slate-700 dark:text-slate-300"
        />
      </TarjetaLista>

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
    </>
  );
}
