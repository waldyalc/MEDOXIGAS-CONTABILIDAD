import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { aNumero } from "@/lib/compras/calculo";
import { cargarOpcionesPago, listarPagosProveedor } from "@/lib/compras/consultas";
import { formatoMoneda } from "@/lib/compras/formato";
import type { MetodoPago, PagoLista } from "@/lib/compras/tipos";
import { rutaCompra, rutaContacto, rutaCuenta, rutaPagoProveedor } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";

import { FormularioPago } from "../_components/formulario-pago";

const ETIQUETAS_METODO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
};

function CeldaProveedor({ pago }: { pago: PagoLista }) {
  if (!pago.contactos) return "—";

  return (
    <Link className="hover:underline" href={rutaContacto(pago.contacto_id)}>
      {pago.contactos.nombre}
    </Link>
  );
}

function CeldaCuenta({ pago }: { pago: PagoLista }) {
  if (!pago.cuentas) return "—";

  return (
    <Link className="hover:underline" href={rutaCuenta(pago.cuenta_id)}>
      {pago.cuentas.nombre}
    </Link>
  );
}

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const [pagos, opciones] = await Promise.all([listarPagosProveedor(), cargarOpcionesPago()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Pagos a proveedores</h1>
          <p className="text-muted-foreground text-sm">
            Registra pagos contra facturas abiertas y consulta el historial.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/dashboard/compras" prefetch={false} />}>
          <ArrowLeft data-icon="inline-start" />
          Compras
        </Button>
      </div>

      {rol !== "lector" ? <FormularioPago {...opciones} /> : null}

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Número</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="pr-(--card-spacing)">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground py-10 text-center">
                    No hay pagos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                pagos.map((pago) => (
                  <TableRow key={pago.id}>
                    <TableCell className="pl-(--card-spacing) font-medium">
                      <Link className="hover:underline" href={rutaPagoProveedor(pago.id)}>
                        #{pago.numero}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <CeldaProveedor pago={pago} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {pago.facturas_proveedor ? (
                        <Link
                          href={rutaCompra(pago.facturas_proveedor.id)}
                          prefetch={false}
                          className="hover:text-foreground hover:underline"
                        >
                          #{pago.facturas_proveedor.numero}
                          {pago.facturas_proveedor.ncf ? ` · ${pago.facturas_proveedor.ncf}` : ""}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{formatoDia(pago.fecha)}</TableCell>
                    <TableCell>{ETIQUETAS_METODO[pago.metodo]}</TableCell>
                    <TableCell>
                      <CeldaCuenta pago={pago} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(aNumero(pago.monto))}</TableCell>
                    <TableCell className="pr-(--card-spacing)">
                      <Badge variant={pago.estado === "anulado" ? "destructive" : "default"}>
                        {pago.estado === "anulado" ? "Anulado" : "Activo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
