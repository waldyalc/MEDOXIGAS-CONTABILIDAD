import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { getRol } from "@/lib/auth/rol";
import { getMonedasConTasas } from "@/lib/monedas/consultas";

import { EncabezadoConfiguracion } from "../_components/encabezado";
import { MonedasCliente } from "./_components/monedas-cliente";

export default async function Page() {
  const [rol, datos] = await Promise.all([getRol(), getMonedasConTasas()]);
  if (rol == null) redirect("/unauthorized");

  return (
    <ContenedorLista>
      <EncabezadoConfiguracion
        titulo="Monedas"
        descripcion="Moneda base y tasas de cambio por fecha. Los documentos siguen emitiéndose en DOP."
      />
      <MonedasCliente monedas={datos.monedas} tasas={datos.tasas} puedeEditar={rol === "admin" || rol === "contador"} />
    </ContenedorLista>
  );
}
