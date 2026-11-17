import type { ReactNode } from "react";

import { cn } from "cn";

import { Label } from "@/components/ui/label";

interface CampoFormularioProps {
  htmlFor?: string;
  label: ReactNode;
  required?: boolean;
  /** Mensaje de error del campo; pinta la etiqueta y el control en rojo. */
  error?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Campo de formulario con el error debajo del control. Mantiene el diseño de
 * `FormField` (etiqueta de 14 px, asterisco y espaciado) y añade el mensaje
 * inline y el borde rojo sin tocar los componentes de `components/ui`.
 */
export function CampoFormulario({
  htmlFor,
  label,
  required = false,
  error,
  children,
  className,
}: CampoFormularioProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        error &&
          "[&_input]:border-destructive [&_textarea]:border-destructive [&_[data-slot=select-trigger]]:border-destructive [&_[data-slot=input-group]]:border-destructive",
        className,
      )}
    >
      <Label
        htmlFor={htmlFor}
        className={cn(
          "flex items-center gap-1 text-sm leading-5 font-medium text-slate-700",
          error && "text-destructive",
        )}
      >
        {label}
        {required ? (
          <span className={cn("text-xs font-normal", error ? "text-destructive" : "text-primary")}>*</span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-destructive text-xs leading-4">
          {error}
        </p>
      ) : null}
    </div>
  );
}
