import { notFound, redirect } from "next/navigation";

import { TriangleAlert } from "@/components/icons";
import { ContenedorDetalle } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getRol } from "@/lib/auth/rol";
import { getCuentasCajaBanco } from "@/lib/facturacion/consultas";
import {
  getConceptos,
  getConfigNomina,
  getEmpleado,
  getParametrosNomina,
  getPeriodo,
  getRecibo,
  getResumenPeriodo,
} from "@/lib/nomina/consultas";
import type { ConceptoNomina, Empleado, PeriodoNomina, ReciboConLineas, ResumenPeriodo } from "@/lib/nomina/tipos";

import { BotonReintentar } from "../../periodos/_components/boton-reintentar";
import { MIGAS_BASE } from "../../periodos/_components/comun-nomina";
import { ReciboCliente } from "./_components/recibo-cliente";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const { id } = await params;

  let recibo: ReciboConLineas | null = null;
  let periodo: PeriodoNomina | null = null;
  let empleado: Empleado | null = null;
  let conceptos: ConceptoNomina[] = [];
  let resumen: ResumenPeriodo[] = [];
  let error: string | null = null;

  try {
    recibo = await getRecibo(id);
    if (recibo) {
      [periodo, empleado, conceptos] = await Promise.all([
        getPeriodo(recibo.periodo_id),
        getEmpleado(recibo.empleado_id),
        getConceptos({}),
      ]);
      resumen = await getResumenPeriodo(recibo.periodo_id).catch(() => []);
    }
  } catch (fallo) {
    error = fallo instanceof Error ? fallo.message : "Intenta de nuevo.";
  }

  if (error) {
    return (
      <ContenedorDetalle>
        <EncabezadoPagina
          titulo="Recibo de nómina"
          migas={[...MIGAS_BASE, { etiqueta: "Periodos y cálculo" }]}
          acciones={<BotonReintentar />}
        />
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>No se pudo cargar el recibo</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </ContenedorDetalle>
    );
  }

  if (!recibo || !periodo || !empleado) notFound();

  const [config, cuentas, parametros, filaResumen] = await Promise.all([
    getConfigNomina().catch(() => null),
    getCuentasCajaBanco().catch(() => []),
    getParametrosNomina(periodo.anio_fiscal).catch(() => null),
    Promise.resolve(resumen.find((fila) => fila.recibo_id === recibo?.id) ?? null),
  ]);

  return (
    <ReciboCliente
      recibo={recibo}
      periodo={periodo}
      empleado={empleado}
      conceptos={conceptos}
      cuentas={cuentas}
      config={config}
      parametros={parametros}
      asientoCodigo={filaResumen?.asiento_codigo ?? null}
      puedeEscribir={rol !== "lector"}
    />
  );
}
