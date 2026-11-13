"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

export interface OpcionCombobox {
  value: string;
  label: string;
  hint?: string;
}

interface ComboboxCampoProps {
  id?: string;
  opciones: OpcionCombobox[];
  valor: string;
  onCambio: (valor: string) => void;
  placeholder?: string;
  vacio?: string;
  disabled?: boolean;
}

export function ComboboxCampo({
  id,
  opciones,
  valor,
  onCambio,
  placeholder = "Buscar…",
  vacio = "Sin resultados",
  disabled = false,
}: ComboboxCampoProps) {
  const seleccion = opciones.find((opcion) => opcion.value === valor) ?? null;

  return (
    <Combobox
      items={opciones}
      value={seleccion}
      onValueChange={(opcion) => onCambio(opcion?.value ?? "")}
      itemToStringLabel={(opcion) => opcion.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
    >
      <ComboboxInput id={id} placeholder={placeholder} showClear={false} disabled={disabled} className="w-full" />
      <ComboboxContent>
        <ComboboxEmpty>{vacio}</ComboboxEmpty>
        <ComboboxList>
          {(opcion: OpcionCombobox) => (
            <ComboboxItem key={opcion.value} value={opcion}>
              <span className="truncate">{opcion.label}</span>
              {opcion.hint ? <span className="text-muted-foreground ml-auto pl-2 text-xs">{opcion.hint}</span> : null}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
