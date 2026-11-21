import { notFound, redirect } from "next/navigation";

import { TriangleAlert } from "lucide-react";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getRol } from "@/lib/auth/rol";
import { getCuentasCajaBanco } from "@/lib/facturacion/consultas";
import { getConfigNomina, getPeriodo, getRecibos, getResumenPeriodo } from "@/lib/nomina/consultas";
import type { PeriodoNomina, ReciboNomina, ResumenPeriodo } from "@/lib/nomina/tipos";

import { BotonReintentar } from "../../periodos/_components/boton-reintentar";
import { MIGAS_BASE } from "../../periodos/_components/comun-nomina";
import { LoteCliente } from "./_components/lote-cliente";

export default async function Page({ params }: { params: Promise<{ periodoId: string }> }) {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const { periodoId } = await params;

  let periodo: PeriodoNomina | null = null;
  let recibos: ReciboNomina[] = [];
  let resumen: ResumenPeriodo[] = [];
  let error: string | null = null;

  try {
    [periodo, recibos, resumen] = await Promise.all([
      getPeriodo(periodoId),
      getRecibos({ periodo_id: periodoId }),
      getResumenPeriodo(periodoId).catch(() => []),
    ]);
  } catch (fallo) {
    error = fallo instanceof Error ? fallo.message : "Intenta de nuevo.";
  }

  if (error) {
    return (
      <ContenedorLista>
        <EncabezadoPagina
          titulo="Pagos del periodo"
          migas={[...MIGAS_BASE, { etiqueta: "Pagos" }]}
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

  const cargos: Record<string, string> = {};
  for (const fila of resumen) {
    if (fila.cargo) cargos[fila.recibo_id] = fila.cargo;
  }

  return (
    <LoteCliente
      periodo={periodo}
      recibos={recibos}
      cargos={cargos}
      cuentas={cuentas}
      config={config}
      puedeEscribir={rol !== "lector"}
    />
  );
}
