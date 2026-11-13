import { redirect } from "next/navigation";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { IMPUESTOS_ITBIS } from "@/lib/configuracion/impuestos";
import { formatoPct } from "@/lib/formato";

import { EncabezadoConfiguracion } from "../_components/encabezado";

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoConfiguracion
        titulo="Impuestos"
        descripcion="Tasas de ITBIS que se usan en productos, compras y facturas. Por ahora esta lista es informativa."
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Impuesto</TableHead>
              <TableHead className="text-right">Tasa</TableHead>
              <TableHead>Uso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {IMPUESTOS_ITBIS.map((impuesto) => (
              <TableRow key={impuesto.clave}>
                <TableCell className="font-medium">{impuesto.nombre}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {impuesto.tasa == null ? "—" : formatoPct(impuesto.tasa)}
                </TableCell>
                <TableCell className="text-muted-foreground">{impuesto.descripcion}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
