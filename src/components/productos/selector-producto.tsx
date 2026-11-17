"use client";

import { useMemo, useState } from "react";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

import { DialogoNuevoProducto, type ProductoSeleccionable } from "./dialogo-nuevo-producto";

export type { ProductoSeleccionable } from "./dialogo-nuevo-producto";

interface Props {
  productos: readonly ProductoSeleccionable[];
  valor: string;
  onCambio: (producto: ProductoSeleccionable | null) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  showClear?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export function SelectorProducto({
  productos,
  valor,
  onCambio,
  id,
  className,
  placeholder = "Buscar producto…",
  disabled = false,
  showClear = false,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: Props) {
  const [nuevos, setNuevos] = useState<ProductoSeleccionable[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  const opciones = useMemo(() => {
    const mapa = new Map(productos.map((producto) => [producto.id, producto]));
    for (const producto of nuevos) mapa.set(producto.id, producto);
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [productos, nuevos]);

  const seleccion = opciones.find((producto) => producto.id === valor) ?? null;

  function cambiar(producto: ProductoSeleccionable | null) {
    setBusqueda("");
    onCambio(producto);
  }

  function crear(producto: ProductoSeleccionable) {
    setNuevos((actuales) => [...actuales.filter((item) => item.id !== producto.id), producto]);
    setDialogoAbierto(false);
    setBusqueda("");
    onCambio(producto);
  }

  return (
    <>
      <Combobox
        items={opciones}
        value={seleccion}
        onValueChange={cambiar}
        itemToStringLabel={(producto) => producto.nombre}
        isItemEqualToValue={(a, b) => a.id === b.id}
      >
        <ComboboxInput
          id={id}
          className={className ?? "w-full"}
          placeholder={placeholder}
          disabled={disabled}
          showClear={showClear}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          onChange={(evento) => setBusqueda(evento.currentTarget.value)}
        />
        <ComboboxContent>
          <div className="border-b p-1">
            <Button
              type="button"
              variant="ghost"
              className="text-primary h-8 w-full justify-start gap-1.5 px-1.5 text-sm font-medium"
              onMouseDown={(evento) => evento.preventDefault()}
              onClick={() => setDialogoAbierto(true)}
            >
              <Plus className="size-4" />
              Crear nuevo producto
            </Button>
          </div>
          <ComboboxEmpty>Sin productos</ComboboxEmpty>
          <ComboboxList>
            {(producto: ProductoSeleccionable) => (
              <ComboboxItem key={producto.id} value={producto}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{producto.nombre}</span>
                  <span className="text-muted-foreground text-xs">
                    {producto.referencia ? `Ref. ${producto.referencia}` : `ITBIS ${producto.itbis_tasa} %`}
                  </span>
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <DialogoNuevoProducto
        abierto={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        nombreInicial={busqueda}
        onCreado={crear}
      />
    </>
  );
}
