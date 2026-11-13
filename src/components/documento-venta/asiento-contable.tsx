import { Enlace } from "@/components/enlace";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaCuenta } from "@/lib/enlaces";
import { valorACentavos } from "@/lib/facturacion/calculo";
import { formatoMoneda } from "@/lib/facturacion/formato";
import type { AsientoVista } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";

export function AsientoContable({ asiento }: { asiento: AsientoVista }) {
  if (!asiento.asiento) {
    return <p className="text-muted-foreground text-sm">Esta factura no tiene asiento contable.</p>;
  }

  const debito = asiento.lineas.reduce((total, linea) => total + valorACentavos(linea.debito), 0);
  const credito = asiento.lineas.reduce((total, linea) => total + valorACentavos(linea.credito), 0);
  const cuadrado = debito === credito;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Asiento #{asiento.asiento.numero} · {formatoDia(asiento.asiento.fecha)} · {asiento.asiento.descripcion}
      </p>

      <div className="border-border overflow-hidden rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-10 px-4 text-xs">Cuenta</TableHead>
              <TableHead className="h-10 px-4 text-xs">Descripción</TableHead>
              <TableHead className="h-10 px-4 text-right text-xs">Débito</TableHead>
              <TableHead className="h-10 px-4 text-right text-xs">Crédito</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {asiento.lineas.map((linea) => (
              <TableRow key={linea.id}>
                <TableCell className="h-12 px-4 text-sm">
                  <Enlace href={rutaCuenta(linea.cuenta_id)}>
                    <span className="font-mono text-xs">{linea.codigo}</span> {linea.nombre}
                  </Enlace>
                </TableCell>
                <TableCell className="text-muted-foreground h-12 px-4 text-sm">{linea.descripcion}</TableCell>
                <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                  {linea.debito > 0 ? formatoMoneda(linea.debito) : "—"}
                </TableCell>
                <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                  {linea.credito > 0 ? formatoMoneda(linea.credito) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="h-12 px-4 text-sm font-semibold" colSpan={2}>
                Totales · {cuadrado ? "Cuadrado ✓" : "Descuadrado"}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm font-semibold tabular-nums">
                {formatoMoneda(debito / 100)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm font-semibold tabular-nums">
                {formatoMoneda(credito / 100)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
