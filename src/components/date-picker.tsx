"use client";

import { type ComponentProps, useState } from "react";

import { cn } from "cn";
import { format, isValid, parse } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";

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
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground size-10 rounded-[10px] text-base font-normal text-slate-700 hover:bg-slate-100 hover:text-slate-700 [&>span]:text-base [&>span]:opacity-100",
        props.modifiers.outside && "text-slate-300",
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
              "h-10 w-full justify-start gap-2 rounded-[10px] border-slate-300 bg-white px-2 text-base font-normal text-slate-700 hover:border-slate-400 hover:bg-white focus-visible:border-primary focus-visible:ring-0 aria-expanded:border-primary aria-expanded:bg-white aria-expanded:text-slate-700 aria-expanded:ring-0 dark:bg-white dark:hover:bg-white",
              className,
            )}
          >
            <CalendarIcon className="size-4 shrink-0 text-slate-500" />
            <span className={cn("truncate", !fecha && "text-slate-400")}>
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
            weekdays: "flex w-full items-center border-b border-slate-200 pb-2",
            weekday: "flex-1 text-center text-xs font-medium tracking-wide text-slate-500 uppercase",
            week: "mt-0 flex h-[45px] w-full items-center",
            day: "relative flex size-10 items-center justify-center rounded-[10px] p-0 text-center select-none",
            today: "rounded-[10px] bg-slate-100 text-slate-700 data-[selected=true]:rounded-[10px]",
            caption_label: "text-base font-semibold text-slate-700",
            button_previous: "rounded-[10px] text-slate-700 hover:bg-slate-100",
            button_next: "rounded-[10px] text-slate-700 hover:bg-slate-100",
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
            className="h-7 px-2 text-primary"
            onClick={() => seleccionar(new Date())}
          >
            Hoy
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
