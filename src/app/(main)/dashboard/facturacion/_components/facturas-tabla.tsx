import type { ReactNode } from "react";

import { Enlace } from "@/components/enlace";
import { Circle, CircleCheck, CircleX, Clock, FileText } from "@/components/icons";
import { type ColumnaLista, PillEstado, TablaLista, type TonoPill } from "@/components/listas/tabla-lista";
import { rutaContacto, rutaFactura } from "@/lib/enlaces";
import { etiquetaTipoComprobante } from "@/lib/facturacion/comprobantes";
import type { FacturaFila } from "@/lib/facturacion/consultas";
import { derivarEstadoEmisionFactura } from "@/lib/facturacion/emision-ecf";
import { formatoMoneda, saldoDeFactura } from "@/lib/facturacion/formato";
import type { EstadoFactura } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";
import { hoyRd } from "@/lib/reportes/fechas";

const ETIQUETAS: Record<EstadoFactura, string> = {
  abierta: "Por cobrar",
  pagada: "Cobrada",
  anulada: "Anulada",
};

const TONOS: Record<EstadoFactura, TonoPill> = {
  abierta: "pendiente",
  pagada: "exito",
  anulada: "peligro",
};

function EstadoEmisionCelda({ factura }: { factura: FacturaFila }) {
  const estado = derivarEstadoEmisionFactura(factura.ncf, factura.envio);
  const condicional = factura.envio?.estado === "aceptado_condicional";

  if (estado === "no_electronica") {
    return (
      <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
        <Circle className="size-4" />
        No electrónica
      </span>
    );
  }
  if (estado === "emitida") {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
        title={condicional ? "Aceptado condicional" : undefined}
      >
        <CircleCheck className="size-4" />
        Emitida
      </span>
    );
  }
  if (estado === "en_proceso") {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
        <Clock className="size-4" />
        En proceso
      </span>
    );
  }
  if (estado === "rechazada") {
    return (
      <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
        <CircleX className="size-4" />
        Rechazada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
      <CircleX className="size-4" />
      Sin emisión
    </span>
  );
}

export function FacturasTabla({
  facturas,
  busqueda,
  accion,
}: {
  facturas: FacturaFila[];
  busqueda?: string;
  /** CTA del vacío; la página solo la pasa si el rol puede crear. */
  accion?: ReactNode;
}) {
  const hoy = hoyRd();

  const columnas: readonly ColumnaLista<FacturaFila>[] = [
    {
      clave: "ncf",
      encabezado: "Número de factura",
      celda: (factura) => (factura.ncf ? <Enlace href={rutaFactura(factura.id)}>{factura.ncf}</Enlace> : "—"),
    },
    {
      clave: "tipo",
      encabezado: "Tipo",
      celda: (factura) => etiquetaTipoComprobante(factura.tipo_comprobante),
    },
    {
      clave: "cliente",
      encabezado: "Cliente",
      celda: (factura) => <Enlace href={rutaContacto(factura.contacto_id)}>{factura.cliente_nombre}</Enlace>,
    },
    {
      clave: "fecha",
      encabezado: "Fecha",
      celda: (factura) => formatoDia(factura.fecha),
    },
    {
      clave: "vencimiento",
      encabezado: "Vencimiento",
      celda: (factura) => {
        const vencida = factura.estado === "abierta" && factura.vencimiento < hoy;
        return (
          <span className={vencida ? "font-medium text-red-600 dark:text-red-400" : undefined}>
            {formatoDia(factura.vencimiento)}
          </span>
        );
      },
    },
    {
      clave: "total",
      encabezado: "Total",
      alineacion: "derecha",
      celda: (factura) => formatoMoneda(factura.total),
    },
    {
      clave: "estadoEmision",
      encabezado: "Estado de emisión",
      celda: (factura) => <EstadoEmisionCelda factura={factura} />,
    },
    {
      clave: "porCobrar",
      encabezado: "Por cobrar",
      alineacion: "derecha",
      celda: (factura) =>
        factura.estado === "anulada"
          ? "—"
          : formatoMoneda(saldoDeFactura(factura.total, factura.pagado, factura.credito, factura.retenido)),
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (factura) => <PillEstado tono={TONOS[factura.estado]}>{ETIQUETAS[factura.estado]}</PillEstado>,
    },
  ];

  return (
    <TablaLista
      columnas={columnas}
      filas={facturas}
      claveFila={(factura) => factura.id}
      filaHref={(factura) => rutaFactura(factura.id)}
      vacio={{
        filtrada: Boolean(busqueda),
        titulo: busqueda ? "Sin resultados" : "¡Aún no tienes facturas!",
        descripcion: busqueda ? "La búsqueda no arrojó facturas." : "Crea tu primera factura de venta para empezar.",
        icono: <FileText className="size-10" />,
        accion,
      }}
    />
  );
}
