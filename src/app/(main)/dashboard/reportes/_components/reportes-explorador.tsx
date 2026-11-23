"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { cn } from "cn";

import { ChevronRight, type IconoHuge, Search, Star, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import {
  type CategoriaReporte,
  filtrarReportes,
  type ReporteCatalogo,
  reportesPorCategoria,
} from "@/lib/reportes/catalogo-reportes";

import { descripcionReporte, META_CATEGORIAS, META_FAVORITOS } from "./datos-reportes";

const CLAVE_RECIENTES = "medoxigas:reportes-recientes";
const CLAVE_FAVORITOS = "medoxigas:reportes-favoritos";
const MAX_RECIENTES = 4;

function leerLista(clave: string): string[] {
  try {
    const valor = JSON.parse(window.localStorage.getItem(clave) ?? "[]");
    return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function guardarLista(clave: string, lista: string[]) {
  window.localStorage.setItem(clave, JSON.stringify(lista));
}

function registrarReciente(nombre: string) {
  const lista = [nombre, ...leerLista(CLAVE_RECIENTES).filter((item) => item !== nombre)].slice(0, MAX_RECIENTES);
  guardarLista(CLAVE_RECIENTES, lista);
}

interface Props {
  categoria: CategoriaReporte | null;
  reportes: ReporteCatalogo[];
}

export function ReportesExplorador({ categoria, reportes }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [recientes, setRecientes] = useState<string[]>([]);
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [vistaFavoritos, setVistaFavoritos] = useState(false);

  useEffect(() => {
    setRecientes(leerLista(CLAVE_RECIENTES));
    setFavoritos(leerLista(CLAVE_FAVORITOS));
  }, []);

  const grupos = useMemo(() => reportesPorCategoria(reportes), [reportes]);
  const resultados = useMemo(() => filtrarReportes(busqueda, reportes), [busqueda, reportes]);
  const buscando = busqueda.trim().length > 0;
  const grupo = categoria === null ? null : (grupos.find((item) => item.categoria === categoria) ?? null);

  const alternarFavorito = (nombre: string) => {
    const lista = favoritos.includes(nombre) ? favoritos.filter((item) => item !== nombre) : [...favoritos, nombre];
    setFavoritos(lista);
    guardarLista(CLAVE_FAVORITOS, lista);
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <EncabezadoExplorador
            buscando={buscando}
            vistaFavoritos={vistaFavoritos}
            categoria={grupo?.categoria ?? null}
            onPortada={() => setVistaFavoritos(false)}
          />
        </div>
        <Buscador valor={busqueda} onCambiar={setBusqueda} />
      </div>
      {buscando ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-slate-500">
            {resultados.length} {resultados.length === 1 ? "reporte" : "reportes"} para «{busqueda.trim()}»
          </p>
          {resultados.length > 0 ? (
            <GridReportes reportes={resultados} favoritos={favoritos} onFavorito={alternarFavorito} />
          ) : (
            <SinResultados onLimpiar={() => setBusqueda("")} />
          )}
        </section>
      ) : vistaFavoritos || grupo ? (
        <VistaGrupo
          titulo={vistaFavoritos ? "Favoritos" : (grupo?.categoria ?? "")}
          reportes={
            vistaFavoritos ? reportes.filter((item) => favoritos.includes(item.nombre)) : (grupo?.reportes ?? [])
          }
          vacio={vistaFavoritos}
          favoritos={favoritos}
          onFavorito={alternarFavorito}
        />
      ) : (
        <PortadaReportes
          grupos={grupos}
          reportes={reportes}
          recientes={recientes}
          favoritos={favoritos}
          onFavorito={alternarFavorito}
          onFavoritos={() => setVistaFavoritos(true)}
        />
      )}
    </div>
  );
}

function EncabezadoExplorador({
  buscando,
  vistaFavoritos,
  categoria,
  onPortada,
}: {
  buscando: boolean;
  vistaFavoritos: boolean;
  categoria: string | null;
  onPortada: () => void;
}) {
  if (buscando) {
    return <h2 className="text-base font-semibold text-slate-700">Resultados</h2>;
  }
  if (vistaFavoritos || categoria) {
    return (
      <nav aria-label="Ruta de navegación" className="flex min-w-0 items-center gap-1.5 text-sm">
        <Link
          href="/dashboard/reportes"
          onClick={onPortada}
          className="focus-visible:ring-ring rounded-sm text-slate-500 outline-none hover:text-slate-700 focus-visible:ring-2"
        >
          Reportes
        </Link>
        <ChevronRight className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="truncate font-medium text-slate-700">{vistaFavoritos ? "Favoritos" : categoria}</span>
      </nav>
    );
  }
  return <h2 className="text-base font-semibold text-slate-700">Clasificación por categoría</h2>;
}

function VistaGrupo({
  titulo,
  reportes,
  vacio,
  favoritos,
  onFavorito,
}: {
  titulo: string;
  reportes: ReporteCatalogo[];
  vacio: boolean;
  favoritos: string[];
  onFavorito: (nombre: string) => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-slate-700">{titulo}</h2>
      {reportes.length > 0 ? (
        <GridReportes reportes={reportes} favoritos={favoritos} onFavorito={onFavorito} />
      ) : vacio ? (
        <p className="text-sm text-slate-500">Todavía no has marcado reportes como favoritos.</p>
      ) : null}
    </section>
  );
}

/** Grid de Alegra: columnas fluidas de 14.25rem (10.5rem en móvil ≤530px). */
const CLASE_GRID =
  "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(14.25rem,1fr))] " +
  "max-[530px]:gap-2 max-[530px]:[grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))]";

function PortadaReportes({
  grupos,
  reportes,
  recientes,
  favoritos,
  onFavorito,
  onFavoritos,
}: {
  grupos: { categoria: CategoriaReporte; reportes: ReporteCatalogo[] }[];
  reportes: ReporteCatalogo[];
  recientes: string[];
  favoritos: string[];
  onFavorito: (nombre: string) => void;
  onFavoritos: () => void;
}) {
  const reportesRecientes = recientes
    .map((nombre) => reportes.find((reporte) => reporte.nombre === nombre))
    .filter((reporte): reporte is ReporteCatalogo => reporte != null);

  return (
    <>
      <section className="grid w-full grid-cols-1 gap-6">
        <div className={CLASE_GRID}>
          {grupos.map((item) => (
            <TarjetaCategoria
              key={item.categoria}
              categoria={item.categoria}
              cantidad={item.reportes.length}
              meta={META_CATEGORIAS[item.categoria]}
              href={`/dashboard/reportes?categoria=${encodeURIComponent(item.categoria)}`}
            />
          ))}
          <TarjetaCategoria
            categoria="Favoritos"
            cantidad={favoritos.length}
            meta={META_FAVORITOS}
            onClick={onFavoritos}
          />
        </div>
      </section>
      {reportesRecientes.length > 0 ? (
        <section className="grid w-full grid-cols-1 gap-6">
          <h2 className="text-base font-semibold text-slate-700">Recientes</h2>
          <div className={CLASE_GRID}>
            {reportesRecientes.map((reporte) => (
              <TarjetaReporte
                key={reporte.nombre}
                reporte={reporte}
                favorito={favoritos.includes(reporte.nombre)}
                onFavorito={onFavorito}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
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

interface MetaTarjeta {
  icono: IconoHuge;
  descripcion: string;
  iconoColor: string;
  iconoFondo: string;
}

function CuerpoTarjetaCategoria({
  categoria,
  cantidad,
  meta,
}: {
  categoria: string;
  cantidad: number;
  meta: MetaTarjeta;
}) {
  const Icono = meta.icono;
  return (
    <article className="group h-full min-h-[7.5rem] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-500 hover:border-slate-300 hover:bg-slate-50">
      <div className="flex h-full w-full flex-col justify-between">
        <Icono
          className="size-6 transition-all duration-500 group-hover:opacity-0"
          style={{ color: meta.iconoColor }}
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-1">
          <h4 className="text-base font-medium text-slate-700 transition-all duration-500 group-hover:-translate-y-11 group-hover:transform">
            {categoria}
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 transition-all duration-500 group-hover:opacity-0">
              {cantidad} {cantidad === 1 ? "Reporte" : "Reportes"}
            </span>
          </div>
          <p className="absolute translate-y-6 transform text-xs text-slate-500 opacity-0 transition-all duration-500 group-hover:-translate-y-3 group-hover:opacity-100">
            {meta.descripcion}
          </p>
        </div>
      </div>
    </article>
  );
}

function TarjetaCategoria({
  categoria,
  cantidad,
  meta,
  href,
  onClick,
}: {
  categoria: string;
  cantidad: number;
  meta: MetaTarjeta;
  href?: string;
  onClick?: () => void;
}) {
  const etiqueta = cantidad === 1 ? `Ver el reporte de ${categoria}` : `Ver los ${cantidad} reportes de ${categoria}`;
  const clase = "group focus-visible:ring-ring rounded-2xl outline-none focus-visible:ring-2 h-full";

  if (href) {
    return (
      <Link href={href} aria-label={etiqueta} className={clase}>
        <CuerpoTarjetaCategoria categoria={categoria} cantidad={cantidad} meta={meta} />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={etiqueta} className={cn(clase, "cursor-pointer text-left")}>
      <CuerpoTarjetaCategoria categoria={categoria} cantidad={cantidad} meta={meta} />
    </button>
  );
}

function GridReportes({
  reportes,
  favoritos,
  onFavorito,
}: {
  reportes: ReporteCatalogo[];
  favoritos: string[];
  onFavorito: (nombre: string) => void;
}) {
  return (
    <div className="grid [grid-template-columns:repeat(auto-fill,minmax(14.25rem,1fr))] gap-4 max-[530px]:[grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))] max-[530px]:gap-2">
      {reportes.map((reporte) => (
        <TarjetaReporte
          key={reporte.nombre}
          reporte={reporte}
          favorito={favoritos.includes(reporte.nombre)}
          onFavorito={onFavorito}
        />
      ))}
    </div>
  );
}

function CuerpoTarjetaReporte({
  reporte,
  favorito,
  onFavorito,
}: {
  reporte: ReporteCatalogo;
  favorito: boolean;
  onFavorito: (nombre: string) => void;
}) {
  const meta = META_CATEGORIAS[reporte.categoria];
  const Icono = meta.icono;
  const esExcel = /^Reporte \d{3}$/.test(reporte.nombre);

  return (
    <div className="report-card-container h-full w-full cursor-pointer rounded-xl border border-slate-200 bg-white transition-all duration-300 ease-in-out hover:border-slate-300 hover:bg-slate-50">
      <div className="flex h-10 w-full items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: meta.iconoFondo }}
            aria-hidden="true"
          >
            <Icono className="size-4" style={{ color: meta.iconoColor }} />
          </div>
          {esExcel ? (
            <span className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              Excel
            </span>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={favorito ? `Quitar ${reporte.nombre} de favoritos` : `Marcar ${reporte.nombre} como favorito`}
          aria-pressed={favorito}
          onClick={(evento) => {
            evento.preventDefault();
            evento.stopPropagation();
            onFavorito(reporte.nombre);
          }}
          className="focus-visible:ring-ring rounded-sm p-0.5 outline-none focus-visible:ring-2"
        >
          <Star
            className={cn(
              "size-4 cursor-pointer transition-all ease-in-out",
              favorito ? "fill-amber-400 text-amber-400" : "text-transparent hover:text-amber-400",
            )}
            aria-hidden="true"
          />
        </button>
      </div>
      <div className="p-3">
        <div className="flex min-h-[60px] flex-col gap-1.5">
          <h4 className="text-sm font-medium text-slate-700">{reporte.nombre}</h4>
          <p className="text-xs text-slate-700">{descripcionReporte(reporte.nombre)}</p>
          {reporte.href ? null : <p className="text-xs text-slate-400">Próximamente</p>}
        </div>
      </div>
    </div>
  );
}

function TarjetaReporte({
  reporte,
  favorito,
  onFavorito,
}: {
  reporte: ReporteCatalogo;
  favorito: boolean;
  onFavorito: (nombre: string) => void;
}) {
  const cuerpo = <CuerpoTarjetaReporte reporte={reporte} favorito={favorito} onFavorito={onFavorito} />;

  if (!reporte.href) {
    return <div className="h-full">{cuerpo}</div>;
  }

  return (
    <Link
      href={reporte.href}
      aria-label={`Abrir ${reporte.nombre}`}
      onClick={() => registrarReciente(reporte.nombre)}
      className="group focus-visible:ring-ring h-full rounded-xl outline-none focus-visible:ring-2"
    >
      {cuerpo}
    </Link>
  );
}

function SinResultados({ onLimpiar }: { onLimpiar: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
      <Search className="size-6 text-slate-400" aria-hidden="true" />
      <p className="font-medium text-slate-700">No hay reportes que coincidan</p>
      <p className="text-sm text-slate-500">Prueba con otro nombre o revisa la ortografía.</p>
      <Button variant="outline" size="sm" onClick={onLimpiar}>
        Limpiar búsqueda
      </Button>
    </div>
  );
}
