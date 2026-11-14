import { Suspense } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { Plus } from "lucide-react";

import { EsqueletoTabla } from "@/components/carga/esqueletos";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getRol } from "@/lib/auth/rol";
import { getFacturasLista } from "@/lib/facturacion/consultas";

import { FacturasTabla } from "./_components/facturas-tabla";

async function AccionNuevaFactura() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");
  if (rol === "lector") return null;

  return (
    <Button render={<Link href="/dashboard/facturacion/nueva" />}>
      <Plus />
      Nueva factura
    </Button>
  );
}

async function TablaFacturas() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  const facturas = await getFacturasLista();

  return <FacturasTabla facturas={facturas} />;
}

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Facturación</h1>
          <p className="text-muted-foreground text-sm">Facturas de venta con comprobante fiscal (NCF).</p>
        </div>
        <Suspense fallback={<Skeleton className="h-9 w-36" />}>
          <AccionNuevaFactura />
        </Suspense>
      </div>

      <Suspense fallback={<EsqueletoTabla filas={8} columnas={9} />}>
        <TablaFacturas />
      </Suspense>
    </div>
  );
}
