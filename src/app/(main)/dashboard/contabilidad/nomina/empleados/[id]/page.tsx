import { notFound, redirect } from "next/navigation";

import { ErrorCarga } from "@/app/(main)/dashboard/contabilidad/nomina/_components/error-carga";
import { MigasDePan } from "@/components/migas-de-pan";
import { ContenedorDetalle } from "@/components/pagina/contenedor-pagina";
import { getRol } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { getConceptos, getEmpleado, getNovedadesRecurrentes, getPeriodos, getRecibos } from "@/lib/nomina/consultas";
import type { ConceptoNomina, Empleado, PeriodoNomina } from "@/lib/nomina/tipos";

import { FichaEmpleado } from "./_components/ficha-empleado";
import type { FilaReciboEmpleado } from "./_components/tabla-recibos";

export const dynamic = "force-dynamic";

const CODIGOS_RESERVADOS = new Set(["SALARIO", "SFS", "AFP", "ISR"]);

const MIGAS_EMPLEADOS = [
  { etiqueta: "Inicio", href: "/dashboard" },
  { etiqueta: "Contabilidad", href: "/dashboard/contabilidad" },
  { etiqueta: "Nómina", href: "/dashboard/contabilidad/nomina" },
  { etiqueta: "Empleados", href: "/dashboard/contabilidad/nomina/empleados" },
] as const;

function conceptosDeNovedad(conceptos: readonly ConceptoNomina[]): ConceptoNomina[] {
  return conceptos.filter(
    (concepto) =>
      (concepto.clase === "ingreso" || concepto.clase === "deduccion") && !CODIGOS_RESERVADOS.has(concepto.codigo),
  );
}

function ordenarRecibos(
  recibos: Awaited<ReturnType<typeof getRecibos>>,
  periodos: readonly PeriodoNomina[],
): FilaReciboEmpleado[] {
  const periodosPorId = new Map(periodos.map((periodo) => [periodo.id, periodo]));
  const orden = new Map(periodos.map((periodo, indice) => [periodo.id, indice]));

  return recibos
    .map((recibo) => ({ recibo, periodo: periodosPorId.get(recibo.periodo_id) ?? null }))
    .sort((a, b) => (orden.get(a.recibo.periodo_id) ?? 0) - (orden.get(b.recibo.periodo_id) ?? 0));
}

function VistaError({ mensaje }: { mensaje: string }) {
  return (
    <ContenedorDetalle>
      <MigasDePan items={MIGAS_EMPLEADOS} />
      <ErrorCarga titulo="No se pudo cargar la ficha" mensaje={mensaje} />
    </ContenedorDetalle>
  );
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rol = await getRol();
  if (rol === null) redirect("/unauthorized");

  let empleado: Empleado | null;
  try {
    empleado = await getEmpleado(id);
  } catch (error) {
    return <VistaError mensaje={error instanceof Error ? error.message : "Error inesperado al leer el empleado."} />;
  }
  if (!empleado) notFound();

  try {
    const [novedades, conceptos, periodos, recibos] = await Promise.all([
      getNovedadesRecurrentes(id),
      getConceptos({ activo: true }),
      getPeriodos(),
      getRecibos({ empleado_id: id }),
    ]);

    return (
      <FichaEmpleado
        empleado={empleado}
        novedades={novedades}
        conceptos={conceptosDeNovedad(conceptos)}
        recibos={ordenarRecibos(recibos, periodos)}
        puedeEscribir={rol !== "lector"}
        fechaHoy={hoyRD()}
      />
    );
  } catch (error) {
    return <VistaError mensaje={error instanceof Error ? error.message : "Error inesperado al leer la ficha."} />;
  }
}
