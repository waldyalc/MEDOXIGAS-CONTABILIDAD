"use client";

import { Plus, Trash2 } from "lucide-react";

import { FormSectionTitle } from "@/components/formularios/formulario";
import { type ColumnaLista, TablaLista } from "@/components/listas/tabla-lista";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import type { UnidadDraft } from "./tipos";
import { claveDeError } from "./validacion";

function ErrorCelda({ mensaje }: { readonly mensaje: string | undefined }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="text-destructive text-xs leading-4">
      {mensaje}
    </p>
  );
}

function Casilla({
  etiqueta,
  marcada,
  onCambiar,
}: {
  readonly etiqueta: string;
  readonly marcada: boolean;
  readonly onCambiar: (marcada: boolean) => void;
}) {
  return (
    <span className="flex justify-center">
      <Checkbox checked={marcada} aria-label={etiqueta} onCheckedChange={(valor) => onCambiar(valor === true)} />
    </span>
  );
}

export function EditorUnidades({
  filas,
  errores,
  onCambiar,
  onAgregar,
  onQuitar,
}: {
  readonly filas: readonly UnidadDraft[];
  readonly errores: Readonly<Record<string, string>>;
  readonly onCambiar: (clave: string, cambios: Partial<UnidadDraft>) => void;
  readonly onAgregar: () => void;
  readonly onQuitar: (clave: string) => void;
}) {
  const columnas: readonly ColumnaLista<UnidadDraft>[] = [
    {
      clave: "nombre",
      encabezado: "Presentación",
      celda: (fila) => (
        <div className="flex min-w-40 flex-col gap-1">
          <Input
            aria-label={`Nombre de la unidad ${fila.nombre || "nueva"}`}
            value={fila.nombre}
            maxLength={60}
            placeholder="Ej. Caja 50 lb"
            onChange={(evento) => onCambiar(fila.clave, { nombre: evento.target.value })}
            className="h-8"
          />
          <ErrorCelda mensaje={errores[claveDeError("unidades", filas.indexOf(fila), "nombre")]} />
        </div>
      ),
    },
    {
      clave: "factor",
      encabezado: "Factor base",
      alineacion: "derecha",
      celda: (fila) => (
        <div className="flex min-w-24 flex-col items-end gap-1">
          <Input
            aria-label={`Factor base de ${fila.nombre || "la unidad"}`}
            inputMode="decimal"
            value={fila.factorBase}
            placeholder="1"
            onChange={(evento) => onCambiar(fila.clave, { factorBase: evento.target.value })}
            className="h-8 w-24 text-right"
          />
          <ErrorCelda mensaje={errores[claveDeError("unidades", filas.indexOf(fila), "factor_base")]} />
        </div>
      ),
    },
    {
      clave: "precio",
      encabezado: "Precio",
      alineacion: "derecha",
      celda: (fila) => (
        <div className="flex min-w-28 flex-col items-end gap-1">
          <Input
            aria-label={`Precio de ${fila.nombre || "la unidad"}`}
            inputMode="decimal"
            value={fila.precio}
            placeholder="0.00"
            onChange={(evento) => onCambiar(fila.clave, { precio: evento.target.value })}
            className="h-8 w-28 text-right tabular-nums"
          />
          <ErrorCelda mensaje={errores[claveDeError("unidades", filas.indexOf(fila), "precio")]} />
        </div>
      ),
    },
    {
      clave: "compra",
      encabezado: "Compra",
      alineacion: "centro",
      celda: (fila) => (
        <Casilla
          etiqueta={`Se compra en ${fila.nombre || "esta unidad"}`}
          marcada={fila.esCompra}
          onCambiar={(marcada) => onCambiar(fila.clave, { esCompra: marcada })}
        />
      ),
    },
    {
      clave: "venta",
      encabezado: "Venta",
      alineacion: "centro",
      celda: (fila) => (
        <Casilla
          etiqueta={`Se vende en ${fila.nombre || "esta unidad"}`}
          marcada={fila.esVenta}
          onCambiar={(marcada) => onCambiar(fila.clave, { esVenta: marcada })}
        />
      ),
    },
    {
      clave: "activa",
      encabezado: "Activa",
      alineacion: "centro",
      celda: (fila) => (
        <Casilla
          etiqueta={`${fila.nombre || "La unidad"} activa`}
          marcada={fila.activa}
          onCambiar={(marcada) => onCambiar(fila.clave, { activa: marcada })}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <FormSectionTitle descripcion="El stock se guarda en la unidad base; aquí van las presentaciones (caja, rollo, libra) y cuántas unidades base contiene cada una.">
          Unidades de medida
        </FormSectionTitle>
        <Button type="button" variant="outline" size="sm" onClick={onAgregar}>
          <Plus data-icon="inline-start" />
          Agregar unidad
        </Button>
      </div>

      {errores.unidades ? (
        <p role="alert" className="text-destructive text-sm">
          {errores.unidades}
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
              aria-label={`Quitar la unidad ${fila.nombre || "nueva"}`}
              onClick={() => onQuitar(fila.clave)}
            >
              <Trash2 />
            </Button>
          )}
          vacio={{
            titulo: "Sin presentaciones",
            descripcion:
              "El producto se vende en su unidad base. Agrega una presentación si vendes cajas, rollos o libras.",
          }}
          densidad="compacta"
        />
      </div>
    </div>
  );
}
