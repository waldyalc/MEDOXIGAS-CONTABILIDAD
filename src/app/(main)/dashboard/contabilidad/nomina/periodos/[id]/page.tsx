import { notFound, redirect } from "next/navigation";

import { TriangleAlert } from "lucide-react";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getRol } from "@/lib/auth/rol";
import { getCuentasCajaBanco } from "@/lib/facturacion/consultas";
import { getConfigNomina, getPeriodo, getRecibos, getResumenPeriodo } from "@/lib/nomina/consultas";
import type { PeriodoNomina, ReciboNomina, ResumenPeriodo } from "@/lib/nomina/tipos";

import { BotonReintentar } from "../_components/boton-reintentar";
import { MIGAS_BASE } from "../_components/comun-nomina";
import { DetallePeriodoCliente } from "./_components/detalle-periodo";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const { id } = await params;

  let periodo: PeriodoNomina | null = null;
  let filas: ResumenPeriodo[] = [];
  let recibos: ReciboNomina[] = [];
  let error: string | null = null;

  try {
    [periodo, filas, recibos] = await Promise.all([
      getPeriodo(id),
      getResumenPeriodo(id),
      getRecibos({ periodo_id: id }).catch(() => []),
    ]);
  } catch (fallo) {
    error = fallo instanceof Error ? fallo.message : "Intenta de nuevo.";
  }

  if (error) {
    return (
      <ContenedorLista>
        <EncabezadoPagina
          titulo="Periodo de nómina"
          migas={[...MIGAS_BASE, { etiqueta: "Periodos y cálculo" }]}
          acciones={<BotonReintentar />}
        />
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>No se pudo cargar el periodo</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </ContenedorLista>
    );
  }

  if (!periodo) notFound();

  const [cuentas, config] = await Promise.all([
    getCuentasCajaBanco().catch(() => []),
    getConfigNomina().catch(() => null),
  ]);

  const asientos: Record<string, string> = {};
  for (const recibo of recibos) {
    if (recibo.asiento_id) asientos[recibo.id] = recibo.asiento_id;
  }

  return (
    <DetallePeriodoCliente
      periodo={periodo}
      filas={filas}
      asientos={asientos}
      cuentas={cuentas}
      config={config}
      puedeEscribir={rol !== "lector"}
    />
  );
}
