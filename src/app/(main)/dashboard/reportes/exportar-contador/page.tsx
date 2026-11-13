import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { obtenerLibroDiario } from "@/lib/reportes/consultas";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { obtenerCompras, obtenerVentas } from "@/lib/reportes/fiscales/consultas";
import { tablaComprasContador, tablaFacturasContador, tablaLibroContador } from "@/lib/reportes/fiscales/contador";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { FiltrosPeriodo } from "../fiscales/_components/filtros-periodo";
import { TarjetasResumen } from "../fiscales/_components/tarjetas-resumen";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);

  const [ventas, compras, libro] = await Promise.all([
    obtenerVentas(desde, hasta),
    obtenerCompras(desde, hasta),
    obtenerLibroDiario(desde, hasta),
  ]);

  const subtitulo = `Del ${desde} al ${hasta}`;
  const tablaFacturas = tablaFacturasContador(ventas.datos.documentos, subtitulo);
  const tablaCompras = tablaComprasContador(compras.datos.documentos, subtitulo);
  const tablaLibro = tablaLibroContador(libro.filas, subtitulo);

  const totalFacturas = ventas.datos.documentos.reduce((total, documento) => total + documento.total, 0);
  const totalCompras = compras.datos.documentos.reduce((total, documento) => total + documento.total, 0);
  const error = ventas.error ?? compras.error ?? libro.error;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Exportar para el contador</h1>
        <p className="text-muted-foreground text-sm">
          Descarga las facturas de venta, las compras y el libro diario del rango de fechas. Por defecto se usa el mes
          actual.
        </p>
      </div>

      <FiltrosPeriodo desde={desde} hasta={hasta} />

      {error ? <AlertaError mensaje={error} /> : null}

      <TarjetasResumen
        tarjetas={[
          { titulo: "Facturas de venta", valor: String(ventas.datos.documentos.length) },
          { titulo: "Compras", valor: String(compras.datos.documentos.length) },
          { titulo: "Total facturado", valor: formatearRd(totalFacturas) },
          { titulo: "Total compras", valor: formatearRd(totalCompras) },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Facturas de venta</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="text-muted-foreground text-sm">
              NCF, fecha, cliente, RNC/cédula, subtotal, ITBIS, total y estado. {ventas.datos.documentos.length}{" "}
              documento(s).
            </p>
            <BotonDescargar tabla={tablaFacturas} nombreArchivo={`facturas-${desde}-${hasta}`} />
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Compras</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="text-muted-foreground text-sm">
              NCF/número, fecha, proveedor, RNC/cédula, subtotal, ITBIS, total y estado.{" "}
              {compras.datos.documentos.length} documento(s).
            </p>
            <BotonDescargar tabla={tablaCompras} nombreArchivo={`compras-contador-${desde}-${hasta}`} />
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Libro diario</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="text-muted-foreground text-sm">
              Asiento, fecha, descripción, origen, cuenta, débito y crédito. {libro.filas.length} línea(s).
            </p>
            <BotonDescargar tabla={tablaLibro} nombreArchivo={`libro-diario-${desde}-${hasta}`} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
