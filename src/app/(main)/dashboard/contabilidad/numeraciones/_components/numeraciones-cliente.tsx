"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { DatePicker, DatePickerCampo } from "@/components/date-picker";
import { usePagina } from "@/components/ficha/ficha-ui";
import { FORM_INPUT, FORM_SELECT, FormField } from "@/components/formularios/formulario";
import { Hash, Loader2, Pencil, Plus } from "@/components/icons";
import { PaginadorLocal } from "@/components/listas/paginador-local";
import { BarraLista, type ColumnaLista, PillEstado, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatoDia, formatoEntero } from "@/lib/formato";
import { TAMANOS_PAGINA } from "@/lib/listas/parametros";
import { actualizarNumeracion, crearNumeracion } from "@/lib/numeraciones/acciones";
import { type Numeracion, TIPO_SIN_NCF } from "@/lib/numeraciones/tipos";

import {
  etiquetaTipoDocumento,
  OPCIONES_TIPO_NUEVA_NUMERACION,
  opcionesTipoDocumento,
  prefijoTipoDocumento,
} from "./tipos-documento";

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
          <DatePickerCampo
            id="vence"
            name="vence"
            defaultValue={numeracion.vence ?? ""}
            className={FORM_INPUT}
            permitirLimpiar
          />
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

function FormularioNuevaNumeracion({ onGuardado }: { readonly onGuardado: () => void }) {
  const [tipoNuevo, setTipoNuevo] = useState("");
  const [vence, setVence] = useState("");
  const [activa, setActiva] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function cambiarTipo(valor: string) {
    setTipoNuevo(valor);
    setError(null);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);

    iniciar(async () => {
      const resultado = await crearNumeracion({
        tipo_comprobante: tipoNuevo,
        nombre: String(datos.get("nombre") ?? ""),
        prefijo: String(datos.get("prefijo") ?? ""),
        siguiente: String(datos.get("siguiente") ?? ""),
        hasta: String(datos.get("hasta") ?? ""),
        vence,
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
        <FormField htmlFor="tipo-comprobante" label="Tipo de documento" required>
          <SelectCampo
            id="tipo-comprobante"
            opciones={OPCIONES_TIPO_NUEVA_NUMERACION}
            valor={tipoNuevo}
            onCambio={cambiarTipo}
            requerido
            aria-label="Tipo de documento"
            className={FORM_SELECT}
          />
        </FormField>

        {tipoNuevo !== "" && tipoNuevo !== TIPO_SIN_NCF ? (
          <p className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm">
            El prefijo de esta serie es <span className="font-mono">{prefijoTipoDocumento(tipoNuevo)}</span>.
          </p>
        ) : null}

        {tipoNuevo === TIPO_SIN_NCF ? (
          <FormField htmlFor="nuevo-prefijo" label="Prefijo" required>
            <Input id="nuevo-prefijo" name="prefijo" required maxLength={10} placeholder="REC" className={FORM_INPUT} />
          </FormField>
        ) : null}

        <FormField htmlFor="nuevo-nombre" label="Nombre" required>
          <Input id="nuevo-nombre" name="nombre" required maxLength={120} className={FORM_INPUT} />
        </FormField>

        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <FormField htmlFor="nuevo-siguiente" label="Siguiente" required>
            <Input
              id="nuevo-siguiente"
              name="siguiente"
              type="number"
              min={1}
              step={1}
              required
              defaultValue={1}
              className={FORM_INPUT}
            />
          </FormField>
          <FormField htmlFor="nuevo-hasta" label="Hasta">
            <Input
              id="nuevo-hasta"
              name="hasta"
              type="number"
              min={1}
              step={1}
              placeholder="Sin límite"
              className={FORM_INPUT}
            />
          </FormField>
        </div>

        <FormField htmlFor="nuevo-vence" label="Vencimiento del NCF">
          <DatePicker id="nuevo-vence" value={vence} onChange={setVence} />
        </FormField>

        <div className="border-border flex items-center justify-between gap-3 rounded-xl border p-3">
          <Label htmlFor="nuevo-activa">Activa</Label>
          <Switch id="nuevo-activa" checked={activa} onCheckedChange={setActiva} />
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
  const [creando, setCreando] = useState(false);
  const [tipo, setTipo] = useState("");

  const opciones = opcionesTipoDocumento(numeraciones);
  const filtradas = tipo === "" ? numeraciones : numeraciones.filter((fila) => fila.tipo_comprobante === tipo);
  const { pagina: paginaActual, setPagina, porPagina, setPorPagina } = usePagina(filtradas.length, POR_PAGINA);
  const visibles = filtradas.slice(paginaActual * porPagina, (paginaActual + 1) * porPagina);

  function cambiarDialogo(abierto: boolean) {
    if (!abierto) setEditando(null);
  }

  function cerrarTrasGuardar() {
    setEditando(null);
    router.refresh();
  }

  function cerrarCrearTrasGuardar() {
    setCreando(false);
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
          {puedeEditar ? (
            <Button type="button" className="ml-auto" onClick={() => setCreando(true)}>
              <Plus />
              Nueva numeración
            </Button>
          ) : null}
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
            accion: puedeEditar ? (
              <Button type="button" onClick={() => setCreando(true)}>
                <Plus />
                Nueva numeración
              </Button>
            ) : undefined,
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
          porPagina={porPagina}
          opciones={TAMANOS_PAGINA}
          onCambiarPorPagina={setPorPagina}
          etiqueta="numeraciones"
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

      <Dialog open={creando} onOpenChange={setCreando}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva numeración</DialogTitle>
          </DialogHeader>
          {creando ? <FormularioNuevaNumeracion onGuardado={cerrarCrearTrasGuardar} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
