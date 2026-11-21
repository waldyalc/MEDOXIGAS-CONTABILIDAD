"use client";

import { type ComponentProps, useEffect, useState } from "react";

import { cn } from "cn";
import { format, isValid, parse } from "date-fns";
import { es } from "date-fns/locale";

import { Calendar as CalendarIcon, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

function aFecha(valor: string): Date | undefined {
  if (!valor) return undefined;
  const fecha = parse(valor, "yyyy-MM-dd", new Date());
  return isValid(fecha) ? fecha : undefined;
}

function CalendarioDia({ className, ...props }: ComponentProps<typeof CalendarDayButton>) {
  return (
    <CalendarDayButton
      {...props}
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground text-foreground hover:bg-muted hover:text-foreground size-10 rounded-[10px] text-base font-normal [&>span]:text-base [&>span]:opacity-100",
        props.modifiers.outside && "text-muted-foreground/50",
        className,
      )}
    />
  );
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: DatePickerProps) {
  const [abierto, setAbierto] = useState(false);
  const fecha = aFecha(value);

  function seleccionar(dia: Date | undefined) {
    if (!dia) return;
    onChange(format(dia, "yyyy-MM-dd"));
    setAbierto(false);
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={cn(
              "border-border bg-card dark:bg-background text-foreground hover:border-ring hover:bg-background focus-visible:border-ring aria-expanded:border-ring aria-expanded:bg-background aria-expanded:text-foreground h-10 w-full justify-start gap-2 rounded-[10px] px-2 text-base font-normal focus-visible:ring-0 aria-expanded:ring-0",
              className,
            )}
          >
            <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
            <span className={cn("truncate", !fecha && "text-muted-foreground")}>
              {fecha ? format(fecha, "dd/MM/yyyy") : placeholder}
            </span>
          </Button>
        }
      />
      <PopoverContent align="start" sideOffset={6} className="w-auto gap-0 overflow-hidden p-0">
        <Calendar
          mode="single"
          locale={es}
          captionLayout="label"
          selected={fecha}
          defaultMonth={fecha ?? new Date()}
          onSelect={seleccionar}
          className="w-[306px] p-3 [--cell-radius:10px] [--cell-size:40px]"
          classNames={{
            weekdays: "border-border flex w-full items-center border-b pb-2",
            weekday: "text-muted-foreground flex-1 text-center text-xs font-medium tracking-wide uppercase",
            week: "mt-0 flex h-[45px] w-full items-center",
            day: "relative flex size-10 items-center justify-center rounded-[10px] p-0 text-center select-none",
            today: "bg-muted text-foreground rounded-[10px] data-[selected=true]:rounded-[10px]",
            caption_label: "text-foreground text-base font-semibold",
            button_previous: "text-foreground hover:bg-muted rounded-[10px]",
            button_next: "text-foreground hover:bg-muted rounded-[10px]",
          }}
          components={{ DayButton: CalendarioDia }}
          formatters={{
            formatCaption: (mes) =>
              format(mes, "MMM yyyy", { locale: es }).replace(/^./, (letra) => letra.toUpperCase()),
          }}
        />
        <div className="flex justify-end px-3 pb-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-primary h-7 px-2"
            onClick={() => seleccionar(new Date())}
          >
            Hoy
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DatePickerCampoProps {
  id?: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  /** Muestra una X para vaciar la fecha (campos opcionales como desde, hasta o vence). */
  permitirLimpiar?: boolean;
}

/**
 * `DatePicker` para formularios sin estado propio: guarda la fecha en un input
 * oculto con `name` (GET o FormData) y se sincroniza cuando vuelven los
 * searchParams con otro `defaultValue`.
 */
export function DatePickerCampo({
  id,
  name,
  defaultValue = "",
  placeholder,
  className,
  permitirLimpiar = false,
}: DatePickerCampoProps) {
  const [valor, setValor] = useState(defaultValue);

  useEffect(() => {
    setValor(defaultValue);
  }, [defaultValue]);

  const mostrarLimpiar = permitirLimpiar && valor !== "";

  return (
    <div className="relative">
      <input type="hidden" name={name} value={valor} />
      <DatePicker
        id={id}
        value={valor}
        onChange={setValor}
        placeholder={placeholder}
        className={cn(mostrarLimpiar && "pr-9", className)}
      />
      {mostrarLimpiar ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Limpiar fecha"
          onClick={() => setValor("")}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 -translate-y-1/2"
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}
