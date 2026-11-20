import { redirect } from "next/navigation";

import { getRol } from "@/lib/auth/rol";
import { getConceptos } from "@/lib/nomina/consultas";
import type { ConceptoNomina } from "@/lib/nomina/tipos";

import { ErrorCarga } from "../_components/error-carga";
import { MarcoNomina } from "../_components/marco-nomina";
import { AvisoSoloLectura } from "../_components/solo-lectura";
import { ConceptosCliente } from "./_components/conceptos-cliente";

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  let conceptos: ConceptoNomina[] = [];
  let errorCarga: string | null = null;

  try {
    conceptos = await getConceptos();
  } catch (fallo) {
    errorCarga = fallo instanceof Error ? fallo.message : "No se pudo leer el catálogo de conceptos.";
  }

  const puedeEditar = rol === "admin" || rol === "contador";

  return (
    <MarcoNomina
      pagina="Conceptos"
      descripcion="Ingresos, deducciones, aportes patronales y provisiones de la nómina."
      tipo="lista"
      aviso={puedeEditar ? undefined : <AvisoSoloLectura />}
    >
      {errorCarga ? (
        <ErrorCarga titulo="No se pudo cargar el catálogo de conceptos" mensaje={errorCarga} />
      ) : (
        <ConceptosCliente conceptos={conceptos} puedeEditar={puedeEditar} />
      )}
    </MarcoNomina>
  );
}
