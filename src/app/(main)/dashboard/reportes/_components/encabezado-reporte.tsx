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
}

export function EncabezadoReporte({ titulo, descripcion, rango, desde, hasta, migas, acciones }: Props) {
  const textoRango = rango ?? (desde && hasta ? `Del ${formatoDia(desde)} al ${formatoDia(hasta)}` : null);

  return (
    <EncabezadoPagina
      titulo={titulo}
      subtitulo={textoRango ? `${descripcion} ${textoRango}` : descripcion}
      migas={migas}
      acciones={
        <>
          {acciones}
          <BotonImprimir />
        </>
      }
    />
  );
}
