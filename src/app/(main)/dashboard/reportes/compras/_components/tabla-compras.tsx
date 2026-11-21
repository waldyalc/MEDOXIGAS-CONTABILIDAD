import { Enlace } from "@/components/enlace";
import { FileText } from "@/components/icons";
import { type ColumnaLista, TablaLista } from "@/components/listas/tabla-lista";
import { rutaCompra, rutaContacto } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import type { FilaCompra } from "@/lib/reportes/administrativos/d/tipos";
import { formatearRd } from "@/lib/reportes/dinero";

const columnas: readonly ColumnaLista<FilaCompra>[] = [
  {
    clave: "numero",
    encabezado: "Número de factura",
    celda: (fila) => (
      <Enlace href={rutaCompra(fila.id)} className="font-medium">
        {fila.ncf ?? `#${fila.numero}`}
      </Enlace>
    ),
  },
  {
    clave: "proveedor",
    encabezado: "Proveedor",
    celda: (fila) => <Enlace href={rutaContacto(fila.contactoId)}>{fila.contactoNombre}</Enlace>,
  },
  {
    clave: "fecha",
    encabezado: "Fecha",
    celda: (fila) => formatoDia(fila.fecha),
  },
  {
    clave: "antes",
    encabezado: "Antes de impuestos",
    alineacion: "derecha",
    celda: (fila) => formatearRd(fila.subtotal),
  },
  {
    clave: "despues",
    encabezado: "Después de impuestos",
    alineacion: "derecha",
    celda: (fila) => <span className="font-medium">{formatearRd(fila.total)}</span>,
  },
];

export function TablaCompras({ filas }: { filas: FilaCompra[] }) {
  return (
    <TablaLista
      columnas={columnas}
      filas={filas}
      claveFila={(fila) => fila.id}
      filaHref={(fila) => rutaCompra(fila.id)}
      vacio={{
        filtrada: true,
        titulo: "No hay compras en el período seleccionado.",
        icono: <FileText className="size-10" />,
      }}
    />
  );
}
