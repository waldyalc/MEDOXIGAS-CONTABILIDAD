import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BotonImprimir } from "@/components/boton-imprimir";
import { TriangleAlert } from "@/components/icons";
import { ContenedorDetalle } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getRol } from "@/lib/auth/rol";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { getEmpleado, getPeriodo, getRecibo, getResumenPeriodo } from "@/lib/nomina/consultas";
import type { Empleado, PeriodoNomina, ReciboConLineas } from "@/lib/nomina/tipos";

import { BotonReintentar } from "../../../periodos/_components/boton-reintentar";
import { etiquetaPeriodo, MIGAS_BASE, rutaReciboNomina } from "../../../periodos/_components/comun-nomina";
import { ColillaImpresion } from "./_components/colilla-impresion";
import { ColillaPapel } from "./_components/colilla-papel";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const { id } = await params;

  let recibo: ReciboConLineas | null = null;
  let periodo: PeriodoNomina | null = null;
  let empleado: Empleado | null = null;
  let error: string | null = null;

  try {
    recibo = await getRecibo(id);
    if (recibo) {
      [periodo, empleado] = await Promise.all([getPeriodo(recibo.periodo_id), getEmpleado(recibo.empleado_id)]);
    }
  } catch (fallo) {
    error = fallo instanceof Error ? fallo.message : "Intenta de nuevo.";
  }

  if (error) {
    return (
      <ContenedorDetalle>
        <EncabezadoPagina
          titulo="Colilla de pago"
          migas={[...MIGAS_BASE, { etiqueta: "Periodos y cálculo" }]}
          acciones={<BotonReintentar />}
        />
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>No se pudo cargar la colilla</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </ContenedorDetalle>
    );
  }

  if (!recibo || !periodo || !empleado) notFound();

  const [empresa, resumen] = await Promise.all([
    getEmpresa().catch(() => null),
    getResumenPeriodo(periodo.id).catch(() => []),
  ]);
  const asientoCodigo = resumen.find((fila) => fila.recibo_id === recibo?.id)?.asiento_codigo ?? null;

  return (
    <ContenedorDetalle>
      <EncabezadoPagina
        titulo="Colilla de pago"
        subtitulo={`${empleado.nombre_completo} · ${etiquetaPeriodo(periodo.fecha_inicio, periodo.fecha_fin, true)}`}
        migas={[
          ...MIGAS_BASE,
          { etiqueta: "Periodos y cálculo", href: "/dashboard/contabilidad/nomina/periodos" },
          { etiqueta: `Recibo de ${empleado.nombre_completo}`, href: rutaReciboNomina(recibo.id) },
          { etiqueta: "Colilla de pago" },
        ]}
        acciones={
          <>
            <BotonImprimir />
            <Button variant="outline" render={<Link href={rutaReciboNomina(recibo.id)} prefetch={false} />}>
              Volver al recibo
            </Button>
          </>
        }
      />

      {recibo.estado === "borrador" ? (
        <Alert>
          <TriangleAlert />
          <AlertTitle>El recibo no está calculado</AlertTitle>
          <AlertDescription>
            La colilla puede estar incompleta. Puedes imprimirla como vista previa, pero no registrar el envío hasta que
            el recibo esté calculado.
          </AlertDescription>
        </Alert>
      ) : null}

      <p className="text-muted-foreground text-xs">
        La colilla es del empleado: no muestra el costo de la empresa, los aportes patronales ni las provisiones. Esos
        datos viven en el detalle del recibo.
      </p>

      <div className="print:hidden">
        <div className="bg-muted/40 rounded-2xl p-3 md:p-6">
          <div className="mx-auto w-full max-w-[8.5in] overflow-hidden rounded-lg bg-white shadow-sm">
            <ColillaPapel
              empresa={empresa}
              periodo={periodo}
              empleado={empleado}
              recibo={recibo}
              asientoCodigo={asientoCodigo}
            />
          </div>
        </div>
      </div>

      <ColillaImpresion>
        <ColillaPapel
          empresa={empresa}
          periodo={periodo}
          empleado={empleado}
          recibo={recibo}
          asientoCodigo={asientoCodigo}
        />
      </ColillaImpresion>
    </ContenedorDetalle>
  );
}
