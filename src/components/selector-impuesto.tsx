"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { agruparImpuestos, etiquetaImpuesto, type Impuesto, impuestoNinguno } from "@/lib/impuestos/tipos";

interface Props {
  id?: string;
  name?: string;
  value: string;
  onValueChange: (impuestoId: string) => void;
  impuestos: readonly Impuesto[];
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  placeholder?: string;
}

export function SelectorImpuesto({
  id,
  name,
  value,
  onValueChange,
  impuestos,
  className,
  disabled,
  ariaLabel,
  placeholder = "Ninguno",
}: Props) {
  const ninguno = impuestoNinguno(impuestos);
  const grupos = agruparImpuestos(impuestos);
  const items = [
    ...(ninguno ? [{ value: ninguno.id, label: "Ninguno" }] : []),
    ...impuestos
      .filter((impuesto) => impuesto.tipo !== "ninguno")
      .map((impuesto) => ({ value: impuesto.id, label: etiquetaImpuesto(impuesto) })),
  ];

  return (
    <Select
      name={name}
      items={items}
      value={value !== "" ? value : (ninguno?.id ?? "")}
      onValueChange={(valor: string | null) => {
        if (valor) onValueChange(valor);
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {ninguno ? (
          <SelectItem value={ninguno.id}>Ninguno</SelectItem>
        ) : (
          <SelectItem value="">{placeholder}</SelectItem>
        )}
        {grupos.map((grupo) => (
          <SelectGroup key={grupo.tipo}>
            <SelectLabel>{grupo.etiqueta}</SelectLabel>
            {grupo.impuestos.map((impuesto) => (
              <SelectItem key={impuesto.id} value={impuesto.id}>
                {etiquetaImpuesto(impuesto)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
