import type { ReactNode } from "react";

import { cn } from "cn";

import { Label } from "@/components/ui/label";

export const FORM_INPUT =
  "h-10 rounded-[10px] border-input bg-background px-2 text-base text-foreground placeholder:text-muted-foreground hover:border-ring focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

export const FORM_SELECT =
  "w-full rounded-[10px] border-input bg-background px-2 text-base text-foreground hover:border-ring focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 data-[size=default]:h-10";

export const FORM_COMBO =
  "h-10 rounded-[10px] border-input bg-background px-2 text-base text-foreground placeholder:text-muted-foreground hover:border-ring focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 [&>input]:text-base";

export const FORM_INPUT_GROUP =
  "h-10 w-full rounded-[10px] border-input bg-background hover:border-ring has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50";

export const FORM_TEXTAREA =
  "min-h-20 rounded-[10px] border-input bg-background text-base text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

export const FORM_BUTTON = "h-11 rounded-[12px] px-6 text-base font-medium";

interface FormCardProps {
  children: ReactNode;
  className?: string;
}

/** Tarjeta de formulario: radio 12, borde del tema y sin sombra. Sigue claro/oscuro. */
export function FormCard({ children, className }: FormCardProps) {
  return (
    <div className={cn("border-border bg-card text-foreground flex flex-col gap-6 rounded-xl border p-4", className)}>
      {children}
    </div>
  );
}

interface FormGridProps {
  children: ReactNode;
  className?: string;
}

/** Rejilla de campos: 3 columnas desde 768 px, 32 px entre columnas y 16 px entre filas. */
export function FormGrid({ children, className }: FormGridProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3", className)}>{children}</div>
  );
}

interface FormFieldProps {
  htmlFor?: string;
  label: ReactNode;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}

/** Campo con etiqueta de 14 px, peso 500, asterisco en el color primario y error inline. */
export function FormField({ htmlFor, label, required = false, error, children, className }: FormFieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Label htmlFor={htmlFor} className="text-foreground flex items-center gap-1 text-sm leading-5 font-medium">
        {label}
        {required ? <span className="text-primary text-xs font-normal">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="text-destructive text-xs leading-4">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface FormSectionTitleProps {
  children: ReactNode;
  descripcion?: ReactNode;
  className?: string;
}

export function FormSectionTitle({ children, descripcion, className }: FormSectionTitleProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <h2 className="text-foreground text-base leading-6 font-semibold">{children}</h2>
      {descripcion ? <p className="text-muted-foreground text-sm">{descripcion}</p> : null}
    </div>
  );
}

export function FormDivider({ className }: { className?: string }) {
  return <div className={cn("bg-border h-px w-full", className)} />;
}

interface FormTotalProps {
  children: ReactNode;
  className?: string;
}

/** Bloque de totales alineado a la derecha, 400 px de ancho y cifras tabulares. */
export function FormTotal({ children, className }: FormTotalProps) {
  return (
    <div className={cn("text-muted-foreground my-8 w-full text-base tabular-nums md:ml-auto md:w-[400px]", className)}>
      {children}
    </div>
  );
}

interface FormActionsProps {
  children: ReactNode;
  className?: string;
}

/** Fila de botones fuera de la tarjeta: 24 px arriba, alineada a la derecha y con 8 px de hueco. */
export function FormActions({ children, className }: FormActionsProps) {
  return <div className={cn("flex flex-wrap justify-end gap-2", className)}>{children}</div>;
}
