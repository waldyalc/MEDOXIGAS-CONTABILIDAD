import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { PagoForm } from "@/components/pagos/pago-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { registrarPagoMultifactura } from "@/lib/pagos/acciones";
import { getDatosFormularioPago } from "@/lib/pagos/consultas";

interface Props {
  searchParams: Promise<{ factura?: string; cliente?: string }>;
}

export default async function Page({ searchParams }: Props) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const params = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/dashboard/pagos-recibidos" />}>
          <ArrowLeft />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">Nuevo pago recibido</h1>
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
      tipo="recibido"
      empresa={datos.empresa}
      contactos={datos.contactos}
      facturas={datos.facturas}
      cuentas={datos.cuentas}
      cuentasMovimiento={datos.cuentasIngreso}
      centrosCosto={datos.centrosCosto}
      retenciones={datos.retenciones}
      siguienteNumero={datos.siguienteNumero}
      initialContacto={datos.contactos.some((contacto) => contacto.id === cliente) ? cliente : ""}
      initialFactura={factura?.id ?? ""}
      fechaHoy={hoyRD()}
      rutaCancelar="/dashboard/pagos-recibidos"
      accion={registrarPagoMultifactura}
    />
  );
}
