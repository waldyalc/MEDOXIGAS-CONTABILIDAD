import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowLeft, ReceiptText, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRol } from "@/lib/auth/rol";
import { obtenerFichaProducto } from "@/lib/productos/ficha-consultas";

import { DatosProducto } from "./_components/datos-producto";
import { FichaTabs } from "./_components/ficha-tabs";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [rol, ficha] = await Promise.all([getRol(), obtenerFichaProducto(id)]);
  if (rol == null) redirect("/unauthorized");
  if (!ficha) notFound();

  const { producto, facturasVenta, facturasCompra, cotizaciones, conduces, kardex } = ficha;
  const puedeEscribir = rol !== "lector";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={<Link href="/dashboard/productos" prefetch={false} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Productos
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{producto.nombre}</h1>
            <Badge variant="outline">{producto.tipo === "servicio" ? "Servicio" : "Producto"}</Badge>
          </div>
          {puedeEscribir ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                render={
                  <Link
                    href={`/dashboard/facturacion/nueva?producto=${encodeURIComponent(producto.id)}`}
                    prefetch={false}
                  />
                }
              >
                <ReceiptText data-icon="inline-start" />
                Facturar este producto
              </Button>
              <Button
                variant="outline"
                render={
                  <Link
                    href={`/dashboard/compras/nueva?producto=${encodeURIComponent(producto.id)}`}
                    prefetch={false}
                  />
                }
              >
                <ShoppingCart data-icon="inline-start" />
                Comprar este producto
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <DatosProducto ficha={ficha} />

      <FichaTabs
        facturasVenta={facturasVenta}
        facturasCompra={facturasCompra}
        cotizaciones={cotizaciones}
        conduces={conduces}
        kardex={kardex}
      />
    </div>
  );
}
