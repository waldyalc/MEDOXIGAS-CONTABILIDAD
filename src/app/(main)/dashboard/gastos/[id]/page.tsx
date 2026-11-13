import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft, BookOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getRol } from "@/lib/auth/rol";
import { rutaAsiento, rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";
import { obtenerGasto } from "@/lib/gastos/detalle";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const gasto = await obtenerGasto(id);
  if (!gasto) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/dashboard/gastos" prefetch={false} />}>
          <ArrowLeft data-icon="inline-start" />
          Gastos menores
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Gasto menor #{gasto.numero}</h1>
            <Badge variant={gasto.estado === "anulado" ? "destructive" : "default"}>
              {gasto.estado === "anulado" ? "Anulado" : "Activo"}
            </Badge>
          </div>
          {gasto.asiento_id ? (
            <Button variant="outline" render={<Link href={rutaAsiento(gasto.asiento_id)} prefetch={false} />}>
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
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">NCF</dt>
            <dd>{gasto.ncf ?? "—"}</dd>
            <dt className="text-muted-foreground">Fecha</dt>
            <dd>{formatoDia(gasto.fecha)}</dd>
            <dt className="text-muted-foreground">Descripción</dt>
            <dd className="whitespace-pre-line">{gasto.descripcion}</dd>
            <dt className="text-muted-foreground">Proveedor</dt>
            <dd>
              {gasto.contacto_id ? (
                <Link
                  href={rutaContacto(gasto.contacto_id)}
                  prefetch={false}
                  className="hover:text-foreground hover:underline"
                >
                  {gasto.contacto?.nombre ?? "—"}
                </Link>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-muted-foreground">Cuenta de gasto</dt>
            <dd>
              <Link
                href={rutaCuenta(gasto.cuenta_gasto_id)}
                prefetch={false}
                className="hover:text-foreground hover:underline"
              >
                {gasto.cuenta_gasto ? `${gasto.cuenta_gasto.codigo} · ${gasto.cuenta_gasto.nombre}` : "—"}
              </Link>
            </dd>
            <dt className="text-muted-foreground">Cuenta de pago</dt>
            <dd>
              <Link
                href={rutaCuenta(gasto.cuenta_pago_id)}
                prefetch={false}
                className="hover:text-foreground hover:underline"
              >
                {gasto.cuenta_pago ? `${gasto.cuenta_pago.codigo} · ${gasto.cuenta_pago.nombre}` : "—"}
              </Link>
            </dd>
          </dl>
          <div className="flex flex-col gap-2 rounded-lg border p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatoMoneda(gasto.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">ITBIS</span>
              <span className="tabular-nums">{formatoMoneda(gasto.itbis)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatoMoneda(gasto.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
