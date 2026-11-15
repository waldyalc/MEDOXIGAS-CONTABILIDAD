import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto, rutaFactura, rutaPagoRecibido } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import type { PagoLista } from "@/lib/pagos/tipos";

const METODOS: Record<PagoLista["metodo"], string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
};

function CeldaFactura({ pago }: { pago: PagoLista }) {
  if (pago.aplicaciones > 1) {
    return <span className="text-muted-foreground">Varias facturas ({pago.aplicaciones})</span>;
  }

  if (pago.factura_id) {
    return (
      <Enlace href={rutaFactura(pago.factura_id)}>
        #{pago.factura_numero} {pago.factura_ncf ? `· ${pago.factura_ncf}` : ""}
      </Enlace>
    );
  }

  return "—";
}

export function PagosTabla({ pagos, busqueda }: { pagos: PagoLista[]; busqueda?: string }) {
  return (
    <Card>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 pl-(--card-spacing)">#</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Factura</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="pr-(--card-spacing)">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-10 text-center">
                  {busqueda ? "No se encontraron pagos con esa búsqueda." : "No hay pagos registrados todavía."}
                </TableCell>
              </TableRow>
            ) : (
              pagos.map((pago) => (
                <TableRow key={pago.id}>
                  <TableCell className="pl-(--card-spacing) font-medium">
                    <Enlace href={rutaPagoRecibido(pago.id)}>{pago.numero}</Enlace>
                  </TableCell>
                  <TableCell>{formatoDia(pago.fecha)}</TableCell>
                  <TableCell>
                    <Enlace href={rutaContacto(pago.contacto_id)}>{pago.cliente_nombre}</Enlace>
                  </TableCell>
                  <TableCell>
                    <CeldaFactura pago={pago} />
                  </TableCell>
                  <TableCell>{METODOS[pago.metodo]}</TableCell>
                  <TableCell className="text-right font-medium">{formatoMoneda(pago.monto)}</TableCell>
                  <TableCell className="pr-(--card-spacing)">
                    {pago.estado === "anulado" ? (
                      <Badge variant="destructive">Anulado</Badge>
                    ) : (
                      <Badge variant="secondary">Activo</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
