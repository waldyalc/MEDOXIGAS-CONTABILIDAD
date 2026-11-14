import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { getPlantillasImpresion } from "@/lib/plantillas-impresion/consultas";

import { EncabezadoConfiguracion } from "../_components/encabezado";
import { PlantillasCliente } from "./_components/plantillas-cliente";

export default async function Page() {
  const [rol, plantillas] = await Promise.all([getRol(), getPlantillasImpresion()]);
  if (rol == null) redirect("/unauthorized");

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoConfiguracion
        titulo="Plantillas de impresión"
        descripcion="Notas al pie, términos por defecto y logo para factura, cotización y conduce. La factura sirve de base para las otras dos."
      />
      <PlantillasCliente plantillas={plantillas} puedeEditar={rol === "admin" || rol === "contador"} />
    </div>
  );
}
