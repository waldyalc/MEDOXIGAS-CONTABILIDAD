import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { aNumero } from "@/lib/compras/calculo";
import { listarFacturasProveedor } from "@/lib/compras/consultas";
import { formatoMoneda } from "@/lib/compras/formato";
import { rutaCompra, rutaContacto } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";

import { EstadoBadge } from "./_components/estado-badge";

export default async function Page() {
  const [rol, facturas] = await Promise.all([getRol(), listarFacturasProveedor()]);
  if (rol == null) redirect("/unauthorized");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Compras</h1>
          <p className="text-muted-foreground text-sm">Facturas de proveedores, cuentas por pagar y sus pagos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/dashboard/compras/pagos" prefetch={false} />}>
            Pagos a proveedores
          </Button>
          {rol !== "lector" ? (
            <Button render={<Link href="/dashboard/compras/nueva" prefetch={false} />}>
              <Plus data-icon="inline-start" />
              Nueva factura de proveedor
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Número</TableHead>
                <TableHead>No. / NCF</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Por pagar</TableHead>
                <TableHead className="pr-(--card-spacing)">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facturas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground py-10 text-center">
                    No hay facturas de proveedor registradas.
                  </TableCell>
                </TableRow>
              ) : (
                facturas.map((factura) => {
                  const total = aNumero(factura.total);
                  const pagado = aNumero(factura.pagado);

                  return (
                    <TableRow key={factura.id}>
                      <TableCell className="pl-(--card-spacing) font-medium">
                        <Enlace href={rutaCompra(factura.id)}>#{factura.numero}</Enlace>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{factura.ncf || "—"}</TableCell>
                      <TableCell>
                        {factura.contactos ? (
                          <Enlace href={rutaContacto(factura.contacto_id)}>{factura.contactos.nombre}</Enlace>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{formatoDia(factura.fecha)}</TableCell>
                      <TableCell>{formatoDia(factura.vencimiento)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatoMoneda(total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatoMoneda(pagado)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatoMoneda(total - pagado)}</TableCell>
                      <TableCell className="pr-(--card-spacing)">
                        <EstadoBadge estado={factura.estado} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
