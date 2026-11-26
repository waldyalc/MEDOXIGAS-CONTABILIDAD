"use client";

import { type ComponentProps, type ReactNode, useEffect, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { cn } from "cn";
import { format, isValid, parse } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { CalendarDays, ChevronDown } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ATAJOS_FECHA,
  ATAJOS_RANGO,
  type AtajoRango,
  etiquetaFecha,
  etiquetaPresetRango,
  hoyEnRd,
  type RangoFechas,
} from "@/lib/fechas/rangos";

const FORMATO_ISO = "yyyy-MM-dd";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const OPCIONES_MES = MESES.map((label, indice) => ({ value: String(indice), label }));
const ANIO_MINIMO = 1900;
const ANIO_MAXIMO = 2100;
const OPCIONES_ANIO = Array.from({ length: ANIO_MAXIMO - ANIO_MINIMO + 1 }, (_, indice) => {
  const anio = ANIO_MINIMO + indice;
  return { value: String(anio), label: String(anio) };
});

function aFecha(valor: string): Date | undefined {
  if (valor === "") return undefined;
  const fecha = parse(valor, FORMATO_ISO, new Date());
  return isValid(fecha) ? fecha : undefined;
}

function aIso(fecha: Date): string {
  return format(fecha, FORMATO_ISO);
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

function rangoDeSeleccion(seleccion: DateRange | undefined): RangoFechas | null {
  if (!seleccion?.from) return null;

  return {
    desde: aIso(seleccion.from),
    hasta: aIso(seleccion.to ?? seleccion.from),
  };
}

function atajoActivo(seleccion: DateRange | undefined): string {
  const actual = rangoDeSeleccion(seleccion);
  if (!actual) return "personalizado";

  const coincidente = ATAJOS_RANGO.find((atajo) => {
    const sugerido = atajo.obtener?.(hoyEnRd());
    return sugerido?.desde === actual.desde && sugerido?.hasta === actual.hasta;
  });

  return coincidente?.id ?? "personalizado";
}

function etiquetaCampoRango(rango: RangoFechas): string {
  const inicio = aFecha(rango.desde);
  const fin = aFecha(rango.hasta);
  if (!inicio || !fin) return `${rango.desde} - ${rango.hasta}`;

  return `${format(inicio, "dd/MM/yyyy")} - ${format(fin, "dd/MM/yyyy")}`;
}

function usePantallaChica(): boolean {
  const [chica, setChica] = useState(false);

  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 767px)");
    const actualizar = () => setChica(consulta.matches);
    actualizar();
    consulta.addEventListener("change", actualizar);
    return () => consulta.removeEventListener("change", actualizar);
  }, []);

  return chica;
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

/** Chip de filtro estilo Alegra: píldora con tinte teal e iconos de 16 px. */
const CLASES_BOTON_FECHAS =
  "h-8 gap-1.5 rounded-full border border-primary/50 bg-secondary px-3 text-xs font-normal text-secondary-foreground hover:border-primary/60 hover:bg-[#dbe6fa] [&_svg]:size-4";

const CLASES_CAMPO_RANGO =
  "h-9 w-full min-w-60 justify-start gap-2 rounded-md border-input bg-card px-3 text-sm font-normal text-foreground shadow-none hover:bg-muted/50 [&_svg]:size-4";

function PanelAtajos({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-h-[430px] w-40 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-slate-200 p-2">
      {children}
    </div>
  );
}

