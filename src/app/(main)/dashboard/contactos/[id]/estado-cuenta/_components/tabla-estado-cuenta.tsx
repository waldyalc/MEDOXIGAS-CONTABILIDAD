import { Enlace } from "@/components/enlace";
import { type ColumnaLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
import { TableCell, TableRow } from "@/components/ui/table";
import { etiquetaTramo, type FilaEstadoCuenta, type TotalesEstadoCuenta } from "@/lib/contactos/estado-cuenta";
import { rutaFactura } from "@/lib/enlaces";
import { formatoMonedaCentavos } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";

const columnas: readonly ColumnaLista<FilaEstadoCuenta>[] = [
  {
    clave: "documento",
    encabezado: "Documento",
    celda: (fila) => (
      <Enlace
        href={rutaFactura(fila.id)}
        aria-label={fila.ncf ? `Ver factura ${fila.ncf}` : "Ver factura"}
        className="flex flex-col"
      >
        <span className="font-medium">{fila.ncf ?? "—"}</span>
      </Enlace>
    ),
  },
  {
    clave: "creacion",
    encabezado: "Creación",
    celda: (fila) => formatoDia(fila.fecha),
  },
  {
    clave: "vencimiento",
    encabezado: "Vencimiento",
    celda: (fila) => formatoDia(fila.vencimiento),
  },
  {
    clave: "antiguedad",
    encabezado: "Antigüedad",
    celda: (fila) => etiquetaTramo(fila.tramo),
  },
  {
    clave: "diasVencidos",
    encabezado: "Días vencidos",
    alineacion: "derecha",
    celda: (fila) =>
      fila.diasVencidos > 0 ? (
        <span className="text-destructive">{fila.diasVencidos}</span>
      ) : (
        <span className="text-muted-foreground">0</span>
      ),
  },
  {
    clave: "estado",
    encabezado: "Estado",
    celda: (fila) => (
      <PillEstado tono={fila.pagada ? "exito" : "pendiente"}>{fila.pagada ? "Pagada" : "Pendiente"}</PillEstado>
    ),
  },
  {
    clave: "total",
    encabezado: "Total",
    alineacion: "derecha",
    celda: (fila) => formatoMonedaCentavos(fila.totalCentavos),
  },
  {
    clave: "cobrado",
    encabezado: "Cobrado",
    alineacion: "derecha",
    celda: (fila) => formatoMonedaCentavos(fila.cobradoCentavos),
  },
  {
    clave: "saldo",
    encabezado: "Saldo",
    alineacion: "derecha",
    celda: (fila) => <span className="font-medium">{formatoMonedaCentavos(fila.saldoCentavos)}</span>,
  },
];

export function TablaEstadoCuenta({
  filas,
  totales,
}: {
  readonly filas: FilaEstadoCuenta[];
  readonly totales: TotalesEstadoCuenta;
}) {
  return (
    <TablaLista
      columnas={columnas}
      filas={filas}
      claveFila={(fila) => fila.id}
      vacio={{
        filtrada: true,
        titulo: "Sin documentos",
        descripcion: "No hay documentos para los filtros seleccionados.",
      }}
      pie={
        <TableRow>
          <TableCell colSpan={6}>Totales</TableCell>
          <TableCell className="text-right tabular-nums">{formatoMonedaCentavos(totales.ventas)}</TableCell>
          <TableCell className="text-right tabular-nums">{formatoMonedaCentavos(totales.cobrado)}</TableCell>
          <TableCell className="text-right tabular-nums">{formatoMonedaCentavos(totales.porCobrar)}</TableCell>
        </TableRow>
      }
    />
  );
}
