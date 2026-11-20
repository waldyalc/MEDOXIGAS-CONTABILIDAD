import { redirect } from "next/navigation";

import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { getRol } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { datosFormularioTransferencia } from "@/lib/inventario/consultas";

import { TransferenciaForm } from "./_components/transferencia-form";

export default async function Page() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");
  if (rol === "lector") redirect("/dashboard/inventario/transferencias");

  const datos = await datosFormularioTransferencia();

  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo="Nueva transferencia"
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Inventario" },
          { etiqueta: "Transferencias", href: "/dashboard/inventario/transferencias" },
          { etiqueta: "Nueva transferencia" },
        ]}
      />

      <TransferenciaForm {...datos} fechaHoy={hoyRD()} />
    </ContenedorFormulario>
  );
}
