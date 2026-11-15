import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { PagoForm } from "@/components/pagos/pago-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { registrarPagoProveedorMultiple } from "@/lib/compras/acciones";
import { cargarOpcionesPago } from "@/lib/compras/consultas";
import { hoyRD } from "@/lib/facturacion/formato";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/dashboard/compras/pagos" />}>
          <ArrowLeft />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">Nuevo pago a proveedor</h1>
      </div>

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes registrar pagos.</AlertDescription>
        </Alert>
      ) : (
        <PagoProveedorContenido />
      )}
    </div>
  );
}

async function PagoProveedorContenido() {
  const datos = await cargarOpcionesPago();

  return (
    <PagoForm
      tipo="proveedor"
      empresa={datos.empresa}
      contactos={datos.contactos}
      cuentas={datos.cuentasCajaBanco}
      cuentasMovimiento={datos.cuentasGasto}
      centrosCosto={datos.centrosCosto}
      retenciones={datos.retenciones}
      siguienteNumero={datos.siguienteNumero}
      fechaHoy={hoyRD()}
      rutaCancelar="/dashboard/compras/pagos"
      accion={registrarPagoProveedorMultiple}
    />
  );
}
