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

import { type ContactoCreado, DialogoNuevoContacto } from "./dialogo-nuevo-contacto";

export interface ContactoOpcion {
  id: string;
  nombre: string;
  rnc_cedula: string | null;
  lista_precio_id?: string | null;
}

interface Props {
  contactos: readonly ContactoOpcion[];
  valor: string;
  onCambio: (contacto: ContactoOpcion | null) => void;
  tipoInicial: "cliente" | "proveedor";
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  showClear?: boolean;
  "aria-label"?: string;
}

export function SelectorContacto({
  contactos,
  valor,
  onCambio,
  tipoInicial,
  id,
  className,
  placeholder,
  disabled = false,
  showClear = true,
  "aria-label": ariaLabel,
}: Props) {
  const [nuevos, setNuevos] = useState<ContactoCreado[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  const opciones = useMemo(() => {
    const mapa = new Map(contactos.map((contacto) => [contacto.id, contacto]));
    for (const contacto of nuevos) mapa.set(contacto.id, contacto);
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [contactos, nuevos]);

  const seleccion = opciones.find((contacto) => contacto.id === valor) ?? null;
  const etiquetaCrear = tipoInicial === "cliente" ? "Crear nuevo cliente" : "Crear nuevo proveedor";

  function cambiar(contacto: ContactoOpcion | null) {
    setBusqueda("");
    onCambio(contacto);
  }

  function crear(contacto: ContactoCreado) {
    setNuevos((actuales) => [...actuales.filter((item) => item.id !== contacto.id), contacto]);
    setDialogoAbierto(false);
    setBusqueda("");
    onCambio(contacto);
  }

  return (
    <>
      <Combobox
        items={opciones}
        value={seleccion}
        onValueChange={cambiar}
        itemToStringLabel={(contacto) => contacto.nombre}
        isItemEqualToValue={(a, b) => a.id === b.id}
      >
        <ComboboxInput
          id={id}
          className={className ?? "w-full"}
          placeholder={placeholder ?? (tipoInicial === "cliente" ? "Buscar cliente…" : "Buscar proveedor…")}
          disabled={disabled}
          showClear={showClear}
          aria-label={ariaLabel}
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
              {etiquetaCrear}
            </Button>
          </div>
          <ComboboxEmpty>Sin resultados</ComboboxEmpty>
          <ComboboxList>
            {(contacto: ContactoOpcion) => (
              <ComboboxItem key={contacto.id} value={contacto}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{contacto.nombre}</span>
                  {contacto.rnc_cedula ? (
                    <span className="text-muted-foreground text-xs tabular-nums">{contacto.rnc_cedula}</span>
                  ) : null}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <DialogoNuevoContacto
        abierto={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        tipoInicial={tipoInicial}
        nombreInicial={busqueda}
        onCreado={crear}
      />
    </>
  );
}
