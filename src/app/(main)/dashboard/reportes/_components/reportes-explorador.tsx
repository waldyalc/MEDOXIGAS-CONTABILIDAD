"use client";

import { type ReactNode, useMemo, useState } from "react";

import Link from "next/link";

import { cn } from "cn";
import { ChevronRight, Search, Star, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import {
  type CategoriaReporte,
  filtrarReportes,
  type GrupoReportes,
  type ReporteCatalogo,
  reportesPorCategoria,
} from "@/lib/reportes/catalogo-reportes";

import { descripcionReporte, META_CATEGORIAS } from "./datos-reportes";

interface Props {
  categoria: CategoriaReporte | null;
  reportes: ReporteCatalogo[];
}

export function ReportesExplorador({ categoria, reportes }: Props) {
  const [busqueda, setBusqueda] = useState("");

  const grupos = useMemo(() => reportesPorCategoria(reportes), [reportes]);
  const resultados = useMemo(() => filtrarReportes(busqueda, reportes), [busqueda, reportes]);
  const buscando = busqueda.trim().length > 0;
  const grupo = categoria === null ? null : (grupos.find((item) => item.categoria === categoria) ?? null);

  let encabezado: ReactNode;
  if (buscando) {
    encabezado = <h2 className="font-heading text-lg font-medium">Resultados</h2>;
  } else if (grupo) {
    encabezado = (
      <nav aria-label="Ruta de navegación" className="flex min-w-0 items-center gap-1.5 text-sm">
        <Link
          href="/dashboard/reportes"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm outline-none focus-visible:ring-2"
        >
          Reportes
        </Link>
        <ChevronRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate font-medium">{grupo.categoria}</span>
      </nav>
    );
  } else {
    encabezado = <h2 className="font-heading text-lg font-medium">Clasificación por categoría</h2>;
  }

  let contenido: ReactNode;
  if (buscando) {
    contenido = (
      <section className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          {resultados.length} {resultados.length === 1 ? "reporte" : "reportes"} para «{busqueda.trim()}»
        </p>
        {resultados.length > 0 ? (
          <GridReportes reportes={resultados} />
        ) : (
          <SinResultados onLimpiar={() => setBusqueda("")} />
        )}
      </section>
    );
  } else if (grupo) {
    contenido = (
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">{grupo.categoria}</h2>
          <p className="text-muted-foreground max-w-2xl text-sm text-balance">
            {META_CATEGORIAS[grupo.categoria].descripcion}
          </p>
        </div>
        <GridReportes reportes={grupo.reportes} />
      </section>
    );
  } else {
    contenido = <GridCategorias grupos={grupos} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">{encabezado}</div>
        <Buscador valor={busqueda} onCambiar={setBusqueda} />
      </div>
      {contenido}
    </div>
  );
}

function Buscador({ valor, onCambiar }: { valor: string; onCambiar: (valor: string) => void }) {
  return (
    <div className="w-full sm:max-w-xs">
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={valor}
          onChange={(evento) => onCambiar(evento.target.value)}
          placeholder="Buscar reporte"
          aria-label="Buscar reporte"
          className="[&::-webkit-search-cancel-button]:appearance-none"
        />
        {valor ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" aria-label="Limpiar búsqueda" onClick={() => onCambiar("")}>
              <X aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </div>
  );
}

function GridCategorias({ grupos }: { grupos: GrupoReportes[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {grupos.map((grupo) => {
        const meta = META_CATEGORIAS[grupo.categoria];
        const Icono = meta.icono;
        const cantidad = grupo.reportes.length;

        return (
          <Link
            key={grupo.categoria}
            href={`/dashboard/reportes?categoria=${encodeURIComponent(grupo.categoria)}`}
            aria-label={
              cantidad === 1
                ? `Ver el reporte de ${grupo.categoria}`
                : `Ver los ${cantidad} reportes de ${grupo.categoria}`
            }
            className="group focus-visible:ring-ring rounded-xl outline-none focus-visible:ring-2"
          >
            <Card className="group-hover:bg-muted/50 group-hover:ring-foreground/20 h-full gap-4 py-4 transition-colors">
              <CardContent className="flex flex-col gap-3">
                <span
                  className={cn("flex size-10 items-center justify-center rounded-lg", meta.iconoClase)}
                  aria-hidden="true"
                >
                  <Icono className="size-5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{grupo.categoria}</span>
                  <span className="text-muted-foreground text-sm">
                    {cantidad} {cantidad === 1 ? "reporte" : "reportes"}
                  </span>
                </span>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function GridReportes({ reportes }: { reportes: ReporteCatalogo[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {reportes.map((reporte) => (
        <TarjetaReporte key={reporte.nombre} reporte={reporte} />
      ))}
    </div>
  );
}

function TarjetaReporte({ reporte }: { reporte: ReporteCatalogo }) {
  const meta = META_CATEGORIAS[reporte.categoria];
  const Icono = meta.icono;

  const contenido = (
    <Card className="group-hover:bg-muted/50 group-hover:ring-foreground/20 h-full gap-3 py-4 transition-colors">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn("flex size-9 items-center justify-center rounded-lg", meta.iconoClase)}
            aria-hidden="true"
          >
            <Icono className="size-4.5" />
          </span>
          <Star className="text-muted-foreground/40 size-4 shrink-0" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="leading-snug font-medium">{reporte.nombre}</span>
          <span className="text-muted-foreground text-sm">{descripcionReporte(reporte.nombre)}</span>
          {reporte.href ? null : (
            <Badge variant="secondary" className="mt-1 w-fit">
              Próximamente
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (!reporte.href) {
    return <div className="h-full">{contenido}</div>;
  }

  return (
    <Link
      href={reporte.href}
      aria-label={`Abrir ${reporte.nombre}`}
      className="group focus-visible:ring-ring h-full rounded-xl outline-none focus-visible:ring-2"
    >
      {contenido}
    </Link>
  );
}

function SinResultados({ onLimpiar }: { onLimpiar: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
      <Search className="text-muted-foreground size-6" aria-hidden="true" />
      <p className="font-medium">No hay reportes que coincidan</p>
      <p className="text-muted-foreground text-sm">Prueba con otro nombre o revisa la ortografía.</p>
      <Button variant="outline" size="sm" onClick={onLimpiar}>
        Limpiar búsqueda
      </Button>
    </div>
  );
}
