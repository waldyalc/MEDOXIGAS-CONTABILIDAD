"use client";

import Link from "next/link";

import { AvatarInicial } from "@/components/avatar-inicial";
import {
  createDataTableColumnHelper,
  createDataTableSelectColumn,
  DataTableContent,
  DataTableFacetFilter,
  type DataTableFacetOption,
  DataTablePagination,
  DataTableReset,
  DataTableSearch,
  DataTableSelectionBar,
  DataTableViewOptions,
  useDataTable,
} from "@/components/dashboardblocks/data-table";
import { LinkProvider } from "@/components/dashboardblocks/link";
import { StatusLabel, type StatusTone } from "@/components/dashboardblocks/status-label";
import { DataTableRowLink } from "@/components/dashboardblocks/table";
import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { rutaContacto, rutaFactura } from "@/lib/enlaces";
import { etiquetaTipoComprobante } from "@/lib/facturacion/comprobantes";
import type { FacturaFila } from "@/lib/facturacion/consultas";
import { formatoMoneda, saldoDeFactura } from "@/lib/facturacion/formato";
import { type EstadoFactura, TIPOS_COMPROBANTE } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";

const ESTADOS: Record<EstadoFactura, { etiqueta: string; tono: StatusTone }> = {
  abierta: { etiqueta: "Abierta", tono: "warning" },
  pagada: { etiqueta: "Pagada", tono: "good" },
  anulada: { etiqueta: "Anulada", tono: "bad" },
};

const OPCIONES_ESTADO: DataTableFacetOption[] = (["abierta", "pagada", "anulada"] as const).map((estado) => ({
  label: ESTADOS[estado].etiqueta,
  value: estado,
}));

const OPCIONES_TIPO: DataTableFacetOption[] = TIPOS_COMPROBANTE.map((tipo) => ({
  label: etiquetaTipoComprobante(tipo),
  value: tipo,
}));

const columnHelper = createDataTableColumnHelper<FacturaFila>();

const columnas = columnHelper.columns([
  createDataTableSelectColumn<FacturaFila>({ getRowLabel: (factura) => `la factura ${factura.ncf ?? factura.numero}` }),
  columnHelper.accessor("ncf", {
    cell: ({ row }) => (
      <span className="block">
        <DataTableRowLink href={rutaFactura(row.original.id)} className="font-mono">
          {row.original.ncf ?? `Factura ${row.original.numero}`}
        </DataTableRowLink>
        {row.original.ncf ? (
          <span className="text-muted-foreground block text-xs font-normal">N.º {row.original.numero}</span>
        ) : null}
      </span>
    ),
    enableHiding: false,
    header: "NCF",
    meta: { primary: true, cellClassName: "whitespace-nowrap" },
  }),
  columnHelper.accessor("numero", {
    cell: () => null,
    enableHiding: false,
    header: "Número",
  }),
  columnHelper.accessor("cliente_nombre", {
    cell: ({ row }) => (
      <span className="flex min-w-0 items-center gap-2">
        <AvatarInicial nombre={row.original.cliente_nombre} size="sm" />
        <Enlace href={rutaContacto(row.original.contacto_id)} className="truncate">
          {row.original.cliente_nombre}
        </Enlace>
      </span>
    ),
    header: "Cliente",
    meta: { truncate: true },
  }),
  columnHelper.accessor("tipo_comprobante", {
    cell: ({ getValue }) => (
      <Badge variant="secondary" className="font-normal">
        {etiquetaTipoComprobante(getValue())}
      </Badge>
    ),
    enableGlobalFilter: false,
    enableSorting: false,
    header: "Tipo",
    meta: { cellClassName: "whitespace-nowrap" },
  }),
  columnHelper.accessor("fecha", {
    cell: ({ getValue }) => formatoDia(getValue()),
    enableGlobalFilter: false,
    header: "Fecha",
    meta: { cellClassName: "whitespace-nowrap" },
    sortDescFirst: true,
  }),
  columnHelper.accessor("vencimiento", {
    cell: ({ getValue }) => formatoDia(getValue()),
    enableGlobalFilter: false,
    header: "Vencimiento",
    meta: { cellClassName: "whitespace-nowrap" },
    sortDescFirst: true,
  }),
  columnHelper.accessor("estado", {
    cell: ({ getValue }) => {
      const estado = ESTADOS[getValue()];
      return <StatusLabel tone={estado.tono}>{estado.etiqueta}</StatusLabel>;
    },
    enableGlobalFilter: false,
    enableSorting: false,
    header: "Estado",
    meta: { cellClassName: "whitespace-nowrap" },
  }),
  columnHelper.accessor("total", {
    cell: ({ getValue }) => formatoMoneda(getValue()),
    enableGlobalFilter: false,
    header: "Total",
    meta: { align: "end" },
    sortDescFirst: true,
  }),
  columnHelper.accessor((factura) => saldoDeFactura(factura.total, factura.pagado, factura.credito, factura.retenido), {
    cell: ({ getValue, row }) => (row.original.estado === "anulada" ? "—" : formatoMoneda(getValue())),
    enableGlobalFilter: false,
    header: "Por cobrar",
    id: "por_cobrar",
    meta: { align: "end" },
  }),
]);

export function FacturasTabla({ facturas }: { facturas: FacturaFila[] }) {
  const tabla = useDataTable({
    columns: columnas,
    data: facturas,
    getRowId: (factura) => factura.id,
    initialState: { columnVisibility: { numero: false }, sorting: [{ desc: true, id: "numero" }] },
    pageSize: 12,
  });
  const seleccionadas = tabla.getSelectedRowModel().rows.length;

  return (
    <LinkProvider component={Link}>
      <section className="bg-card ring-foreground/10 @container/data-table overflow-hidden rounded-xl ring-1">
        <div className="flex min-h-9 flex-wrap items-center gap-2 p-3">
          {seleccionadas > 0 ? (
            <DataTableSelectionBar className="w-full" table={tabla} />
          ) : (
            <>
              <DataTableSearch table={tabla} placeholder="Buscar factura, cliente o NCF" />
              <DataTableFacetFilter table={tabla} columnId="estado" options={OPCIONES_ESTADO} title="Estado" />
              <DataTableFacetFilter table={tabla} columnId="tipo_comprobante" options={OPCIONES_TIPO} title="Tipo" />
              <DataTableReset table={tabla} />
              <div className="ml-auto flex items-center gap-2">
                <DataTableViewOptions table={tabla} />
              </div>
            </>
          )}
        </div>
        <div className="border-t">
          <DataTableContent caption="Facturas de venta" empty="No hay facturas todavía." table={tabla} />
        </div>
        <div className="border-t p-3">
          <DataTablePagination pageSizeOptions={[12, 24, 48]} table={tabla} />
        </div>
      </section>
    </LinkProvider>
  );
}
