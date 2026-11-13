import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft, BookOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRol } from "@/lib/auth/rol";
import { obtenerPagoProveedor } from "@/lib/compras/detalle";
import type { MetodoPago } from "@/lib/compras/tipos";
import { rutaAsiento, rutaCompra, rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";

const ETIQUETAS_METODO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const pago = await obtenerPagoProveedor(id);
  if (!pago) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/compras/pagos" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Pagos a proveedores
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Pago a proveedor #{pago.numero}</h1>
            <Badge variant={pago.estado === "anulado" ? "destructive" : "default"}>
              {pago.estado === "anulado" ? "Anulado" : "Activo"}
            </Badge>
          </div>
          {pago.asiento_id ? (
            <Button variant="outline" render={<Link href={rutaAsiento(pago.asiento_id)} prefetch={false} />}>
              <BookOpen data-icon="inline-start" />
              Ver asiento
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Fecha</dt>
            <dd>{formatoDia(pago.fecha)}</dd>
            <dt className="text-muted-foreground">Monto</dt>
            <dd className="font-medium tabular-nums">{formatoMoneda(pago.monto)}</dd>
            <dt className="text-muted-foreground">Método</dt>
            <dd>{ETIQUETAS_METODO[pago.metodo]}</dd>
            <dt className="text-muted-foreground">Proveedor</dt>
            <dd>
              <Link
                href={rutaContacto(pago.contacto_id)}
                prefetch={false}
                className="hover:text-foreground hover:underline"
              >
                {pago.contacto?.nombre ?? "—"}
              </Link>
            </dd>
            <dt className="text-muted-foreground">Factura</dt>
            <dd>
              {pago.factura ? (
                <Link
                  href={rutaCompra(pago.factura_proveedor_id)}
                  prefetch={false}
                  className="hover:text-foreground hover:underline"
                >
                  {`#${pago.factura.numero}${pago.factura.ncf ? ` · ${pago.factura.ncf}` : ""}`}
                </Link>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-muted-foreground">Cuenta</dt>
            <dd>
              <Link
                href={rutaCuenta(pago.cuenta_id)}
                prefetch={false}
                className="hover:text-foreground hover:underline"
              >
                {pago.cuenta ? `${pago.cuenta.codigo} · ${pago.cuenta.nombre}` : "—"}
              </Link>
            </dd>
            <dt className="text-muted-foreground">Notas</dt>
            <dd className="whitespace-pre-line">{pago.notas ?? "—"}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
