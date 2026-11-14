import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { getImpuestosConfig } from "@/lib/impuestos/consultas";
import type { TipoImpuesto } from "@/lib/impuestos/tipos";

import { EncabezadoConfiguracion } from "../_components/encabezado";

const GRUPOS: Record<TipoImpuesto, string> = {
  ninguno: "Ninguno",
  itbis: "ITBIS",
  otro: "Otro",
  propina: "Propina legal",
  exento: "Exento (E)",
};

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const impuestos = await getImpuestosConfig();

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoConfiguracion
        titulo="Impuestos"
        descripcion="Catálogo de impuestos que se usan en productos, compras y facturas."
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead>Impuesto</TableHead>
              <TableHead className="text-right">Tasa</TableHead>
              <TableHead>Cuenta por pagar</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {impuestos.map((impuesto) => (
              <TableRow key={impuesto.id}>
                <TableCell className="text-muted-foreground">{GRUPOS[impuesto.tipo]}</TableCell>
                <TableCell className="font-medium">{impuesto.nombre}</TableCell>
                <TableCell className="text-right tabular-nums">{impuesto.tarifa.toFixed(2)} %</TableCell>
                <TableCell className="text-muted-foreground">
                  {impuesto.cuenta_codigo
                    ? `${impuesto.cuenta_codigo} — ${impuesto.cuenta_nombre ?? ""}`
                    : "Sin cuenta"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{impuesto.activo ? "Activo" : "Inactivo"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
