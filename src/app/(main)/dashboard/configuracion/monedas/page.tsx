import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { getMonedasConTasas } from "@/lib/monedas/consultas";

import { EncabezadoConfiguracion } from "../_components/encabezado";
import { MonedasCliente } from "./_components/monedas-cliente";

export default async function Page() {
  const [rol, datos] = await Promise.all([getRol(), getMonedasConTasas()]);
  if (rol == null) redirect("/unauthorized");

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoConfiguracion
        titulo="Monedas"
        descripcion="Moneda base y tasas de cambio por fecha. Los documentos siguen emitiéndose en DOP."
      />
      <MonedasCliente monedas={datos.monedas} tasas={datos.tasas} puedeEditar={rol === "admin" || rol === "contador"} />
    </div>
  );
}
