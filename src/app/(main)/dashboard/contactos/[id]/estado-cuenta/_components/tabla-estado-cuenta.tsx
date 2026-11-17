import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { etiquetaTramo, type FilaEstadoCuenta, type TotalesEstadoCuenta } from "@/lib/contactos/estado-cuenta";
import { rutaFactura } from "@/lib/enlaces";
import { formatoMonedaCentavos } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";

export function TablaEstadoCuenta({
  filas,
  totales,
}: {
  readonly filas: FilaEstadoCuenta[];
  readonly totales: TotalesEstadoCuenta;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Documento</TableHead>
          <TableHead>Creación</TableHead>
          <TableHead>Vencimiento</TableHead>
          <TableHead>Antigüedad</TableHead>
          <TableHead className="text-right">Días vencidos</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Cobrado</TableHead>
          <TableHead className="text-right">Saldo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} className="text-muted-foreground py-10 text-center">
              No hay documentos para los filtros seleccionados.
            </TableCell>
          </TableRow>
        ) : (
          filas.map((fila) => (
            <TableRow key={fila.id}>
              <TableCell className="font-medium">
                <Enlace href={rutaFactura(fila.id)} aria-label={fila.ncf ? `Ver factura ${fila.ncf}` : "Ver factura"}>
                  {fila.ncf ?? "—"}
                </Enlace>
              </TableCell>
              <TableCell>{formatoDia(fila.fecha)}</TableCell>
              <TableCell>{formatoDia(fila.vencimiento)}</TableCell>
              <TableCell>{etiquetaTramo(fila.tramo)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {fila.diasVencidos > 0 ? (
                  <span className="text-destructive">{fila.diasVencidos}</span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell>
                {fila.pagada ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                  >
                    Pagada
                  </Badge>
                ) : (
                  <Badge variant="secondary">Pendiente</Badge>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatoMonedaCentavos(fila.totalCentavos)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatoMonedaCentavos(fila.cobradoCentavos)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatoMonedaCentavos(fila.saldoCentavos)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={6}>Totales</TableCell>
          <TableCell className="text-right tabular-nums">{formatoMonedaCentavos(totales.ventas)}</TableCell>
          <TableCell className="text-right tabular-nums">{formatoMonedaCentavos(totales.cobrado)}</TableCell>
          <TableCell className="text-right tabular-nums">{formatoMonedaCentavos(totales.porCobrar)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
