import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { mismoMes, periodoDeFecha, rangoMes, textoPeriodo } from "@/lib/reportes/fiscales/comun";
import {
  obtenerCompras,
  obtenerDevolucionesVentas,
  obtenerEmpresa,
  obtenerVentas,
} from "@/lib/reportes/fiscales/consultas";
import { type CasillasIt1, calcularIt1, fechaLimiteIt1, tablaIt1 } from "@/lib/reportes/fiscales/it1";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltrosPeriodo } from "../fiscales/_components/filtros-periodo";

function fila(etiqueta: string, valor: number) {
  return { etiqueta, valor };
}

function secciones(casillas: CasillasIt1) {
  return [
    {
      titulo: "II. Ingreso por operaciones",
      filas: [
        fila("1 Total de operaciones del período", casillas.totalOperaciones),
        fila("9 Total de ingresos por operaciones no gravadas", casillas.noGravadas),
        fila("10 Total de ingresos por operaciones gravadas", casillas.totalGravadas),
        fila("11 Operaciones gravadas al 18%", casillas.gravadas18),
        fila("12 Operaciones gravadas al 16%", casillas.gravadas16),
      ],
    },
    {
      titulo: "III. Liquidación",
      filas: [
        fila("16 ITBIS cobrado 18%", casillas.itbisCobrado18),
        fila("17 ITBIS cobrado 16%", casillas.itbisCobrado16),
        fila("21 Total de ITBIS cobrado", casillas.totalItbisCobrado),
        fila("22 ITBIS pagado en compras locales", casillas.itbisComprasLocales),
        fila("23 ITBIS pagado por servicios deducibles", casillas.itbisServicios),
        fila("24 ITBIS pagado en importaciones", casillas.itbisImportaciones),
        fila("25 Total de ITBIS deducible", casillas.totalItbisDeducible),
        fila("26 Impuestos a pagar", casillas.impuestosAPagar),
        fila("27 Saldo a favor", casillas.saldoAFavor),
        fila("30 Pagos computables por retenciones", casillas.pagosComputables),
        fila("33 Diferencia a pagar", casillas.diferenciaAPagar),
        fila("34 Nuevo saldo a favor", casillas.nuevoSaldoAFavor),
      ],
    },
    {
      titulo: "V. Monto a pagar",
      filas: [fila("38 Total a pagar", casillas.totalAPagar)],
    },
  ];
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const seleccion = parsearRango(params);
  const { desde, hasta } = rangoMes(seleccion.desde);
  const periodo = periodoDeFecha(desde);
  const empresa = await obtenerEmpresa();
  const [ventas, devoluciones, compras] = await Promise.all([
    obtenerVentas(desde, hasta),
    obtenerDevolucionesVentas(desde, hasta),
    obtenerCompras(desde, hasta),
  ]);

  const detallesVentas = [
    ...ventas.datos.detalles,
    ...devoluciones.datos.detalles.map((detalle) => ({
      ...detalle,
      base: -detalle.base,
      impuesto: -detalle.impuesto,
    })),
  ];
  const totalFacturado =
    ventas.datos.documentos.reduce((total, documento) => total + documento.total, 0) -
    devoluciones.datos.documentos.reduce((total, documento) => total + documento.total, 0);
  const comprasDeducibles = compras.datos.documentos.filter((documento) => documento.ncf.trim() !== "");
  const casillas = calcularIt1(detallesVentas, comprasDeducibles, totalFacturado);
  const limite = fechaLimiteIt1(periodo);
  const tabla = tablaIt1(casillas);

  const avisos: string[] = [];
  if (seleccion.desde !== desde || seleccion.hasta !== hasta || !mismoMes(seleccion.desde, seleccion.hasta)) {
    avisos.push("El IT-1 es mensual: se usa el mes completo de la fecha Desde.");
  }

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Reporte IT-1"
        descripcion="Vista de solo lectura de la declaración mensual de ITBIS. No crea borradores ni envía documentos a la DGII."
        rango={`${textoPeriodo(periodo)} · Fecha límite ${limite ? formatoDia(limite) : "—"}`}
        acciones={<BotonDescargar tabla={tabla} nombreArchivo={`it1-${periodo}`} />}
      />

      <FiltrosPeriodo desde={desde} hasta={hasta} />

      {avisos.map((aviso) => (
        <p key={aviso} className="text-muted-foreground text-sm">
          {aviso}
        </p>
      ))}

      {ventas.error || devoluciones.error || compras.error ? (
        <AlertaError mensaje={ventas.error ?? devoluciones.error ?? compras.error ?? ""} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Datos generales</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="text-muted-foreground">RNC/Cédula</TableCell>
                  <TableCell>{empresa.datos.rnc ?? "—"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Nombre comercial</TableCell>
                  <TableCell>{empresa.datos.nombre}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Correo</TableCell>
                  <TableCell>{empresa.datos.correo ?? "—"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Teléfono</TableCell>
                  <TableCell>{empresa.datos.telefono ?? "—"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Razón social</TableCell>
                  <TableCell>{empresa.datos.nombre}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Fecha límite</TableCell>
                  <TableCell>{limite ? formatoDia(limite) : "—"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Período</TableCell>
                  <TableCell>{textoPeriodo(periodo)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Tipo de declaración</TableCell>
                  <TableCell>Normal</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="border-b py-4">
            <CardTitle>Anexo A (resumen)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>11 Total de operaciones (607)</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatearRd(casillas.totalOperaciones)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>19 Total de operaciones incluyendo impuestos</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatearRd(casillas.totalFacturadoConImpuestos)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>26 Total de operaciones por tipo de ingreso</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>33 Pagos computables por retenciones/percepción</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(casillas.pagosComputables)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>IT-1 · Casillas principales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableBody>
              {secciones(casillas).map((seccion) => (
                <SeccionIt1 key={seccion.titulo} titulo={seccion.titulo} filas={seccion.filas} />
              ))}
              <TableRow className="font-semibold">
                <TableCell>68 Total general</TableCell>
                <TableCell className="text-right tabular-nums">{formatearRd(casillas.totalGeneral)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        El ITBIS deducible toma solo las compras con NCF. Las compras sin NCF no generan crédito fiscal.
      </p>
    </div>
  );
}

function SeccionIt1({ titulo, filas }: { titulo: string; filas: { etiqueta: string; valor: number }[] }) {
  return (
    <>
      <TableRow className="bg-muted/50">
        <TableCell colSpan={2} className="font-medium">
          {titulo}
        </TableCell>
      </TableRow>
      {filas.map((fila) => (
        <TableRow key={fila.etiqueta}>
          <TableCell>{fila.etiqueta}</TableCell>
          <TableCell className="text-right tabular-nums">{formatearRd(fila.valor)}</TableCell>
        </TableRow>
      ))}
    </>
  );
}
