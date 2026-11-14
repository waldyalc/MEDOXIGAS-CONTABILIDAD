import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import {
  obtenerCompras,
  obtenerDevolucionesCompras,
  obtenerDevolucionesVentas,
  obtenerVentas,
} from "@/lib/reportes/fiscales/consultas";
import { filasRetenciones, tablaRetenciones, type VistaRetencion } from "@/lib/reportes/fiscales/retenciones";
import type { DetalleImpuesto } from "@/lib/reportes/fiscales/tipos";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { DetalleRetencion } from "../fiscales/_components/detalle-retencion";
import { FiltrosPeriodo } from "../fiscales/_components/filtros-periodo";
import { PestanasFiscales } from "../fiscales/_components/pestanas";
import { TarjetasResumen } from "../fiscales/_components/tarjetas-resumen";

const BASE = "/dashboard/reportes/impuestos-retenciones";

const VISTAS = [
  { valor: "ventas", etiqueta: "Ventas" },
  { valor: "compras", etiqueta: "Compras" },
] as const;

function leerVista(params: ParametrosFecha): VistaRetencion {
  const valor = params.vista;
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto === "compras" ? "compras" : "ventas";
}

function igualTasa(detalle: DetalleImpuesto, tasa: number | null): boolean {
  if (tasa == null) return detalle.tasa == null;
  return detalle.tasa != null && Math.round(detalle.tasa) === tasa;
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

  const detalles = vista === "ventas" ? ventas.datos.detalles : compras.datos.detalles;
  const devoluciones = vista === "ventas" ? devolucionesVentas.datos.detalles : devolucionesCompras.datos.detalles;
  const filas = filasRetenciones(detalles, devoluciones, vista);
  const subtitulo = `Del ${formatoDia(desde)} al ${formatoDia(hasta)}`;
  const titulo = vista === "ventas" ? "Impuestos en ventas" : "Impuestos en compras";
  const tabla = tablaRetenciones(filas, titulo, subtitulo);

  const totalImpuestos = filas.reduce((total, fila) => total + fila.impuestos, 0);
  const totalDevoluciones = filas.reduce((total, fila) => total + fila.impuestosDevoluciones, 0);
  const totalSaldo = filas.reduce((total, fila) => total + fila.saldo, 0);

  const error = ventas.error ?? compras.error ?? devolucionesVentas.error ?? devolucionesCompras.error ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Impuestos y retenciones</h1>
          <p className="text-muted-foreground text-sm">
            ITBIS por tarifa en ventas y compras, con las devoluciones del período y su saldo.
          </p>
          <p className="text-muted-foreground text-sm">{subtitulo}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotonDescargar tabla={tabla} nombreArchivo={`impuestos-retenciones-${vista}-${desde}-${hasta}`} />
        </div>
      </div>

      <FiltrosPeriodo desde={desde} hasta={hasta} />

      {error ? <AlertaError mensaje={error} /> : null}

      <TarjetasResumen
        tarjetas={[
          { titulo: "Impuestos", valor: formatearRd(totalImpuestos) },
          { titulo: "Impuestos en devoluciones", valor: formatearRd(totalDevoluciones) },
          { titulo: "Saldo", valor: formatearRd(totalSaldo) },
        ]}
      />

      <PestanasFiscales base={BASE} params={params} clave="vista" activa={vista} opciones={VISTAS} />

      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tarifa</TableHead>
                <TableHead className="text-right">Base gravable</TableHead>
                <TableHead className="text-right">Impuestos</TableHead>
                <TableHead className="text-right">Base devoluciones</TableHead>
                <TableHead className="text-right">Impuestos en devoluciones</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((fila) => (
                <TableRow key={`${fila.nombre}-${fila.tarifa}`}>
                  <TableCell>{fila.nombre}</TableCell>
                  <TableCell>{fila.tipo}</TableCell>
                  <TableCell>{fila.tarifa == null ? "Exento" : `${fila.tarifa}%`}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(fila.baseGravable)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(fila.impuestos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(fila.baseDevoluciones)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(fila.impuestosDevoluciones)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatearRd(fila.saldo)}</TableCell>
                  <TableCell className="text-right">
                    <DetalleRetencion
                      titulo={`${fila.tipo} · ${fila.tarifa == null ? "Exento" : `${fila.tarifa}%`}`}
                      filas={detalles.filter((detalle) => igualTasa(detalle, fila.tarifa))}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Estas filas muestran el ITBIS de los documentos del período. Las retenciones aplicadas a proveedores se ven en
        el reporte IR-17 y en las cartas de retención.
      </p>
    </div>
  );
}
