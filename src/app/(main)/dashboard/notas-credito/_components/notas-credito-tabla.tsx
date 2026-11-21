import { Enlace } from "@/components/enlace";
import { FileMinus } from "@/components/icons";
import { type ColumnaLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
import { rutaContacto, rutaFactura, rutaNotaCreditoVenta } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import type { NotaCreditoLista } from "@/lib/notas-credito/tipos";

const columnas: readonly ColumnaLista<NotaCreditoLista>[] = [
  {
    clave: "numero",
    encabezado: "#",
    className: "w-16",
    celda: (nota) => <Enlace href={rutaNotaCreditoVenta(nota.id)}>{nota.numero}</Enlace>,
  },
  {
    clave: "ncf",
    encabezado: "NCF",
    celda: (nota) => (
      <Enlace href={rutaNotaCreditoVenta(nota.id)}>
        <span className="font-mono text-xs">{nota.ncf}</span>
      </Enlace>
    ),
  },
  {
    clave: "factura",
    encabezado: "Factura",
    celda: (nota) => (
      <Enlace href={rutaFactura(nota.factura_id)}>
        #{nota.factura_numero}
        {nota.factura_ncf ? ` · ${nota.factura_ncf}` : ""}
      </Enlace>
    ),
  },
  {
    clave: "cliente",
    encabezado: "Cliente",
    celda: (nota) => <Enlace href={rutaContacto(nota.contacto_id)}>{nota.cliente_nombre}</Enlace>,
  },
  {
    clave: "fecha",
    encabezado: "Fecha",
    celda: (nota) => formatoDia(nota.fecha),
  },
  {
    clave: "total",
    encabezado: "Total",
    alineacion: "derecha",
    celda: (nota) => <span className="font-medium">{formatoMoneda(nota.total)}</span>,
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (nota) => (
      <PillEstado tono={nota.estado === "anulada" ? "peligro" : "exito"}>
        {nota.estado === "anulada" ? "Anulada" : "Activa"}
      </PillEstado>
    ),
  },
];

export function NotasCreditoTabla({ notas, busqueda }: { notas: NotaCreditoLista[]; busqueda?: string }) {
  return (
    <TablaLista
      columnas={columnas}
      filas={notas}
      claveFila={(nota) => nota.id}
      filaHref={(nota) => rutaNotaCreditoVenta(nota.id)}
      vacio={{
        filtrada: Boolean(busqueda),
        titulo: busqueda ? "Sin resultados" : "¡Aún no tienes notas de crédito!",
        descripcion: busqueda
          ? "La búsqueda no arrojó notas."
          : "Se crean desde una factura de venta; aquí verás su historial.",
        icono: <FileMinus className="size-10" />,
      }}
    />
  );
}
