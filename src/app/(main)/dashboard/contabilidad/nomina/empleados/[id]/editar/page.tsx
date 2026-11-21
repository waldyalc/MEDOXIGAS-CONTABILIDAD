import { notFound, redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { getCentrosCostoActivos } from "@/lib/centros-costo/consultas";
import { hoyRD } from "@/lib/facturacion/formato";
import { getEmpleado } from "@/lib/nomina/consultas";

import { rutaEmpleado } from "../../_components/formato-nomina";
import { SoloLecturaEmpleado } from "../../_components/solo-lectura";
import { WizardEmpleado } from "../../_components/wizard-empleado";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  const empleado = await getEmpleado(id);
  if (!empleado) notFound();

  if (rol === "lector") {
    return <SoloLecturaEmpleado volverA={rutaEmpleado(empleado.id)} titulo="Editar empleado" />;
  }

  const centrosCosto = await getCentrosCostoActivos();

  return (
    <WizardEmpleado
      empleado={empleado}
      centrosCosto={centrosCosto}
      fechaHoy={hoyRD()}
      titulo="Editar empleado"
      migas={[
        { etiqueta: "Inicio", href: "/dashboard" },
        { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
        { etiqueta: "Nómina", href: "/dashboard/contabilidad/nomina" },
        { etiqueta: "Empleados", href: "/dashboard/contabilidad/nomina/empleados" },
        { etiqueta: empleado.nombre_completo, href: rutaEmpleado(empleado.id) },
        { etiqueta: "Editar empleado" },
      ]}
      volverA={rutaEmpleado(empleado.id)}
    />
  );
}
