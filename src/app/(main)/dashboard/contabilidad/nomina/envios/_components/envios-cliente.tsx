"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Eye, Info, Send } from "@/components/icons";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatoFechaHora } from "@/lib/formato";
import { type ParametrosLista, type ResumenPagina, TAMANOS_PAGINA, urlLista } from "@/lib/listas/parametros";
import type { PeriodoNomina } from "@/lib/nomina/tipos";

import { etiquetaPeriodo, MIGAS_BASE, RUTA_ENVIOS, RUTA_PERIODOS } from "../../periodos/_components/comun-nomina";
import { DialogoEnviarColillas } from "./dialogo-enviar-colillas";

export type EstadoEnvio = "pendiente" | "parcial" | "enviado";

export interface FilaEnvio {
  periodo: PeriodoNomina;
  empleados: number;
  enviados: number;
  estado: EstadoEnvio;
  ultimoEnvio: string | null;
}

interface Props {
  readonly filas: FilaEnvio[];
  readonly resumen: ResumenPagina;
  readonly params: ParametrosLista;
  readonly tamano: number;
  readonly anio: number;
  readonly estado: EstadoEnvio | "";
  readonly anioActual: number;
  readonly puedeEscribir: boolean;
}

const ESTADOS: readonly { value: EstadoEnvio; label: string; tono: TonoPill }[] = [
  { value: "pendiente", label: "Pendiente", tono: "neutro" },
  { value: "parcial", label: "Parcial", tono: "pendiente" },
  { value: "enviado", label: "Enviado", tono: "exito" },
];

function etiquetaEstado(estado: EstadoEnvio): { label: string; tono: TonoPill } {
  return ESTADOS.find((opcion) => opcion.value === estado) ?? { label: "Pendiente", tono: "neutro" };
}

export function EnviosCliente({ filas, resumen, params, tamano, anio, estado, anioActual, puedeEscribir }: Props) {
  const router = useRouter();
  const [periodoAbierto, setPeriodoAbierto] = useState<PeriodoNomina | null>(null);
  const anios = Array.from({ length: 5 }, (_, indice) => anioActual - 2 + indice);
  const hayFiltros = estado !== "";

  function cambiar(clave: string, valor: string) {
    router.replace(urlLista(RUTA_ENVIOS, params, { [clave]: valor || null, pagina: null }), { scroll: false });
  }

  function limpiar() {
    router.replace(urlLista(RUTA_ENVIOS, params, { estado_envio: null, pagina: null }), { scroll: false });
  }

  const columnas: readonly ColumnaLista<FilaEnvio>[] = [
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
      clave: "enviadas",
      encabezado: "Colillas enviadas",
      alineacion: "derecha",
      celda: (fila) => `${fila.enviados} / ${fila.empleados}`,
    },
    {
      clave: "ultimo",
      encabezado: "Último envío",
      className: "hidden md:table-cell",
      celda: (fila) => (fila.ultimoEnvio ? formatoFechaHora(fila.ultimoEnvio) : "—"),
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (fila) => {
        const { label, tono } = etiquetaEstado(fila.estado);
        return <PillEstado tono={tono}>{label}</PillEstado>;
      },
    },
  ];

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Envíos de colillas"
        subtitulo="Consulta y registra la entrega de las colillas de pago."
        migas={[...MIGAS_BASE, { etiqueta: "Envíos" }]}
        acciones={
          <Button variant="outline" render={<Link href={RUTA_PERIODOS} prefetch={false} />}>
            Ver periodos
          </Button>
        }
      />

      <Alert>
        <Info />
        <AlertTitle>Constancia de envío, sin correo todavía</AlertTitle>
        <AlertDescription>
          La constancia de envío se guarda en el sistema. El envío por correo se habilitará cuando se configure un
          proveedor; por ahora no sale ningún correo.
        </AlertDescription>
      </Alert>

      <TarjetaLista data-lista="envios-nomina">
        <BarraLista>
          <SelectCampo
            aria-label="Filtrar por año"
            className="w-32"
            opciones={anios.map((valor) => ({ value: String(valor), label: String(valor) }))}
            valor={String(anio)}
            onCambio={(valor) => cambiar("anio", valor)}
          />
          <SelectCampo
            aria-label="Filtrar por estado de envío"
            className="w-44"
            opciones={ESTADOS.map((opcion) => ({ value: opcion.value, label: opcion.label }))}
            etiquetaVacia="Todos los estados"
            valor={estado}
            onCambio={(valor) => cambiar("estado_envio", valor)}
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
          acciones={(fila) => (
            <span className="inline-flex items-center gap-1">
              {puedeEscribir && fila.enviados < fila.empleados ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPeriodoAbierto(fila.periodo)}
                  aria-label={`Registrar envío del periodo ${fila.periodo.codigo}`}
                >
                  <Send />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setPeriodoAbierto(fila.periodo)}
                aria-label={`Ver colillas del periodo ${fila.periodo.codigo}`}
              >
                <Eye />
              </Button>
            </span>
          )}
          vacio={{
            filtrada: hayFiltros,
            titulo: hayFiltros ? "Sin resultados" : "Todavía no se han enviado colillas.",
            descripcion: hayFiltros ? "No hay periodos con ese estado." : "Selecciona un periodo y registra el envío.",
            accion: !hayFiltros ? (
              <Button variant="outline" render={<Link href={RUTA_PERIODOS} prefetch={false} />}>
                Ver periodos
              </Button>
            ) : undefined,
          }}
        />

        <PaginadorLista
          base={RUTA_ENVIOS}
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

      {periodoAbierto ? (
        <DialogoEnviarColillas
          abierto
          onOpenChange={(abierto) => {
            if (!abierto) setPeriodoAbierto(null);
          }}
          periodo={periodoAbierto}
          puedeEscribir={puedeEscribir}
        />
      ) : null}
    </ContenedorLista>
  );
}
