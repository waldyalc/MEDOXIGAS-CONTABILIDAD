import { redirect } from "next/navigation";

import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getPerfil } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { getImpuestosActivos } from "@/lib/impuestos/consultas";
import { getDatosFormularioNotaDebito, getFacturaParaNotaDebito } from "@/lib/notas-debito/consultas";

import { NotaDebitoForm } from "./_components/nota-debito-form";

interface Props {
  searchParams: Promise<{ factura?: string }>;
}

export default async function Page({ searchParams }: Props) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const params = await searchParams;
  const [datos, facturaInicial, impuestos] = await Promise.all([
    getDatosFormularioNotaDebito(),
    params.factura ? getFacturaParaNotaDebito(params.factura) : Promise.resolve(null),
    getImpuestosActivos(),
  ]);

  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo="Nueva nota de débito"
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Ingresos" },
          { etiqueta: "Notas de débito", href: "/dashboard/notas-debito" },
          { etiqueta: "Nueva nota de débito" },
        ]}
      />

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear notas de débito.</AlertDescription>
        </Alert>
      ) : (
        <NotaDebitoForm datos={datos} impuestos={impuestos} fechaHoy={hoyRD()} facturaInicial={facturaInicial} />
      )}
    </ContenedorFormulario>
  );
}
