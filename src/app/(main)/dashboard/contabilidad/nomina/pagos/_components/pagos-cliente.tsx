"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Eye } from "lucide-react";

import { PaginadorLista } from "@/components/listas/paginador-lista";
import {
  BarraLista,
  type ColumnaLista,
  ContenedorLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
  type TonoPill,
} from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { SelectCampo } from "@/components/select-campo";
import { Button } from "@/components/ui/button";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { type ParametrosLista, type ResumenPagina, TAMANOS_PAGINA, urlLista } from "@/lib/listas/parametros";
import type { PeriodoNomina } from "@/lib/nomina/tipos";

import {
  etiquetaPeriodo,
  MIGAS_BASE,
  RUTA_PAGOS,
  RUTA_PERIODOS,
  rutaPagosNomina,
} from "../../periodos/_components/comun-nomina";

export type EstadoPago = "pendiente" | "parcial" | "pagado" | "no-disponible";

export interface FilaPago {
  periodo: PeriodoNomina;
  empleados: number;
  pagados: number;
  estado: EstadoPago;
  fechaPago: string | null;
}

interface Props {
  readonly filas: FilaPago[];
  readonly resumen: ResumenPagina;
  readonly params: ParametrosLista;
  readonly tamano: number;
  readonly anio: number;
  readonly estado: EstadoPago | "";
  readonly anioActual: number;
}

const ESTADOS_PAGO: readonly { value: EstadoPago; label: string; tono: TonoPill }[] = [
  { value: "pendiente", label: "Pendiente", tono: "neutro" },
  { value: "parcial", label: "Parcial", tono: "pendiente" },
  { value: "pagado", label: "Pagado", tono: "exito" },
  { value: "no-disponible", label: "No disponible", tono: "neutro" },
];

function etiquetaEstadoPago(estado: EstadoPago): { label: string; tono: TonoPill } {
  return ESTADOS_PAGO.find((opcion) => opcion.value === estado) ?? { label: "Pendiente", tono: "neutro" };
}

export function PagosCliente({ filas, resumen, params, tamano, anio, estado, anioActual }: Props) {
  const router = useRouter();
  const anios = Array.from({ length: 5 }, (_, indice) => anioActual - 2 + indice);
  const hayFiltros = estado !== "";

  function cambiar(clave: string, valor: string) {
    router.replace(urlLista(RUTA_PAGOS, params, { [clave]: valor || null, pagina: null }), { scroll: false });
  }

  function limpiar() {
    router.replace(urlLista(RUTA_PAGOS, params, { pago: null, pagina: null }), { scroll: false });
  }

  const columnas: readonly ColumnaLista<FilaPago>[] = [
    {
      clave: "periodo",
      encabezado: "Periodo",
      celda: (fila) => (
        <div className="flex flex-col">
          <span className="font-medium">{etiquetaPeriodo(fila.periodo.fecha_inicio, fila.periodo.fecha_fin)}</span>
          <span className="text-muted-foreground font-mono text-xs">{fila.periodo.codigo}</span>
        </div>
      ),
    },
    {
      clave: "empleados",
      encabezado: "Empleados",
      alineacion: "derecha",
      celda: (fila) => fila.empleados,
    },
    {
      clave: "neto",
      encabezado: "Total a pagar",
      alineacion: "derecha",
      celda: (fila) => formatoMoneda(fila.periodo.total_neto),
    },
    {
      clave: "costo",
      encabezado: "Costo de la empresa",
      alineacion: "derecha",
      className: "hidden xl:table-cell",
      celda: (fila) => formatoMoneda(fila.periodo.total_costo_empresa),
    },
    {
      clave: "pagados",
      encabezado: "Pagados",
      alineacion: "derecha",
      celda: (fila) => `${fila.pagados} / ${fila.empleados}`,
    },
    {
      clave: "estado",
      encabezado: "Estado de pago",
      celda: (fila) => {
        const { label, tono } = etiquetaEstadoPago(fila.estado);
        return <PillEstado tono={tono}>{label}</PillEstado>;
      },
    },
    {
      clave: "fecha",
      encabezado: "Fecha de pago",
      className: "hidden md:table-cell",
      celda: (fila) => (fila.estado === "pagado" && fila.fechaPago ? formatoDia(fila.fechaPago) : "—"),
    },
  ];

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Pagos de nómina"
        subtitulo="Registra la salida de caja o banco de los recibos contabilizados."
        migas={[...MIGAS_BASE, { etiqueta: "Pagos" }]}
        acciones={
          <Button variant="outline" render={<Link href={RUTA_PERIODOS} prefetch={false} />}>
            Ver periodos
          </Button>
        }
      />

      <TarjetaLista data-lista="pagos-nomina">
        <BarraLista>
          <SelectCampo
            aria-label="Filtrar por año"
            className="w-32"
            opciones={anios.map((valor) => ({ value: String(valor), label: String(valor) }))}
            valor={String(anio)}
            onCambio={(valor) => cambiar("anio", valor)}
          />
          <SelectCampo
            aria-label="Filtrar por estado de pago"
            className="w-48"
            opciones={ESTADOS_PAGO.map((opcion) => ({ value: opcion.value, label: opcion.label }))}
            etiquetaVacia="Todos los estados"
            valor={estado}
            onCambio={(valor) => cambiar("pago", valor)}
          />
          {hayFiltros ? (
            <Button type="button" variant="ghost" size="sm" onClick={limpiar}>
              Limpiar
            </Button>
          ) : null}
        </BarraLista>

        <TablaLista
          columnas={columnas}
          filas={filas}
          claveFila={(fila) => fila.periodo.id}
          filaHref={(fila) => rutaPagosNomina(fila.periodo.id)}
          acciones={(fila) => (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Ver pagos de ${fila.periodo.codigo}`}
              render={<Link href={rutaPagosNomina(fila.periodo.id)} prefetch={false} />}
            >
              <Eye />
            </Button>
          )}
          vacio={{
            filtrada: hayFiltros,
            titulo: hayFiltros ? "Sin resultados" : "No hay pagos registrados.",
            descripcion: hayFiltros
              ? "No hay periodos con ese estado."
              : "Cuando contabilices un periodo podrás pagarlo desde aquí.",
            accion: !hayFiltros ? (
              <Button variant="outline" render={<Link href={RUTA_PERIODOS} prefetch={false} />}>
                Ir a Periodos
              </Button>
            ) : undefined,
          }}
        />

        <PaginadorLista
          base={RUTA_PAGOS}
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
    </ContenedorLista>
  );
}
