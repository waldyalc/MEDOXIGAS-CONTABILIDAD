"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Eye, Plus } from "lucide-react";

import { PaginadorLista } from "@/components/listas/paginador-lista";
import {
  BarraLista,
  type ColumnaLista,
  ContenedorLista,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { type ParametrosLista, type ResumenPagina, TAMANOS_PAGINA, urlLista } from "@/lib/listas/parametros";
import type { EstadoNomina, FrecuenciaPago, PeriodoNomina } from "@/lib/nomina/tipos";

import {
  EstadoNominaPill,
  etiquetaFrecuencia,
  etiquetaPeriodo,
  MIGAS_BASE,
  RUTA_PERIODOS,
  rutaPeriodoNomina,
} from "./comun-nomina";
import type { ConteoRecibos } from "./datos";
import { DialogoCrearPeriodo } from "./dialogo-crear-periodo";

interface Filtros {
  anio: number;
  frecuencia: FrecuenciaPago | "";
  estado: EstadoNomina | "";
}

interface Props {
  readonly periodos: PeriodoNomina[];
  readonly conteos: Record<string, ConteoRecibos>;
  readonly resumen: ResumenPagina;
  readonly params: ParametrosLista;
  readonly tamano: number;
  readonly filtros: Filtros;
  readonly anioActual: number;
  readonly aniosConParametros: readonly number[];
  readonly frecuenciaDefecto: FrecuenciaPago;
  readonly puedeEscribir: boolean;
}

const ESTADOS: readonly { value: EstadoNomina; label: string }[] = [
  { value: "borrador", label: "Borrador" },
  { value: "calculado", label: "Calculado" },
  { value: "contabilizado", label: "Contabilizado" },
  { value: "pagado", label: "Pagado" },
  { value: "anulado", label: "Anulado" },
];

export function PeriodosCliente({
  periodos,
  conteos,
  resumen,
  params,
  tamano,
  filtros,
  anioActual,
  aniosConParametros,
  frecuenciaDefecto,
  puedeEscribir,
}: Props) {
  const router = useRouter();
  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  const hayFiltros = Boolean(filtros.frecuencia) || Boolean(filtros.estado);
  const anios = Array.from({ length: 5 }, (_, indice) => anioActual - 2 + indice);

  function cambiar(clave: string, valor: string) {
    router.replace(urlLista(RUTA_PERIODOS, params, { [clave]: valor || null, pagina: null }), { scroll: false });
  }

  function limpiar() {
    router.replace(urlLista(RUTA_PERIODOS, params, { frecuencia: null, estado: null, pagina: null }), {
      scroll: false,
    });
  }

  const columnas: readonly ColumnaLista<PeriodoNomina>[] = [
    {
      clave: "periodo",
      encabezado: "Periodo",
      celda: (periodo) => (
        <div className="flex flex-col">
          <span className="font-medium">{etiquetaPeriodo(periodo.fecha_inicio, periodo.fecha_fin)}</span>
          <span className="text-muted-foreground font-mono text-xs">{periodo.codigo}</span>
        </div>
      ),
    },
    {
      clave: "frecuencia",
      encabezado: "Frecuencia",
      className: "hidden lg:table-cell",
      celda: (periodo) => etiquetaFrecuencia(periodo.frecuencia),
    },
    {
      clave: "empleados",
      encabezado: "Empleados",
      alineacion: "derecha",
      celda: (periodo) => conteos[periodo.id]?.activos ?? 0,
    },
    {
      clave: "salario",
      encabezado: "Salario",
      alineacion: "derecha",
      className: "hidden md:table-cell",
      celda: (periodo) => formatoMoneda(periodo.total_salario),
    },
    {
      clave: "neto",
      encabezado: "Total a pagar",
      alineacion: "derecha",
      celda: (periodo) => formatoMoneda(periodo.total_neto),
    },
    {
      clave: "costo",
      encabezado: "Costo de la empresa",
      alineacion: "derecha",
      className: "hidden xl:table-cell",
      celda: (periodo) => formatoMoneda(periodo.total_costo_empresa),
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (periodo) => <EstadoNominaPill estado={periodo.estado} />,
    },
  ];

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Periodos y cálculo"
        subtitulo="Crea el periodo, revisa las novedades y calcula los recibos."
        migas={[...MIGAS_BASE, { etiqueta: "Periodos y cálculo" }]}
        acciones={
          puedeEscribir ? (
            <Button type="button" onClick={() => setDialogoAbierto(true)}>
              <Plus />
              Crear periodo
            </Button>
          ) : null
        }
      />

      <TarjetaLista data-lista="periodos-nomina">
        <BarraLista>
          <SelectCampo
            aria-label="Filtrar por año"
            className="w-32"
            opciones={anios.map((anio) => ({ value: String(anio), label: String(anio) }))}
            valor={String(filtros.anio)}
            onCambio={(valor) => cambiar("anio", valor)}
          />
          <SelectCampo
            aria-label="Filtrar por frecuencia"
            className="w-40"
            opciones={[
              { value: "quincenal", label: "Quincenal" },
              { value: "mensual", label: "Mensual" },
            ]}
            etiquetaVacia="Todas las frecuencias"
            valor={filtros.frecuencia}
            onCambio={(valor) => cambiar("frecuencia", valor)}
          />
          <SelectCampo
            aria-label="Filtrar por estado"
            className="w-44"
            opciones={[...ESTADOS]}
            etiquetaVacia="Todos los estados"
            valor={filtros.estado}
            onCambio={(valor) => cambiar("estado", valor)}
          />
          {hayFiltros ? (
            <Button type="button" variant="ghost" size="sm" onClick={limpiar}>
              Limpiar
            </Button>
          ) : null}
        </BarraLista>

        <TablaLista
          columnas={columnas}
          filas={periodos}
          claveFila={(periodo) => periodo.id}
          filaHref={(periodo) => rutaPeriodoNomina(periodo.id)}
          acciones={(periodo) => (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Ver periodo ${periodo.codigo}`}
              render={<Link href={rutaPeriodoNomina(periodo.id)} prefetch={false} />}
            >
              <Eye />
            </Button>
          )}
          vacio={{
            filtrada: hayFiltros,
            titulo: hayFiltros ? "Sin resultados" : "Todavía no hay periodos de nómina.",
            descripcion: hayFiltros
              ? "No hay periodos con ese año, frecuencia y estado."
              : "Crea el primero para calcular los recibos del mes o de la quincena.",
            accion:
              puedeEscribir && !hayFiltros ? (
                <Button type="button" onClick={() => setDialogoAbierto(true)}>
                  <Plus />
                  Crear periodo
                </Button>
              ) : undefined,
          }}
        />

        <PaginadorLista
          base={RUTA_PERIODOS}
          params={params}
          resumen={resumen}
          etiqueta="Ítems por página"
          tamano={tamano}
          opciones={TAMANOS_PAGINA}
          mostrarEnVacio
          botonesExtremos={false}
          className="border-border h-14 border-t px-4 text-slate-700 dark:text-slate-300"
        />
      </TarjetaLista>

      {puedeEscribir ? (
        <DialogoCrearPeriodo
          abierto={dialogoAbierto}
          onOpenChange={setDialogoAbierto}
          frecuenciaDefecto={frecuenciaDefecto}
          anioActual={anioActual}
          aniosConParametros={aniosConParametros}
        />
      ) : null}
    </ContenedorLista>
  );
}
