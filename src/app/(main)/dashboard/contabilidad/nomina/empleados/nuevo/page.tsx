import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { getCentrosCostoActivos } from "@/lib/centros-costo/consultas";
import { hoyRD } from "@/lib/facturacion/formato";

import { SoloLecturaEmpleado } from "../_components/solo-lectura";
import { WizardEmpleado } from "../_components/wizard-empleado";

export const dynamic = "force-dynamic";

const MIGAS = [
  { etiqueta: "Inicio", href: "/dashboard" },
  { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
  { etiqueta: "Nómina", href: "/dashboard/contabilidad/nomina" },
  { etiqueta: "Empleados", href: "/dashboard/contabilidad/nomina/empleados" },
  { etiqueta: "Nuevo empleado" },
] as const;

export default async function Page() {
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  if (rol === "lector") {
    return <SoloLecturaEmpleado volverA="/dashboard/contabilidad/nomina/empleados" titulo="Nuevo empleado" />;
  }

  const centrosCosto = await getCentrosCostoActivos();

  return (
    <WizardEmpleado
      empleado={null}
      centrosCosto={centrosCosto}
      fechaHoy={hoyRD()}
      titulo="Nuevo empleado"
      migas={MIGAS}
      volverA="/dashboard/contabilidad/nomina/empleados"
    />
  );
}
