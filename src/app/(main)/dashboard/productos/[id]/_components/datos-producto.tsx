import type { ReactNode } from "react";

import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { rutaCuenta } from "@/lib/enlaces";
import { type CuentaResumen, type FichaProducto, precioConItbis } from "@/lib/productos/ficha";
import { etiquetaTasaItbis, formatoCantidad, formatoMoneda } from "@/lib/productos/productos";

function Dato({ etiqueta, children }: { readonly etiqueta: string; readonly children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd>{children}</dd>
    </>
  );
}

function CuentaDato({ etiqueta, cuenta }: { readonly etiqueta: string; readonly cuenta: CuentaResumen | null }) {
  return (
    <Dato etiqueta={etiqueta}>
      {cuenta ? (
        <Link href={rutaCuenta(cuenta.id)} className="hover:underline">
          {cuenta.codigo} · {cuenta.nombre}
        </Link>
      ) : (
        "—"
      )}
    </Dato>
  );
}

export function DatosProducto({ ficha }: { readonly ficha: FichaProducto }) {
  const { producto, cuentas, kardex } = ficha;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
          <Dato etiqueta="Referencia">{producto.referencia?.trim() || "—"}</Dato>
          <Dato etiqueta="Tipo">{producto.tipo === "servicio" ? "Servicio" : "Producto"}</Dato>
          <Dato etiqueta="Inventariable">{producto.inventariable ? "Sí" : "No"}</Dato>
          <Dato etiqueta="Precio sin ITBIS">{formatoMoneda(producto.precio)}</Dato>
          <Dato etiqueta="ITBIS">{etiquetaTasaItbis(producto.itbis_tasa)}</Dato>
          <Dato etiqueta="Precio con ITBIS">{formatoMoneda(precioConItbis(producto.precio, producto.itbis_tasa))}</Dato>
          <Dato etiqueta="Costo">{formatoMoneda(producto.costo)}</Dato>
        </dl>

        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
          <Dato etiqueta="Existencia inicial">{formatoCantidad(kardex.existenciaInicial)}</Dato>
          <Dato etiqueta="Existencia actual">{formatoCantidad(producto.cantidad)}</Dato>
          <Dato etiqueta="Existencia mínima">—</Dato>
        </dl>

        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
          <CuentaDato etiqueta="Cuenta de ingreso" cuenta={cuentas.ingreso} />
          <CuentaDato etiqueta="Cuenta de inventario" cuenta={cuentas.inventario} />
          <CuentaDato etiqueta="Cuenta de costo" cuenta={cuentas.costo} />
        </dl>
      </CardContent>
    </Card>
  );
}
