import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { getDatosFormularioPago } from "@/lib/pagos/consultas";

import { PagoForm } from "./_components/pago-form";

interface Props {
  searchParams: Promise<{ factura?: string; cliente?: string }>;
}

export default async function Page({ searchParams }: Props) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const params = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/dashboard/pagos-recibidos" />}>
          <ArrowLeft />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-2xl tracking-tight">Nuevo pago recibido</h1>
      </div>

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes registrar pagos.</AlertDescription>
        </Alert>
      ) : (
        <PagoContenido facturaId={params.factura} clienteId={params.cliente} />
      )}
    </div>
  );
}

async function PagoContenido({ facturaId, clienteId }: { facturaId?: string; clienteId?: string }) {
  const datos = await getDatosFormularioPago();
  const factura = facturaId ? datos.facturas.find((item) => item.id === facturaId) : undefined;
  const cliente = factura?.contacto_id ?? clienteId ?? "";

  return (
    <PagoForm
      contactos={datos.contactos}
      facturas={datos.facturas}
      cuentas={datos.cuentas}
      initialCliente={datos.contactos.some((contacto) => contacto.id === cliente) ? cliente : ""}
      initialFactura={factura?.id ?? ""}
      fechaHoy={hoyRD()}
    />
  );
}
