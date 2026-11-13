import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto, rutaFactura, rutaNotaCreditoVenta } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import type { NotaCreditoLista } from "@/lib/notas-credito/tipos";

function EstadoBadge({ estado }: { estado: NotaCreditoLista["estado"] }) {
  if (estado === "anulada") return <Badge variant="destructive">Anulada</Badge>;
  return <Badge variant="secondary">Activa</Badge>;
}

export function NotasCreditoTabla({ notas }: { notas: NotaCreditoLista[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl tracking-tight">Notas de crédito</h1>
        <p className="text-muted-foreground text-sm">Devoluciones y créditos sobre facturas de venta (NCF B04).</p>
      </div>

      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>NCF</TableHead>
              <TableHead>Factura</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                  No hay notas de crédito todavía.
                </TableCell>
              </TableRow>
            ) : (
              notas.map((nota) => (
                <TableRow key={nota.id}>
                  <TableCell className="font-medium">
                    <Enlace href={rutaNotaCreditoVenta(nota.id)}>{nota.numero}</Enlace>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{nota.ncf}</TableCell>
                  <TableCell>
                    <Enlace href={rutaFactura(nota.factura_id)}>
                      #{nota.factura_numero}
                      {nota.factura_ncf ? ` · ${nota.factura_ncf}` : ""}
                    </Enlace>
                  </TableCell>
                  <TableCell>
                    <Enlace href={rutaContacto(nota.contacto_id)}>{nota.cliente_nombre}</Enlace>
                  </TableCell>
                  <TableCell>{formatoDia(nota.fecha)}</TableCell>
                  <TableCell className="text-right font-medium">{formatoMoneda(nota.total)}</TableCell>
                  <TableCell>
                    <EstadoBadge estado={nota.estado} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
