import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto, rutaFactura, rutaNotaDebitoVenta } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import type { NotaDebitoLista } from "@/lib/notas-debito/tipos";

function EstadoBadge({ estado }: { estado: NotaDebitoLista["estado"] }) {
  if (estado === "anulada") return <Badge variant="destructive">Anulada</Badge>;
  return <Badge variant="secondary">Activa</Badge>;
}

export function NotasDebitoTabla({ notas, busqueda }: { notas: NotaDebitoLista[]; busqueda?: string }) {
  return (
    <Card>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 pl-(--card-spacing)">#</TableHead>
              <TableHead>NCF</TableHead>
              <TableHead>Factura</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="pr-(--card-spacing)">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground py-10 text-center">
                  {busqueda ? "No se encontraron notas con esa búsqueda." : "No hay notas de débito todavía."}
                </TableCell>
              </TableRow>
            ) : (
              notas.map((nota) => (
                <TableRow key={nota.id}>
                  <TableCell className="pl-(--card-spacing) font-medium">
                    <Enlace href={rutaNotaDebitoVenta(nota.id)}>{nota.numero}</Enlace>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <Enlace href={rutaNotaDebitoVenta(nota.id)}>{nota.ncf}</Enlace>
                  </TableCell>
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
                  <TableCell>{nota.tipo === "texto" ? "Texto" : "Montos"}</TableCell>
                  <TableCell className="text-right font-medium">{formatoMoneda(nota.total)}</TableCell>
                  <TableCell className="pr-(--card-spacing)">
                    <EstadoBadge estado={nota.estado} />
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
