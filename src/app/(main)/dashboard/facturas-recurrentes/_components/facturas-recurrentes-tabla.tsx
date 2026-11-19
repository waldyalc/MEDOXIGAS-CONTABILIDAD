import type { ReactNode } from "react";

import { Repeat } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { type ColumnaLista, TablaLista } from "@/components/listas/tabla-lista";
import { rutaContacto, rutaFacturaRecurrente } from "@/lib/enlaces";
import type { FacturaRecurrenteLista } from "@/lib/facturas-recurrentes/tipos";
import { formatoDia } from "@/lib/formato";

function frecuenciaTexto(meses: number) {
  return meses === 1 ? "Cada mes" : `Cada ${meses} meses`;
}

const columnas: readonly ColumnaLista<FacturaRecurrenteLista>[] = [
  {
    clave: "numero",
    encabezado: "#",
    className: "w-16",
    celda: (recurrente) => <Enlace href={rutaFacturaRecurrente(recurrente.id)}>{recurrente.numero}</Enlace>,
  },
  {
    clave: "cliente",
    encabezado: "Cliente",
    celda: (recurrente) => <Enlace href={rutaContacto(recurrente.contacto_id)}>{recurrente.cliente_nombre}</Enlace>,
  },
  {
    clave: "frecuencia",
    encabezado: "Frecuencia",
    celda: (recurrente) => frecuenciaTexto(recurrente.frecuencia_meses),
  },
  {
    clave: "inicio",
    encabezado: "Inicio",
    celda: (recurrente) => formatoDia(recurrente.fecha_inicio),
  },
  {
    clave: "hasta",
    encabezado: "Hasta",
    celda: (recurrente) => (recurrente.vigencia_hasta ? formatoDia(recurrente.vigencia_hasta) : "Sin límite"),
  },
  {
    clave: "ultima",
    encabezado: "Última generación",
    celda: (recurrente) => (recurrente.ultimo_periodo ? formatoDia(recurrente.ultimo_periodo) : "—"),
  },
  {
    clave: "generaciones",
    encabezado: "Facturas",
    alineacion: "derecha",
    celda: (recurrente) => recurrente.generaciones,
  },
];

export function FacturasRecurrentesTabla({
  recurrentes,
  busqueda,
  accion,
}: {
  recurrentes: FacturaRecurrenteLista[];
  busqueda?: string;
  /** CTA del vacío; la página solo la pasa si el rol puede crear. */
  accion?: ReactNode;
}) {
  return (
    <TablaLista
      columnas={columnas}
      filas={recurrentes}
      claveFila={(recurrente) => recurrente.id}
      filaHref={(recurrente) => rutaFacturaRecurrente(recurrente.id)}
      vacio={{
        filtrada: Boolean(busqueda),
        titulo: busqueda ? "Sin resultados" : "¡Aún no tienes facturas recurrentes!",
        descripcion: busqueda
          ? "La búsqueda no arrojó facturas recurrentes."
          : "Crea una plantilla para facturar a clientes con contrato fijo.",
        icono: <Repeat className="size-10" />,
        accion,
      }}
    />
  );
}
