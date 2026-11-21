"use client";

import { Barcode, Plus, Trash2 } from "lucide-react";

import { FormSectionTitle } from "@/components/formularios/formulario";
import { type ColumnaLista, TablaLista } from "@/components/listas/tabla-lista";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";

import type { CodigoBarraDraft, UnidadDraft } from "./tipos";
import { claveDeError } from "./validacion";

function ErrorCelda({ mensaje }: { readonly mensaje: string | undefined }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="text-destructive text-xs leading-4">
      {mensaje}
    </p>
  );
}

export function EditorCodigosBarra({
  filas,
  unidades,
  errores,
  onCambiar,
  onAgregar,
  onQuitar,
  onMarcarPrincipal,
}: {
  readonly filas: readonly CodigoBarraDraft[];
  readonly unidades: readonly UnidadDraft[];
  readonly errores: Readonly<Record<string, string>>;
  readonly onCambiar: (clave: string, cambios: Partial<CodigoBarraDraft>) => void;
  readonly onAgregar: () => void;
  readonly onQuitar: (clave: string) => void;
  readonly onMarcarPrincipal: (clave: string) => void;
}) {
  const opcionesUnidad = unidades
    .filter((unidad) => unidad.nombre.trim() !== "")
    .map((unidad) => ({ value: unidad.clave, label: unidad.nombre }));

  const columnas: readonly ColumnaLista<CodigoBarraDraft>[] = [
    {
      clave: "codigo",
      encabezado: "Código",
      celda: (fila) => (
        <div className="flex min-w-56 flex-col gap-1">
          <InputGroup className="w-56">
            <InputGroupAddon align="inline-start">
              <Barcode />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={`Código de barra ${fila.codigo || "nuevo"}`}
              value={fila.codigo}
              maxLength={64}
              placeholder="Escanea o escribe el código"
              onChange={(evento) => onCambiar(fila.clave, { codigo: evento.target.value })}
            />
          </InputGroup>
          <ErrorCelda mensaje={errores[claveDeError("codigos", filas.indexOf(fila), "codigo")]} />
        </div>
      ),
    },
    {
      clave: "unidad",
      encabezado: "Unidad",
      celda: (fila) => (
        <div className="flex min-w-44 flex-col gap-1">
          <SelectCampo
            aria-label={`Unidad del código ${fila.codigo || "nuevo"}`}
            opciones={opcionesUnidad}
            valor={fila.unidadClave}
            onCambio={(unidadClave) => onCambiar(fila.clave, { unidadClave })}
            etiquetaVacia="Unidad base"
            className="h-8 w-44"
          />
          <ErrorCelda mensaje={errores[claveDeError("codigos", filas.indexOf(fila), "unidad_id")]} />
        </div>
      ),
    },
    {
      clave: "principal",
      encabezado: "Principal",
      alineacion: "centro",
      celda: (fila) => (
        <span className="flex justify-center">
          <Switch
            checked={fila.principal}
            aria-label={`Código principal ${fila.codigo || "nuevo"}`}
            onCheckedChange={() => onMarcarPrincipal(fila.clave)}
          />
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <FormSectionTitle descripcion="El código principal es el que usa la pistola del POS por defecto. Un producto puede tener varios códigos, pero un solo principal.">
          Códigos de barra
        </FormSectionTitle>
        <Button type="button" variant="outline" size="sm" onClick={onAgregar}>
          <Plus data-icon="inline-start" />
          Agregar código
        </Button>
      </div>

      {errores.codigos ? (
        <p role="alert" className="text-destructive text-sm">
          {errores.codigos}
        </p>
      ) : null}

      <div className="ring-foreground/10 overflow-hidden rounded-lg ring-1">
        <TablaLista
          columnas={columnas}
          filas={filas}
          claveFila={(fila) => fila.clave}
          acciones={(fila) => (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Quitar el código ${fila.codigo || "nuevo"}`}
              onClick={() => onQuitar(fila.clave)}
            >
              <Trash2 />
            </Button>
          )}
          vacio={{
            titulo: "Sin códigos de barra",
            descripcion: "Agrega el EAN/UPC del fabricante o un código interno para encontrarlo rápido en el POS.",
          }}
          densidad="compacta"
        />
      </div>
    </div>
  );
}
