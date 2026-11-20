import { redirect } from "next/navigation";

import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { PagoForm } from "@/components/pagos/pago-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getPerfil } from "@/lib/auth/rol";
import { registrarPagoProveedorMultiple } from "@/lib/compras/acciones";
import { cargarOpcionesPago } from "@/lib/compras/consultas";
import { hoyRD } from "@/lib/facturacion/formato";

interface Props {
  searchParams: Promise<{ cuenta?: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({ searchParams }: Props) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const params = await searchParams;

  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo="Nuevo pago a proveedor"
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Compras", href: "/dashboard/compras" },
          { etiqueta: "Pagos a proveedores", href: "/dashboard/compras/pagos" },
          { etiqueta: "Nuevo pago a proveedor" },
        ]}
      />

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes registrar pagos.</AlertDescription>
        </Alert>
      ) : (
        <PagoProveedorContenido cuentaId={params.cuenta} />
      )}
    </ContenedorFormulario>
  );
}

async function PagoProveedorContenido({ cuentaId }: { cuentaId?: string }) {
  const datos = await cargarOpcionesPago();
  const cuenta = cuentaId != null && UUID.test(cuentaId) ? cuentaId : "";

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
      initialCuenta={cuenta}
      fechaHoy={hoyRD()}
      rutaCancelar="/dashboard/compras/pagos"
      accion={registrarPagoProveedorMultiple}
    />
  );
}
