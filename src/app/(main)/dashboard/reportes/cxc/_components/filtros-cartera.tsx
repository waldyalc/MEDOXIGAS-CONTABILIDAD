"use client";

import { useState } from "react";

import Link from "next/link";

import { SlidersHorizontal, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatoDia } from "@/lib/formato";
import { urlConParametros } from "@/lib/reportes/administrativos/d/parametros";
import type { VistaAntiguedad } from "@/lib/reportes/administrativos/d/tipos";
import type { ParametrosFecha } from "@/lib/reportes/fechas";

import { SelectorFechaFormulario } from "../../_components/selector-fechas";

interface Props {
  tipo: "cobrar" | "pagar";
  base: string;
  params: ParametrosFecha;
  desde: string;
  hasta: string;
  vista: VistaAntiguedad;
  ncf: string;
  contacto: string;
  creacionDesde: string | null;
  creacionHasta: string | null;
  vencimientoDesde: string | null;
  vencimientoHasta: string | null;
}

interface FiltroActivo {
  id: string;
  etiqueta: string;
  href: string;
}

interface EntradaFiltrosActivos {
  tipo: "cobrar" | "pagar";
  ncf: string;
  contacto: string;
  creacionDesde: string | null;
  creacionHasta: string | null;
  vencimientoDesde: string | null;
  vencimientoHasta: string | null;
  sinFiltros: (cambios: Record<string, string | null>) => string;
}

const CLASES_FECHA_FILTRO =
  "h-8 w-full justify-start rounded-md border-border bg-card px-2 text-xs font-normal text-foreground hover:bg-muted/50";

function textoRangoFecha(desde: string | null, hasta: string | null): string | null {
  if (desde && hasta) return `${formatoDia(desde)} – ${formatoDia(hasta)}`;
  if (desde) return `desde ${formatoDia(desde)}`;
  if (hasta) return `hasta ${formatoDia(hasta)}`;
  return null;
}

function construirFiltrosActivos({
  tipo,
  ncf,
  contacto,
  creacionDesde,
  creacionHasta,
  vencimientoDesde,
  vencimientoHasta,
  sinFiltros,
}: EntradaFiltrosActivos): FiltroActivo[] {
  const activos: FiltroActivo[] = [];
  if (ncf !== "") {
    activos.push({ id: "ncf", etiqueta: `NCF: ${ncf}`, href: sinFiltros({ ncf: null }) });
  }
  if (contacto !== "") {
    activos.push({
      id: "contacto",
      etiqueta: `${tipo === "cobrar" ? "Cliente" : "Proveedor"}: ${contacto}`,
      href: sinFiltros({ contacto: null }),
    });
  }

  const creacion = textoRangoFecha(creacionDesde, creacionHasta);
  if (creacion) {
    activos.push({
      id: "creacion",
      etiqueta: `Creación: ${creacion}`,
      href: sinFiltros({ creacion_desde: null, creacion_hasta: null }),
    });
  }

  const vencimiento = textoRangoFecha(vencimientoDesde, vencimientoHasta);
  if (vencimiento) {
    activos.push({
      id: "vencimiento",
      etiqueta: `Vencimiento: ${vencimiento}`,
      href: sinFiltros({ vencimiento_desde: null, vencimiento_hasta: null }),
    });
  }

  return activos;
}

function SelectorParFechas({
  nombreDesde,
  nombreHasta,
  valorDesde,
  valorHasta,
}: {
  nombreDesde: string;
  nombreHasta: string;
  valorDesde: string | null;
  valorHasta: string | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <SelectorFechaFormulario
        name={nombreDesde}
        valor={valorDesde ?? ""}
        placeholder="Desde"
        className={CLASES_FECHA_FILTRO}
      />
      <SelectorFechaFormulario
        name={nombreHasta}
        valor={valorHasta ?? ""}
        placeholder="Hasta"
        className={CLASES_FECHA_FILTRO}
      />
    </div>
  );
}

export function FiltrosCartera({
  tipo,
  base,
  params,
  desde,
  hasta,
  vista,
  ncf,
  contacto,
  creacionDesde,
  creacionHasta,
  vencimientoDesde,
  vencimientoHasta,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const limpiarTodo = {
    ncf: null,
    contacto: null,
    creacion_desde: null,
    creacion_hasta: null,
    vencimiento_desde: null,
    vencimiento_hasta: null,
    pagina: null,
  };
  const sinFiltros = (cambios: Record<string, string | null>) =>
    urlConParametros(base, params, { ...cambios, pagina: null });
  const urlLimpiar = urlConParametros(base, params, limpiarTodo);
  const activos = construirFiltrosActivos({
    tipo,
    ncf,
    contacto,
    creacionDesde,
    creacionHasta,
    vencimientoDesde,
    vencimientoHasta,
    sinFiltros,
  });

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {activos.map((filtro) => (
            <Link
              key={filtro.id}
              href={filtro.href}
              prefetch={false}
              className="border-border bg-card hover:bg-muted inline-flex h-6 max-w-72 items-center gap-1 rounded-full border px-2 text-xs text-slate-600 transition-colors"
            >
              <span className="truncate">{filtro.etiqueta}</span>
              <X className="size-3 shrink-0" />
            </Link>
          ))}
          {activos.length > 0 ? (
            <Link href={urlLimpiar} prefetch={false} className="text-primary px-1 text-xs font-medium hover:underline">
              Limpiar filtros
            </Link>
          ) : null}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-md px-3 text-xs"
          aria-expanded={abierto}
          onClick={() => setAbierto((actual) => !actual)}
        >
          <SlidersHorizontal />
          Filtrar
          {activos.length > 0 ? (
            <span className="bg-primary/10 text-primary ml-0.5 inline-flex size-4 items-center justify-center rounded-full text-[10px] font-semibold">
              {activos.length}
            </span>
          ) : null}
        </Button>
      </div>

      {abierto ? (
        <div className="border-border bg-card w-full self-end rounded-xl border shadow-sm sm:max-w-[26rem]">
          <form method="get" className="flex flex-col">
            <input type="hidden" name="desde" value={desde} />
            <input type="hidden" name="hasta" value={hasta} />
            {vista !== "todas" ? <input type="hidden" name="vista" value={vista} /> : null}

            <div className="border-border border-b px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">Filtrar</h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Acota las facturas por documento, contacto y fechas.
              </p>
            </div>

            <div className="grid gap-3 px-4 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="ncf" className="text-xs">
                  NCF/Número
                </Label>
                <Input id="ncf" name="ncf" defaultValue={ncf} placeholder="B0100000001" className="h-8 text-xs" />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="contacto" className="text-xs">
                  {tipo === "cobrar" ? "Cliente" : "Proveedor"}
                </Label>
                <Input
                  id="contacto"
                  name="contacto"
                  defaultValue={contacto}
                  placeholder="Nombre del contacto"
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Fecha de creación</Label>
                <SelectorParFechas
                  nombreDesde="creacion_desde"
                  nombreHasta="creacion_hasta"
                  valorDesde={creacionDesde}
                  valorHasta={creacionHasta}
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Fecha de vencimiento</Label>
                <SelectorParFechas
                  nombreDesde="vencimiento_desde"
                  nombreHasta="vencimiento_hasta"
                  valorDesde={vencimientoDesde}
                  valorHasta={vencimientoHasta}
                />
              </div>
            </div>

            <div className="border-border flex items-center justify-between border-t px-4 py-3">
              <Button variant="ghost" size="sm" render={<Link href={urlLimpiar} prefetch={false} />}>
                Limpiar
              </Button>
              <Button type="submit" size="sm">
                Aplicar filtros
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
