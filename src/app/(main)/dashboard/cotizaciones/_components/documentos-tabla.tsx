import type { ReactNode } from "react";

import { Enlace } from "@/components/enlace";
import { FileText } from "@/components/icons";
import { type ColumnaLista, PillEstado, TablaLista, type TonoPill } from "@/components/listas/tabla-lista";
import type { DocumentoFila, EstadoDocumento, TipoDocumento } from "@/lib/cotizaciones/tipos";
import { rutaConduce, rutaContacto, rutaCotizacion } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";

export const TEXTOS_DOCUMENTO: Record<
  TipoDocumento,
  { titulo: string; descripcion: string; nueva: string; rutaNueva: string; rutaBase: string; vacio: string }
> = {
  cotizacion: {
    titulo: "Cotizaciones",
    descripcion: "Propuestas de venta sin asiento contable.",
    nueva: "Nueva cotización",
    rutaNueva: "/dashboard/cotizaciones/nueva",
    rutaBase: "/dashboard/cotizaciones",
    vacio: "No hay cotizaciones todavía.",
  },
  remision: {
    titulo: "Conduces",
    descripcion: "Entregas sin movimiento de inventario ni asiento contable.",
    nueva: "Nuevo conduce",
    rutaNueva: "/dashboard/conduces/nueva",
    rutaBase: "/dashboard/conduces",
    vacio: "No hay conduces todavía.",
  },
};

const ESTADOS: Record<EstadoDocumento, string> = {
  abierta: "Abierta",
  convertida: "Convertida",
  anulada: "Anulada",
};

const TONOS: Record<EstadoDocumento, TonoPill> = {
  abierta: "pendiente",
  convertida: "exito",
  anulada: "peligro",
};

interface Props {
  tipo: TipoDocumento;
  documentos: DocumentoFila[];
  busqueda?: string;
  /** CTA del vacío; la página solo la pasa si el rol puede crear. */
  accion?: ReactNode;
}

export function DocumentosTabla({ tipo, documentos, busqueda, accion }: Props) {
  const textos = TEXTOS_DOCUMENTO[tipo];

  const columnas: readonly ColumnaLista<DocumentoFila>[] = [
    {
      clave: "numero",
      encabezado: "Número",
      className: "w-24",
      celda: (documento) => (
        <Enlace href={tipo === "cotizacion" ? rutaCotizacion(documento.id) : rutaConduce(documento.id)}>
          {documento.numero}
        </Enlace>
      ),
    },
    {
      clave: "cliente",
      encabezado: "Cliente",
      celda: (documento) => <Enlace href={rutaContacto(documento.contacto_id)}>{documento.cliente_nombre}</Enlace>,
    },
    {
      clave: "creacion",
      encabezado: "Creación",
      celda: (documento) => formatoDia(documento.fecha),
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (documento) => <PillEstado tono={TONOS[documento.estado]}>{ESTADOS[documento.estado]}</PillEstado>,
    },
    {
      clave: "total",
      encabezado: "Total",
      alineacion: "derecha",
      celda: (documento) => <span className="font-medium">{formatoMoneda(documento.total)}</span>,
    },
  ];

  return (
    <TablaLista
      columnas={columnas}
      filas={documentos}
      claveFila={(documento) => documento.id}
      filaHref={(documento) => (tipo === "cotizacion" ? rutaCotizacion(documento.id) : rutaConduce(documento.id))}
      vacio={{
        filtrada: Boolean(busqueda),
        titulo: busqueda ? "Sin resultados" : "Aún no hay documentos",
        descripcion: busqueda ? "La búsqueda no arrojó documentos." : textos.vacio,
        icono: <FileText className="size-10" />,
        accion,
      }}
    />
  );
}
