import { redirect } from "next/navigation";

import { Enlace } from "@/components/enlace";
import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getPerfil } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { getDatosFormularioNota } from "@/lib/notas-credito/consultas";

import { NotaCreditoForm } from "./_components/nota-credito-form";

interface Props {
  searchParams: Promise<{ factura?: string }>;
}

export default async function Page({ searchParams }: Props) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const params = await searchParams;
  const datos = params.factura ? await getDatosFormularioNota(params.factura) : null;

  let contenido = (
    <Alert>
      <AlertDescription>
        Selecciona una factura para crear su nota de crédito desde{" "}
        <Enlace href="/dashboard/facturacion">Facturación</Enlace>.
      </AlertDescription>
    </Alert>
  );

  if (perfil.rol === "lector") {
    contenido = (
      <Alert variant="destructive">
        <AlertDescription>Tu rol es de solo lectura. No puedes crear notas de crédito.</AlertDescription>
      </Alert>
    );
  } else if (datos?.factura.estado === "anulada") {
    contenido = (
      <Alert variant="destructive">
        <AlertDescription>
          La factura #{datos.factura.numero} está anulada y no admite notas de crédito.
        </AlertDescription>
      </Alert>
    );
  } else if (datos?.lineas.every((linea) => linea.pendiente <= 0)) {
    contenido = (
      <Alert>
        <AlertDescription>
          La factura #{datos.factura.numero} no tiene líneas pendientes por acreditar.
        </AlertDescription>
      </Alert>
    );
  } else if (datos) {
    contenido = <NotaCreditoForm datos={datos} fechaHoy={hoyRD()} />;
  }

  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo="Nueva nota de crédito"
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Ingresos" },
          { etiqueta: "Notas de crédito", href: "/dashboard/notas-credito" },
          { etiqueta: "Nueva nota de crédito" },
        ]}
      />

      {contenido}
    </ContenedorFormulario>
  );
}
