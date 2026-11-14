import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { DocumentoVentaForm } from "@/components/documento-venta/documento-venta-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/lib/auth/rol";
import { getCentrosCostoActivos } from "@/lib/centros-costo/consultas";
import { crearFactura } from "@/lib/facturacion/acciones";
import {
  getContactosClientes,
  getCuentasCajaBanco,
  getEmpresa,
  getListasPrecios,
  getProductosActivos,
} from "@/lib/facturacion/consultas";
import { hoyRD } from "@/lib/facturacion/formato";
import { getImpuestosActivos } from "@/lib/impuestos/consultas";
import { listarAlmacenesActivos } from "@/lib/inventario/consultas";
import { getPlantillaImpresion } from "@/lib/plantillas-impresion/consultas";
import { getVendedoresActivos } from "@/lib/vendedores/consultas";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

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
        <FacturaContenido />
      )}
    </div>
  );
}

async function FacturaContenido() {
  const [
    empresa,
    contactos,
    productos,
    cuentas,
    vendedores,
    centrosCosto,
    plantilla,
    listasPrecios,
    almacenes,
    impuestos,
  ] = await Promise.all([
    getEmpresa(),
    getContactosClientes(),
    getProductosActivos(),
    getCuentasCajaBanco(),
    getVendedoresActivos(),
    getCentrosCostoActivos(),
    getPlantillaImpresion("factura"),
    getListasPrecios(),
    listarAlmacenesActivos(),
    getImpuestosActivos(),
  ]);

  return (
    <DocumentoVentaForm
      empresa={empresa}
      contactos={contactos}
      productos={productos}
      cuentas={cuentas}
      vendedores={vendedores}
      centrosCosto={centrosCosto}
      notasIniciales={plantilla.notas}
      terminosIniciales={plantilla.terminos}
      mostrarLogo={plantilla.mostrarLogo}
      listasPrecios={listasPrecios}
      almacenes={almacenes}
      impuestos={impuestos}
      fechaHoy={hoyRD()}
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
    />
  );
}
