import type { ReactNode } from "react";

import { cn } from "cn";

import { Label } from "@/components/ui/label";

export const FORM_INPUT =
  "h-10 rounded-[10px] border-slate-300 bg-white px-2 text-base text-slate-700 placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary dark:bg-white";

export const FORM_SELECT =
  "w-full rounded-[10px] border-slate-300 bg-white px-2 text-base text-slate-700 hover:border-slate-400 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary data-[size=default]:h-10 dark:bg-white";

export const FORM_COMBO =
  "h-10 rounded-[10px] border-slate-300 bg-white px-2 text-base text-slate-700 placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary dark:bg-white [&>input]:text-base";

export const FORM_INPUT_GROUP =
  "h-10 w-full rounded-[10px] border-slate-300 bg-white hover:border-slate-400 has-[[data-slot=input-group-control]:focus-visible]:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-primary dark:bg-white";

export const FORM_TEXTAREA =
  "min-h-20 rounded-[10px] border-slate-300 bg-white text-base text-slate-700 placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary";

export const FORM_BUTTON = "h-11 rounded-[12px] px-6 text-base font-medium";

interface FormCardProps {
  children: ReactNode;
  className?: string;
}

/** Tarjeta de formulario: radio 12, borde slate-200 y sin sombra. */
export function FormCard({ children, className }: FormCardProps) {
  return (
    <div
      className={cn("flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-4 text-slate-700", className)}
    >
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
  /** Mensaje de error del campo; pinta la etiqueta y el control en rojo. */
  error?: string;
  children: ReactNode;
  className?: string;
}

/** Campo con etiqueta de 14 px, peso 500 y asterisco en el color primario. */
export function FormField({ htmlFor, label, required = false, error, children, className }: FormFieldProps) {
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

interface FormSectionTitleProps {
  children: ReactNode;
  descripcion?: ReactNode;
  className?: string;
}

export function FormSectionTitle({ children, descripcion, className }: FormSectionTitleProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <h2 className="text-base leading-6 font-semibold text-slate-700">{children}</h2>
      {descripcion ? <p className="text-sm text-slate-500">{descripcion}</p> : null}
    </div>
  );
}

export function FormDivider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-slate-400/20", className)} />;
}

interface FormTotalProps {
  children: ReactNode;
  className?: string;
}

/** Bloque de totales alineado a la derecha, 400 px de ancho. */
export function FormTotal({ children, className }: FormTotalProps) {
  return (
    <div className={cn("my-8 w-full text-base text-slate-500 md:ml-auto md:w-[400px]", className)}>{children}</div>
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
