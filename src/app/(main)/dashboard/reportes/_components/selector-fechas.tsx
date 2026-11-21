"use client";

import { type ComponentProps, type ReactNode, useEffect, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { cn } from "cn";
import { format, isValid, parse } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { CalendarDays } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ATAJOS_FECHA,
  ATAJOS_RANGO,
  type AtajoRango,
  etiquetaFecha,
  etiquetaRango,
  hoyEnRd,
} from "@/lib/fechas/rangos";

const FORMATO_ISO = "yyyy-MM-dd";

function aFecha(valor: string): Date | undefined {
  if (valor === "") return undefined;
  const fecha = parse(valor, FORMATO_ISO, new Date());
  return isValid(fecha) ? fecha : undefined;
}

function navegar(router: ReturnType<typeof useRouter>, pathname: string, cambios: Record<string, string>): void {
  const parametros = new URLSearchParams(window.location.search);

  for (const [clave, valor] of Object.entries(cambios)) {
    parametros.set(clave, valor);
  }

  parametros.delete("pagina");
  const consulta = parametros.toString();
  router.push(consulta === "" ? pathname : `${pathname}?${consulta}`);
}

function CalendarioDia({ className, ...props }: ComponentProps<typeof CalendarDayButton>) {
  return (
    <CalendarDayButton
      {...props}
      className={cn(
        "size-10 rounded-[10px] text-base font-normal text-slate-700 hover:bg-slate-100 hover:text-slate-700 [&>span]:text-base [&>span]:opacity-100",
        props.modifiers.outside && "text-slate-300",
        className,
      )}
    />
  );
}

const CLASES_BOTON_FECHAS =
  "border-primary/40 bg-primary/5 text-primary hover:border-primary/60 hover:bg-primary/10 h-8 gap-2 rounded-full px-3 text-sm font-normal";

function PanelAtajos({ children }: { children: ReactNode }) {
  return <div className="flex w-36 shrink-0 flex-col gap-0.5 border-r border-slate-200 p-2">{children}</div>;
}

function PiePanel({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-1 border-t border-slate-200 px-3 py-2">{children}</div>;
}

function Calendario({ className, ...props }: ComponentProps<typeof Calendar>) {
  return (
    <Calendar
      locale={es}
      weekStartsOn={1}
      className={cn("p-3 [--cell-radius:10px] [--cell-size:40px]", className)}
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
        formatCaption: (mes) => format(mes, "MMMM yyyy", { locale: es }).replace(/^./, (letra) => letra.toUpperCase()),
      }}
      {...props}
    />
  );
}

interface RangoProps {
  desde: string;
  hasta: string;
  className?: string;
}

