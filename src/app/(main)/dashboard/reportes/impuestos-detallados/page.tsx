import { Card, CardContent } from "@/components/ui/card";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import {
  obtenerCompras,
  obtenerDevolucionesCompras,
  obtenerDevolucionesVentas,
  obtenerVentas,
} from "@/lib/reportes/fiscales/consultas";
import {
  diferenciaImpuestos,
  type ResumenTasas,
  resumirPorTasa,
  tablaDetalleImpuestos,
} from "@/lib/reportes/fiscales/impuestos";
import type { DetalleImpuesto } from "@/lib/reportes/fiscales/tipos";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { BotonImprimir } from "../_components/boton-imprimir";
import { FiltrosPeriodo } from "../fiscales/_components/filtros-periodo";
import { PestanasFiscales } from "../fiscales/_components/pestanas";
import { TablaResumenTasas } from "../fiscales/_components/resumen-tasas";
import { TablaDetalleImpuestos } from "../fiscales/_components/tabla-detalle-impuestos";
import { TarjetasResumen } from "../fiscales/_components/tarjetas-resumen";

const BASE = "/dashboard/reportes/impuestos-detallados";

const VISTAS = [
  { valor: "ventas", etiqueta: "Impuestos en ventas", titulo: "Impuestos en ventas" },
  { valor: "devoluciones-ventas", etiqueta: "Devoluciones de ventas", titulo: "Devoluciones en ventas" },
  { valor: "compras", etiqueta: "Impuestos en compras", titulo: "Impuestos en compras" },
  { valor: "devoluciones-compras", etiqueta: "Devoluciones de compras", titulo: "Devoluciones en compras" },
] as const;

type Vista = (typeof VISTAS)[number]["valor"];

function leerVista(params: ParametrosFecha): Vista {
  const valor = params.vista;
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return VISTAS.find((vista) => vista.valor === texto)?.valor ?? "ventas";
}

function resumenDe(detalles: readonly DetalleImpuesto[]): ResumenTasas {
  return resumirPorTasa(detalles);
}

function etiquetaDiferencia(valor: number): string {
  if (valor < 0) return "Diferencia a favor";
  if (valor > 0) return "Diferencia a pagar";
  return "Diferencia";
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const vista = leerVista(params);

  const [ventas, compras, devolucionesVentas, devolucionesCompras] = await Promise.all([
    obtenerVentas(desde, hasta),
    obtenerCompras(desde, hasta),
    obtenerDevolucionesVentas(desde, hasta),
    obtenerDevolucionesCompras(),
  ]);

  const resumenVentas = resumenDe(ventas.datos.detalles);
  const resumenCompras = resumenDe(compras.datos.detalles);
  const resumenDevolucionesVentas = resumenDe(devolucionesVentas.datos.detalles);
  const resumenDevolucionesCompras = resumenDe(devolucionesCompras.datos.detalles);
  const diferencia = diferenciaImpuestos(
    resumenVentas,
    resumenCompras,
    resumenDevolucionesVentas,
    resumenDevolucionesCompras,
  );
  const etiqueta = etiquetaDiferencia(diferencia);

  const detallesPorVista: Record<Vista, readonly DetalleImpuesto[]> = {
    ventas: ventas.datos.detalles,
    "devoluciones-ventas": devolucionesVentas.datos.detalles,
    compras: compras.datos.detalles,
    "devoluciones-compras": devolucionesCompras.datos.detalles,
  };
  const vistaActual = VISTAS.find((opcion) => opcion.valor === vista) ?? VISTAS[0];
  const detalles = detallesPorVista[vista];
  const subtitulo = `Del ${formatoDia(desde)} al ${formatoDia(hasta)}`;
  const tabla = tablaDetalleImpuestos(detalles, vistaActual.titulo, subtitulo);

  const error = ventas.error ?? compras.error ?? devolucionesVentas.error ?? devolucionesCompras.error ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Reporte detallado de impuestos</h1>
          <p className="text-muted-foreground text-sm">
            Base imponible e impuesto por tasa en ventas, compras y devoluciones. El NCF abre el documento.
          </p>
          <p className="text-muted-foreground text-sm">{subtitulo}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotonDescargar tabla={tabla} nombreArchivo={`impuestos-detallados-${vista}-${desde}-${hasta}`} />
          <BotonImprimir />
        </div>
      </div>

      <FiltrosPeriodo desde={desde} hasta={hasta} />

      {error ? <AlertaError mensaje={error} /> : null}

      <TarjetasResumen
        columnas={5}
        tarjetas={[
          { titulo: "Impuestos en ventas", valor: formatearRd(resumenVentas.totalImpuesto) },
          { titulo: "Impuestos en compras", valor: formatearRd(resumenCompras.totalImpuesto) },
          { titulo: "Devoluciones de ventas", valor: formatearRd(resumenDevolucionesVentas.totalImpuesto) },
          { titulo: "Devoluciones de compras", valor: formatearRd(resumenDevolucionesCompras.totalImpuesto) },
          {
            titulo: etiqueta,
            valor: formatearRd(Math.abs(diferencia)),
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <TablaResumenTasas titulo="Impuestos en ventas" resumen={resumenVentas} />
        <TablaResumenTasas titulo="Impuestos en compras" resumen={resumenCompras} />
        <TablaResumenTasas titulo="Devoluciones en ventas" resumen={resumenDevolucionesVentas} />
        <TablaResumenTasas titulo="Devoluciones en compras" resumen={resumenDevolucionesCompras} />
      </div>

      <div className="flex flex-col gap-3">
        <PestanasFiscales base={BASE} params={params} clave="vista" activa={vista} opciones={VISTAS} />
        <Card className="py-0">
          <CardContent className="p-0">
            <TablaDetalleImpuestos
              filas={detalles}
              vacio={
                vista === "devoluciones-compras"
                  ? "El sistema todavía no registra devoluciones de compras."
                  : "No hay documentos con impuestos en este período."
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
