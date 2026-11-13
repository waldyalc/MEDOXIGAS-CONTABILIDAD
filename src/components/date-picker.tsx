"use client";

import { useState } from "react";

import { cn } from "cn";
import { format, isValid, parse } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function aFecha(valor: string): Date | undefined {
  if (!valor) return undefined;
  const fecha = parse(valor, "yyyy-MM-dd", new Date());
  return isValid(fecha) ? fecha : undefined;
}

export function DatePicker({ id, value, onChange, placeholder = "Seleccionar fecha", className }: DatePickerProps) {
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
            className={cn(
              "h-10 w-full justify-start gap-2 rounded-[10px] border-slate-300 bg-white px-2 text-base font-normal text-slate-700 hover:border-slate-400 hover:bg-white focus-visible:border-primary focus-visible:ring-0 dark:bg-white dark:hover:bg-white",
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
      <PopoverContent align="start" sideOffset={4} className="w-auto gap-0 overflow-hidden p-0">
        <Calendar
          mode="single"
          locale={es}
          captionLayout="dropdown"
          selected={fecha}
          defaultMonth={fecha ?? new Date()}
          onSelect={seleccionar}
        />
        <div className="flex justify-end border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-primary"
            onClick={() => seleccionar(new Date())}
          >
            Hoy
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
