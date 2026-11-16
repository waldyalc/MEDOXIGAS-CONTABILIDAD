import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto, rutaCuenta, rutaGasto } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import type { GastoLista } from "@/lib/gastos/tipos";

export function GastosTabla({ gastos, busqueda }: { gastos: GastoLista[]; busqueda?: string }) {
  return (
    <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>Comprobante</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Cuenta</TableHead>
            <TableHead>Pagado desde</TableHead>
            <TableHead className="text-right">Subtotal</TableHead>
            <TableHead className="text-right">ITBIS</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {gastos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-muted-foreground py-10 text-center">
                {busqueda ? "No se encontraron gastos con esa búsqueda." : "No hay gastos registrados todavía."}
              </TableCell>
            </TableRow>
          ) : (
            gastos.map((gasto) => (
              <TableRow key={gasto.id}>
                <TableCell className="font-medium">
                  <Enlace href={rutaGasto(gasto.id)}>{gasto.numero}</Enlace>
                </TableCell>
                <TableCell className="text-muted-foreground">{gasto.ncf || "—"}</TableCell>
                <TableCell>{formatoDia(gasto.fecha)}</TableCell>
                <TableCell>{gasto.descripcion}</TableCell>
                <TableCell>
                  {gasto.contacto_id ? (
                    <Enlace href={rutaContacto(gasto.contacto_id)}>{gasto.proveedor_nombre}</Enlace>
                  ) : (
                    gasto.proveedor_nombre
                  )}
                </TableCell>
                <TableCell>
                  <Enlace href={rutaCuenta(gasto.cuenta_gasto_id)}>{gasto.cuenta_nombre}</Enlace>
                </TableCell>
                <TableCell>
                  <Enlace href={rutaCuenta(gasto.cuenta_pago_id)}>{gasto.cuenta_pago_nombre}</Enlace>
                </TableCell>
                <TableCell className="text-right">{formatoMoneda(gasto.subtotal)}</TableCell>
                <TableCell className="text-right">{formatoMoneda(gasto.itbis)}</TableCell>
                <TableCell className="text-right font-medium">{formatoMoneda(gasto.total)}</TableCell>
                <TableCell>
                  {gasto.estado === "anulado" ? (
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
    </div>
  );
}