function PiePanel({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-1 border-t border-slate-200 px-3 py-2">{children}</div>;
}

function SelectorMesAnio({ mes, onMesChange }: { mes: Date; onMesChange: (mes: Date) => void }) {
  function cambiarMes(valor: string | null) {
    if (valor == null) return;
    const nuevo = new Date(mes);
    nuevo.setDate(1);
    nuevo.setMonth(Number(valor));
    onMesChange(nuevo);
  }

  function cambiarAnio(valor: string | null) {
    if (valor == null) return;
    const nuevo = new Date(mes);
    nuevo.setDate(1);
    nuevo.setFullYear(Number(valor));
    onMesChange(nuevo);
  }

  return (
    <div className="flex items-center justify-center gap-1.5 border-b border-slate-200 px-3 pb-2">
      <Select items={OPCIONES_MES} value={String(mes.getMonth())} onValueChange={cambiarMes}>
        <SelectTrigger
          aria-label="Elegir mes"
          className="h-8 w-32 border-transparent bg-transparent px-2 text-sm font-semibold text-slate-700 shadow-none hover:bg-slate-100"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {OPCIONES_MES.map((opcion) => (
            <SelectItem key={opcion.value} value={opcion.value}>
              {opcion.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select items={OPCIONES_ANIO} value={String(mes.getFullYear())} onValueChange={cambiarAnio}>
        <SelectTrigger
          aria-label="Elegir año"
          className="h-8 w-24 border-transparent bg-transparent px-2 text-sm font-semibold text-slate-700 shadow-none hover:bg-slate-100"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {OPCIONES_ANIO.map((opcion) => (
            <SelectItem key={opcion.value} value={opcion.value}>
              {opcion.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type OmitDistributivo<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

type CalendarioProps = OmitDistributivo<ComponentProps<typeof Calendar>, "month" | "onMonthChange"> & {
  mes: Date;
  onMesChange: (mes: Date) => void;
};

function Calendario({ mes, onMesChange, className, ...props }: CalendarioProps) {
  return (
    <div className="flex flex-col">
      <SelectorMesAnio mes={mes} onMesChange={onMesChange} />
      <Calendar
        locale={es}
        weekStartsOn={1}
        month={mes}
        onMonthChange={onMesChange}
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
          formatCaption: (mesCaption) =>
            format(mesCaption, "MMMM yyyy", { locale: es }).replace(/^./, (letra) => letra.toUpperCase()),
        }}
        {...props}
      />
    </div>
  );
}

interface RangoProps {
  desde: string;
  hasta: string;
  className?: string;
  onChange?: (rango: RangoFechas) => void;
  variante?: "chip" | "campo";
}

export function SelectorRangoFechas({ desde, hasta, className, onChange, variante = "chip" }: RangoProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pantallaChica = usePantallaChica();
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState<RangoFechas>({ desde, hasta });
  const [seleccion, setSeleccion] = useState<DateRange | undefined>(() => {
    const inicio = aFecha(desde);
    if (!inicio) return undefined;
    return { from: inicio, to: aFecha(hasta) ?? inicio };
  });
  const [mes, setMes] = useState<Date>(() => aFecha(desde) ?? new Date());

  useEffect(() => {
    setValor({ desde, hasta });
  }, [desde, hasta]);

  function cambiarApertura(nuevo: boolean) {
    if (nuevo) {
      const inicio = aFecha(valor.desde);
      setSeleccion(inicio ? { from: inicio, to: aFecha(valor.hasta) ?? inicio } : undefined);
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

    const nuevo = {
      desde: format(seleccion.from, FORMATO_ISO),
      hasta: format(seleccion.to ?? seleccion.from, FORMATO_ISO),
    };
    setValor(nuevo);
    if (onChange) {
      onChange(nuevo);
    } else {
      navegar(router, pathname, nuevo);
    }
    setAbierto(false);
  }

  const activo = atajoActivo(seleccion);
  const esCampo = variante === "campo";

  return (
    <>
      <input type="hidden" name="desde" value={valor.desde} />
      <input type="hidden" name="hasta" value={valor.hasta} />

      <Popover open={abierto} onOpenChange={cambiarApertura}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              aria-label="Cambiar fechas"
              className={cn(esCampo ? CLASES_CAMPO_RANGO : CLASES_BOTON_FECHAS, className)}
            >
              {esCampo ? (
                <>
                  <span className="flex-1 text-left tabular-nums">{etiquetaCampoRango(valor)}</span>
                  <CalendarDays className="text-slate-400" />
                </>
              ) : (
                <>
                  <CalendarDays />
                  <span className="truncate">{etiquetaPresetRango(valor)}</span>
                  <ChevronDown />
                </>
              )}
            </Button>
          }
        />
        <PopoverContent align="start" sideOffset={6} className="w-auto max-w-[calc(100vw_-_1rem)] overflow-x-auto p-0">
          <div className="flex">
            <PanelAtajos>
              {ATAJOS_RANGO.map((atajo) => (
                <Button
                  key={atajo.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 justify-start px-2 text-xs font-normal",
                    atajo.id === activo && "bg-secondary text-secondary-foreground font-medium",
                  )}
                  onClick={() => seleccionarAtajo(atajo)}
                >
                  {atajo.etiqueta}
                </Button>
              ))}
            </PanelAtajos>

            <div className="flex flex-col">
              <Calendario
                mode="range"
                mes={mes}
                onMesChange={setMes}
                numberOfMonths={pantallaChica ? 1 : 2}
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
  const [mes, setMes] = useState<Date>(() => aFecha(valor) ?? new Date());

  function cambiarApertura(nuevo: boolean) {
    if (nuevo) {
      const fecha = aFecha(valor);
      setSeleccion(fecha);
      setMes(fecha ?? new Date());
    }
    setAbierto(nuevo);
  }

  function seleccionarAtajo(obtener: (hoy: string) => string) {
    const fecha = aFecha(obtener(hoyEnRd()));
    if (fecha) {
      setSeleccion(fecha);
      setMes(fecha);
    }
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
              <CalendarDays />
              <span className="truncate">{etiquetaFecha(valor)}</span>
              <ChevronDown />
            </Button>
          }
        />
        <PopoverContent align="start" sideOffset={6} className="w-auto max-w-[calc(100vw_-_1rem)] overflow-x-auto p-0">
          <div className="flex">
            <PanelAtajos>
              {ATAJOS_FECHA.map((atajo) => (
                <Button
                  key={atajo.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 justify-start px-2 text-xs font-normal"
                  onClick={() => seleccionarAtajo(atajo.obtener)}
                >
                  {atajo.etiqueta}
                </Button>
              ))}
            </PanelAtajos>

            <div className="flex flex-col">
              <Calendario mode="single" mes={mes} onMesChange={setMes} selected={seleccion} onSelect={setSeleccion} />

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
  placeholder?: string;
}

/**
 * Fecha opcional dentro de un formulario GET: guarda el valor en un campo
 * oculto y el resto de los filtros se aplican con el botón del formulario.
 */
export function SelectorFechaFormulario({
  name,
  valor: valorInicial,
  className,
  placeholder = "Seleccionar fecha",
}: FechaFormularioProps) {
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState(valorInicial);
  const [seleccion, setSeleccion] = useState<Date | undefined>(() => aFecha(valorInicial));
  const [mes, setMes] = useState<Date>(() => aFecha(valorInicial) ?? new Date());

  useEffect(() => {
    const fecha = aFecha(valorInicial);
    setValor(valorInicial);
    setSeleccion(fecha);
    setMes(fecha ?? new Date());
  }, [valorInicial]);

  function cambiarApertura(nuevo: boolean) {
    if (nuevo) {
      const fecha = aFecha(valor);
      setSeleccion(fecha);
      setMes(fecha ?? new Date());
    }
    setAbierto(nuevo);
  }

  function seleccionarAtajo(obtener: (hoy: string) => string) {
    const fecha = aFecha(obtener(hoyEnRd()));
    if (fecha) {
      setSeleccion(fecha);
      setMes(fecha);
    }
  }

  function aplicar() {
    setValor(seleccion ? format(seleccion, FORMATO_ISO) : "");
    setAbierto(false);
  }

  function limpiar() {
    setValor("");
    setSeleccion(undefined);
    setMes(new Date());
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
                {valor === "" ? placeholder : etiquetaFecha(valor)}
              </span>
            </Button>
          }
        />
        <PopoverContent align="start" sideOffset={6} className="w-auto max-w-[calc(100vw_-_1rem)] overflow-x-auto p-0">
          <div className="flex">
            <PanelAtajos>
              {ATAJOS_FECHA.map((atajo) => (
                <Button
                  key={atajo.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 justify-start px-2 text-xs font-normal"
                  onClick={() => seleccionarAtajo(atajo.obtener)}
                >
                  {atajo.etiqueta}
                </Button>
              ))}
            </PanelAtajos>

            <div className="flex flex-col">
              <Calendario mode="single" mes={mes} onMesChange={setMes} selected={seleccion} onSelect={setSeleccion} />

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
