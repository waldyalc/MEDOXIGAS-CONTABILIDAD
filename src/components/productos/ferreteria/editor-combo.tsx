"use client";

import { Plus, Trash2 } from "lucide-react";

import { FormSectionTitle } from "@/components/formularios/formulario";
import { type ColumnaLista, TablaLista } from "@/components/listas/tabla-lista";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ComponenteComboDraft } from "./tipos";
import { claveDeError } from "./validacion";

export interface ProductoParaReceta {
  id: string;
  nombre: string;
  referencia: string | null;
}

function ErrorCelda({ mensaje }: { readonly mensaje: string | undefined }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="text-destructive text-xs leading-4">
      {mensaje}
    </p>
  );
}

export function EditorCombo({
  comboId,
  filas,
  productos,
  errores,
  onCambiar,
  onAgregar,
  onQuitar,
}: {
  readonly comboId: string | null;
  readonly filas: readonly ComponenteComboDraft[];
  readonly productos: readonly ProductoParaReceta[];
  readonly errores: Readonly<Record<string, string>>;
  readonly onCambiar: (clave: string, cambios: Partial<ComponenteComboDraft>) => void;
  readonly onAgregar: () => void;
  readonly onQuitar: (clave: string) => void;
}) {
  const disponibles = productos.filter((producto) => producto.id !== comboId);

  function opcionesDe(fila: ComponenteComboDraft) {
    const ocupados = new Set(filas.filter((otra) => otra.clave !== fila.clave).map((otra) => otra.componenteId));

    return disponibles
      .filter((producto) => producto.id === fila.componenteId || !ocupados.has(producto.id))
      .map((producto) => ({
        value: producto.id,
        label: producto.referencia ? `${producto.nombre} · ${producto.referencia}` : producto.nombre,
      }));
  }

  const columnas: readonly ColumnaLista<ComponenteComboDraft>[] = [
    {
      clave: "componente",
      encabezado: "Componente",
      celda: (fila) => (
        <div className="flex min-w-72 flex-col gap-1">
          <SelectCampo
            aria-label={`Producto del componente ${fila.clave}`}
            opciones={opcionesDe(fila)}
            valor={fila.componenteId}
            onCambio={(componenteId) => onCambiar(fila.clave, { componenteId })}
            etiquetaVacia="Selecciona un producto"
            buscable
            className="h-8 w-72"
          />
          <ErrorCelda mensaje={errores[claveDeError("componentes", filas.indexOf(fila), "componente_id")]} />
        </div>
      ),
    },
    {
      clave: "cantidad",
      encabezado: "Cantidad",
      alineacion: "derecha",
      celda: (fila) => (
        <div className="flex min-w-24 flex-col items-end gap-1">
          <Input
            aria-label={`Cantidad del componente ${filas.indexOf(fila) + 1}`}
            inputMode="decimal"
            value={fila.cantidad}
            placeholder="1"
            onChange={(evento) => onCambiar(fila.clave, { cantidad: evento.target.value })}
            className="h-8 w-24 text-right tabular-nums"
          />
          <ErrorCelda mensaje={errores[claveDeError("componentes", filas.indexOf(fila), "cantidad")]} />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <FormSectionTitle descripcion="Por cada combo vendido se descuentan estas cantidades de sus componentes. Un combo no puede incluir otro combo ni a sí mismo.">
          Receta del combo
        </FormSectionTitle>
        <Button type="button" variant="outline" size="sm" onClick={onAgregar}>
          <Plus data-icon="inline-start" />
          Agregar componente
        </Button>
      </div>

      {errores.componentes ? (
        <p role="alert" className="text-destructive text-sm">
          {errores.componentes}
        </p>
      ) : null}

      <p className="text-muted-foreground text-sm">
        Un combo sin componentes se puede guardar, pero no se puede vender.
      </p>

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
              aria-label={`Quitar el componente ${filas.indexOf(fila) + 1}`}
              onClick={() => onQuitar(fila.clave)}
            >
              <Trash2 />
            </Button>
          )}
          vacio={{
            titulo: "Sin componentes",
            descripcion: "Agrega los productos que forman el combo y la cantidad que consume cada venta.",
          }}
          densidad="compacta"
        />
      </div>
    </div>
  );
}
