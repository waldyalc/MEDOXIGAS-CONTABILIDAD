import type { ReactNode } from "react";

import { BotonImprimir } from "@/components/boton-imprimir";
import type { MigaDePan } from "@/components/migas-de-pan";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { formatoDia } from "@/lib/formato";

interface Props {
  titulo: string;
  descripcion: string;
  /** Rango ya formateado. Si no llega, se arma con `desde` y `hasta`. */
  rango?: string;
  desde?: string;
  hasta?: string;
  migas?: readonly MigaDePan[];
  acciones?: ReactNode;
  /** Falso cuando el reporte no lleva botón de imprimir (exportar, carta con su propio botón…). */
  mostrarImprimir?: boolean;
}

export function EncabezadoReporte({
  titulo,
  descripcion,
  rango,
  desde,
  hasta,
  migas,
  acciones,
  mostrarImprimir = true,
}: Props) {
  const textoRango = rango ?? (desde && hasta ? `Del ${formatoDia(desde)} al ${formatoDia(hasta)}` : null);
  const navegacion: readonly MigaDePan[] = migas ?? [
    { etiqueta: "Inicio", href: "/dashboard" },
    { etiqueta: "Reportes", href: "/dashboard/reportes" },
    { etiqueta: titulo },
  ];
  const accionesCompletas =
    acciones != null || mostrarImprimir ? (
      <>
        {acciones}
        {mostrarImprimir ? <BotonImprimir /> : null}
      </>
    ) : null;

  return (
    <EncabezadoPagina
      titulo={titulo}
      subtitulo={textoRango ? `${descripcion} ${textoRango}` : descripcion}
      migas={navegacion}
      acciones={accionesCompletas}
    />
  );
}
