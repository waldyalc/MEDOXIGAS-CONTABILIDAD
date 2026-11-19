import type { ReactNode } from "react";

import { FileText } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { type ColumnaLista, PillEstado, TablaLista, type TonoPill } from "@/components/listas/tabla-lista";
import { rutaContacto, rutaFactura } from "@/lib/enlaces";
import { etiquetaTipoComprobante } from "@/lib/facturacion/comprobantes";
import type { FacturaFila } from "@/lib/facturacion/consultas";
import { formatoMoneda, saldoDeFactura } from "@/lib/facturacion/formato";
import type { EstadoFactura } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";

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
  const hoy = new Date().toISOString().slice(0, 10);

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
