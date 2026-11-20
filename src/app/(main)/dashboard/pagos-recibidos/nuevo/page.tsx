import { redirect } from "next/navigation";

import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { PagoForm } from "@/components/pagos/pago-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getPerfil } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { registrarPagoMultifactura } from "@/lib/pagos/acciones";
import { getDatosFormularioPago, getFacturaPago } from "@/lib/pagos/consultas";

interface Props {
  searchParams: Promise<{ factura?: string; cliente?: string; cuenta?: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({ searchParams }: Props) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const params = await searchParams;

  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo="Nuevo pago recibido"
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Ingresos" },
          { etiqueta: "Pagos recibidos", href: "/dashboard/pagos-recibidos" },
          { etiqueta: "Nuevo pago recibido" },
        ]}
      />

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes registrar pagos.</AlertDescription>
        </Alert>
      ) : (
        <PagoContenido facturaId={params.factura} clienteId={params.cliente} cuentaId={params.cuenta} />
      )}
    </ContenedorFormulario>
  );
}

async function PagoContenido({
  facturaId,
  clienteId,
  cuentaId,
}: {
  facturaId?: string;
  clienteId?: string;
  cuentaId?: string;
}) {
  const datos = await getDatosFormularioPago();
  const factura = facturaId ? await getFacturaPago(facturaId, "recibido") : null;
  const candidato = factura?.contacto_id ?? clienteId ?? "";
  const cliente = UUID.test(candidato) ? candidato : "";
  const cuenta = cuentaId != null && UUID.test(cuentaId) ? cuentaId : "";

  return (
    <PagoForm
      tipo="recibido"
      empresa={datos.empresa}
      contactos={datos.contactos}
      cuentas={datos.cuentas}
      cuentasMovimiento={datos.cuentasIngreso}
      centrosCosto={datos.centrosCosto}
      retenciones={datos.retenciones}
      siguienteNumero={datos.siguienteNumero}
      initialContacto={cliente}
      initialCuenta={cuenta}
      facturaInicial={factura}
      fechaHoy={hoyRD()}
      rutaCancelar="/dashboard/pagos-recibidos"
      accion={registrarPagoMultifactura}
    />
  );
}
