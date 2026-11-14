import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto, rutaFactura } from "@/lib/enlaces";
import { etiquetaTipoComprobante } from "@/lib/facturacion/comprobantes";
import type { FacturaFila } from "@/lib/facturacion/consultas";
import { formatoMoneda, saldoDeFactura } from "@/lib/facturacion/formato";
import type { EstadoFactura } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";

const ETIQUETAS: Record<EstadoFactura, string> = {
  abierta: "Abierta",
  pagada: "Pagada",
  anulada: "Anulada",
};

function EstadoBadge({ estado }: { estado: EstadoFactura }) {
  if (estado === "anulada") return <Badge variant="destructive">{ETIQUETAS[estado]}</Badge>;
  if (estado === "pagada")
    return (
      <Badge
        variant="outline"
        className="border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
      >
        {ETIQUETAS[estado]}
      </Badge>
    );
  return <Badge>{ETIQUETAS[estado]}</Badge>;
}

export function FacturasTabla({ facturas }: { facturas: FacturaFila[] }) {
  return (
    <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>NCF</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Vencimiento</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Por cobrar</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {facturas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-muted-foreground py-10 text-center">
                No hay facturas todavía.
              </TableCell>
            </TableRow>
          ) : (
            facturas.map((factura) => (
              <TableRow key={factura.id}>
                <TableCell className="font-medium">
                  <Enlace href={rutaFactura(factura.id)}>{factura.numero}</Enlace>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {factura.ncf ? <Enlace href={rutaFactura(factura.id)}>{factura.ncf}</Enlace> : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap">{etiquetaTipoComprobante(factura.tipo_comprobante)}</TableCell>
                <TableCell>
                  <Enlace href={rutaContacto(factura.contacto_id)}>{factura.cliente_nombre}</Enlace>
                </TableCell>
                <TableCell>{formatoDia(factura.fecha)}</TableCell>
                <TableCell>{formatoDia(factura.vencimiento)}</TableCell>
                <TableCell className="text-right font-medium">{formatoMoneda(factura.total)}</TableCell>
                <TableCell className="text-right">
                  {factura.estado === "anulada"
                    ? "—"
                    : formatoMoneda(saldoDeFactura(factura.total, factura.pagado, factura.credito, factura.retenido))}
                </TableCell>
                <TableCell>
                  <EstadoBadge estado={factura.estado} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