export function SelectorRangoFechas({ desde, hasta, className }: RangoProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [seleccion, setSeleccion] = useState<DateRange | undefined>(() => {
    const inicio = aFecha(desde);
    if (!inicio) return undefined;
    return { from: inicio, to: aFecha(hasta) ?? inicio };
  });
  const [mes, setMes] = useState<Date>(() => aFecha(desde) ?? new Date());

  function cambiarApertura(nuevo: boolean) {
    if (nuevo) {
      const inicio = aFecha(desde);
      setSeleccion(inicio ? { from: inicio, to: aFecha(hasta) ?? inicio } : undefined);
      setMes(inicio ?? new Date());
    }
    setAbierto(nuevo);
  }

  function seleccionarAtajo(atajo: AtajoRango) {
    if (!atajo.obtener) {
      setSeleccion(undefined);
      return;
    }

    const nuevo = atajo.obtener(hoyEnRd());
    const inicio = aFecha(nuevo.desde);
    const fin = aFecha(nuevo.hasta);
    if (!inicio || !fin) return;

    setSeleccion({ from: inicio, to: fin });
    setMes(inicio);
  }

  function aplicar() {
    if (!seleccion?.from) return;

    navegar(router, pathname, {
      desde: format(seleccion.from, FORMATO_ISO),
      hasta: format(seleccion.to ?? seleccion.from, FORMATO_ISO),
    });
    setAbierto(false);
  }

  return (
    <>
      <input type="hidden" name="desde" value={desde} />
      <input type="hidden" name="hasta" value={hasta} />

      <Popover open={abierto} onOpenChange={cambiarApertura}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              aria-label="Cambiar fechas"
              className={cn(CLASES_BOTON_FECHAS, className)}
            >
              <CalendarDays className="size-4" />
              <span className="truncate">{etiquetaRango({ desde, hasta })}</span>
            </Button>
          }
        />
        <PopoverContent align="start" sideOffset={6} className="w-auto max-w-[calc(100vw-1rem)] overflow-x-auto p-0">
          <div className="flex">
            <PanelAtajos>
              {ATAJOS_RANGO.map((atajo) => (
                <Button
                  key={atajo.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-start px-3 font-normal"
                  onClick={() => seleccionarAtajo(atajo)}
                >
                  {atajo.etiqueta}
                </Button>
              ))}
            </PanelAtajos>

            <div className="flex flex-col">
              <Calendario
                mode="range"
                month={mes}
                onMonthChange={setMes}
                numberOfMonths={2}
                selected={seleccion}
                onSelect={setSeleccion}
              />

              <PiePanel>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAbierto(false)}>
                  Cancelar
                </Button>
                <Button type="button" size="sm" onClick={aplicar} disabled={!seleccion?.from}>
                  Aplicar
                </Button>
              </PiePanel>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

interface FechaProps {
  valor: string;
  parametro?: string;
  className?: string;
}

export function SelectorFechaCorte({ valor, parametro = "hasta", className }: FechaProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [seleccion, setSeleccion] = useState<Date | undefined>(() => aFecha(valor));

  function cambiarApertura(nuevo: boolean) {
    if (nuevo) setSeleccion(aFecha(valor));
    setAbierto(nuevo);
  }

  function seleccionarAtajo(obtener: (hoy: string) => string) {
    const fecha = aFecha(obtener(hoyEnRd()));
    if (fecha) setSeleccion(fecha);
  }

  function aplicar() {
    if (!seleccion) return;

    navegar(router, pathname, { [parametro]: format(seleccion, FORMATO_ISO) });
    setAbierto(false);
  }

  return (
    <>
      <input type="hidden" name={parametro} value={valor} />

      <Popover open={abierto} onOpenChange={cambiarApertura}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              aria-label="Cambiar fecha"
              className={cn(CLASES_BOTON_FECHAS, className)}
            >
              <CalendarDays className="size-4" />
              <span className="truncate">{etiquetaFecha(valor)}</span>
            </Button>
          }
        />
        <PopoverContent align="start" sideOffset={6} className="w-auto max-w-[calc(100vw-1rem)] overflow-x-auto p-0">
          <div className="flex">
            <PanelAtajos>
              {ATAJOS_FECHA.map((atajo) => (
                <Button
                  key={atajo.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-start px-3 font-normal"
                  onClick={() => seleccionarAtajo(atajo.obtener)}
                >
                  {atajo.etiqueta}
                </Button>
              ))}
            </PanelAtajos>

            <div className="flex flex-col">
              <Calendario mode="single" selected={seleccion} onSelect={setSeleccion} />

              <PiePanel>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAbierto(false)}>
                  Cancelar
                </Button>
                <Button type="button" size="sm" onClick={aplicar} disabled={!seleccion}>
                  Aplicar
                </Button>
              </PiePanel>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

interface FechaFormularioProps {
  name: string;
  valor: string;
  className?: string;
}

/**
 * Fecha opcional dentro de un formulario GET: guarda el valor en un campo
 * oculto y el resto de los filtros se aplican con el botón del formulario.
 */
export function SelectorFechaFormulario({ name, valor: valorInicial, className }: FechaFormularioProps) {
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState(valorInicial);
  const [seleccion, setSeleccion] = useState<Date | undefined>(() => aFecha(valorInicial));

  useEffect(() => {
    setValor(valorInicial);
    setSeleccion(aFecha(valorInicial));
  }, [valorInicial]);

  function cambiarApertura(nuevo: boolean) {
    if (nuevo) setSeleccion(aFecha(valor));
    setAbierto(nuevo);
  }

  function seleccionarAtajo(obtener: (hoy: string) => string) {
    const fecha = aFecha(obtener(hoyEnRd()));
    if (fecha) setSeleccion(fecha);
  }

  function aplicar() {
    setValor(seleccion ? format(seleccion, FORMATO_ISO) : "");
    setAbierto(false);
  }

  function limpiar() {
    setValor("");
    setSeleccion(undefined);
    setAbierto(false);
  }

  return (
    <>
      <input type="hidden" name={name} value={valor} />

      <Popover open={abierto} onOpenChange={cambiarApertura}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              aria-label="Cambiar fecha"
              className={cn(CLASES_BOTON_FECHAS, className)}
            >
              <CalendarDays className="size-4" />
              <span className={cn("truncate", valor === "" && "text-slate-400")}>
                {valor === "" ? "Seleccionar fecha" : etiquetaFecha(valor)}
              </span>
            </Button>
          }
        />
        <PopoverContent align="start" sideOffset={6} className="w-auto max-w-[calc(100vw-1rem)] overflow-x-auto p-0">
          <div className="flex">
            <PanelAtajos>
              {ATAJOS_FECHA.map((atajo) => (
                <Button
                  key={atajo.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-start px-3 font-normal"
                  onClick={() => seleccionarAtajo(atajo.obtener)}
                >
                  {atajo.etiqueta}
                </Button>
              ))}
            </PanelAtajos>

            <div className="flex flex-col">
              <Calendario mode="single" selected={seleccion} onSelect={setSeleccion} />

              <PiePanel>
                <Button type="button" variant="ghost" size="sm" onClick={limpiar}>
                  Limpiar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAbierto(false)}>
                  Cancelar
                </Button>
                <Button type="button" size="sm" onClick={aplicar} disabled={!seleccion}>
                  Aplicar
                </Button>
              </PiePanel>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
