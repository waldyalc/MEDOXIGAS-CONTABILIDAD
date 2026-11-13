import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { DocumentoVentaForm } from "@/components/documento-venta/documento-venta-form";
import { conContactoActual, prellenarDocumento } from "@/components/documento-venta/prellenado";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { crearFactura } from "@/lib/facturacion/acciones";
import {
  getContactosClientes,
  getCuentasCajaBanco,
  getEmpresa,
  getFacturaVista,
  getProductosActivos,
} from "@/lib/facturacion/consultas";
import { hoyRD } from "@/lib/facturacion/formato";

export default async function Page({ searchParams }: { searchParams: Promise<{ clonar?: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { clonar } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" render={<Link href="/dashboard/facturacion" />}>
          <ArrowLeft />
          <span className="sr-only">Volver</span>
        </Button>
        <h1 className="text-2xl tracking-tight">Nueva factura</h1>
      </div>

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear facturas.</AlertDescription>
        </Alert>
      ) : (
        <FacturaContenido clonar={clonar} />
      )}
    </div>
  );
}

async function FacturaContenido({ clonar }: { clonar?: string }) {
  const [empresa, contactos, productos, cuentas, vista] = await Promise.all([
    getEmpresa(),
    getContactosClientes(),
    getProductosActivos(),
    getCuentasCajaBanco(),
    clonar ? getFacturaVista(clonar) : Promise.resolve(null),
  ]);

  const hoy = hoyRD();
  const contactosFormulario = vista ? conContactoActual(contactos, vista.contacto) : contactos;

  return (
    <DocumentoVentaForm
      empresa={empresa}
      contactos={contactosFormulario}
      productos={productos}
      cuentas={cuentas}
      fechaHoy={hoy}
      titulo="Información de la factura"
      etiquetaNumero="NCF"
      conComprobante
      conPago
      conTerminos
      conPie
      textoGuardar="Guardar factura"
      rutaCancelar="/dashboard/facturacion"
      rutaDestino="/dashboard/facturacion"
      accion={crearFactura}
      {...(vista ? { valoresIniciales: prellenarDocumento({ ...vista.factura, lineas: vista.lineas }, hoy) } : {})}
    />
  );
}
