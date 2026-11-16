import { cn } from "cn";
import { FileText } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

const ESTILOS_ESTADO: Record<EstadoFactura, string> = {
  abierta: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  pagada: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  anulada: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

function EstadoPill({ estado }: { estado: EstadoFactura }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-[9px] pb-1 pt-1.5 text-[11px] leading-[1.3]",
        ESTILOS_ESTADO[estado],
      )}
    >
      {ETIQUETAS[estado]}
    </span>
  );
}

export function FacturasTabla({ facturas, busqueda }: { facturas: FacturaFila[]; busqueda?: string }) {
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <Table className="text-slate-700 dark:text-slate-300">
      <TableHeader>
        <TableRow className="bg-slate-200/20 hover:bg-slate-200/20 dark:bg-slate-800/40 dark:hover:bg-slate-800/40">
          <TableHead className="w-16 px-4 text-xs text-slate-700 dark:text-slate-300">#</TableHead>
          <TableHead className="px-4 text-xs text-slate-700 dark:text-slate-300">NCF</TableHead>
          <TableHead className="px-4 text-xs text-slate-700 dark:text-slate-300">Tipo</TableHead>
          <TableHead className="px-4 text-xs text-slate-700 dark:text-slate-300">Cliente</TableHead>
          <TableHead className="px-4 text-xs text-slate-700 dark:text-slate-300">Fecha</TableHead>
          <TableHead className="px-4 text-xs text-slate-700 dark:text-slate-300">Vencimiento</TableHead>
          <TableHead className="px-4 text-right text-xs text-slate-700 dark:text-slate-300">Total</TableHead>
          <TableHead className="px-4 text-right text-xs text-slate-700 dark:text-slate-300">Por cobrar</TableHead>
          <TableHead className="px-4 text-xs text-slate-700 dark:text-slate-300">Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {facturas.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={9} className="py-12">
              <div className="flex flex-col items-center gap-1.5 text-center">
                <FileText className="size-10 text-slate-300 dark:text-slate-600" />
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  {busqueda ? "Sin resultados" : "Aún no hay facturas"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {busqueda ? "No se encontraron facturas con esa búsqueda." : "Todavía no tienes facturas de venta."}
                </p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          facturas.map((factura) => {
            const vencida = factura.estado === "abierta" && factura.vencimiento < hoy;
            return (
              <TableRow key={factura.id} className="h-12 hover:bg-slate-200/45 dark:hover:bg-slate-800/40">
                <TableCell className="px-4">
                  <Enlace href={rutaFactura(factura.id)}>{factura.numero}</Enlace>
                </TableCell>
                <TableCell className="px-4 font-mono text-xs">
                  {factura.ncf ? <Enlace href={rutaFactura(factura.id)}>{factura.ncf}</Enlace> : "—"}
                </TableCell>
                <TableCell className="px-4 whitespace-nowrap">
                  {etiquetaTipoComprobante(factura.tipo_comprobante)}
                </TableCell>
                <TableCell className="px-4">
                  <Enlace href={rutaContacto(factura.contacto_id)}>{factura.cliente_nombre}</Enlace>
                </TableCell>
                <TableCell className="px-4">{formatoDia(factura.fecha)}</TableCell>
                <TableCell className={cn("px-4", vencida && "font-medium text-red-600 dark:text-red-400")}>
                  {formatoDia(factura.vencimiento)}
                </TableCell>
                <TableCell className="px-4 text-right">{formatoMoneda(factura.total)}</TableCell>
                <TableCell className="px-4 text-right">
                  {factura.estado === "anulada"
                    ? "—"
                    : formatoMoneda(saldoDeFactura(factura.total, factura.pagado, factura.credito, factura.retenido))}
                </TableCell>
                <TableCell className="px-4">
                  <EstadoPill estado={factura.estado} />
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
