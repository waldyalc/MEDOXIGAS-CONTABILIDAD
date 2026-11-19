import Link from "next/link";

import { BotonImprimir } from "@/components/boton-imprimir";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { resumirIr17, tablaIr17 } from "@/lib/reportes/fiscales/ir17";
import { obtenerRetencionesProveedores } from "@/lib/reportes/fiscales/retenciones-consultas";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { FiltrosPeriodo } from "../fiscales/_components/filtros-periodo";
import { TarjetasResumen } from "../fiscales/_components/tarjetas-resumen";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const { filas, error } = await obtenerRetencionesProveedores(desde, hasta);

  const totales = resumirIr17(filas);
  const totalBase = filas.reduce((total, fila) => total + fila.base, 0);
  const totalRetenido = filas.reduce((total, fila) => total + fila.monto, 0);
  const subtitulo = `Del ${formatoDia(desde)} al ${formatoDia(hasta)}`;
  const tabla = tablaIr17(filas, "IR-17 Retenciones a terceros", subtitulo);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Reporte IR-17</h1>
          <p className="text-muted-foreground text-sm">
            Retenciones de ITBIS e ISR que la empresa aplicó a sus proveedores en el período.
          </p>
          <p className="text-muted-foreground text-sm">{subtitulo}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotonDescargar tabla={tabla} nombreArchivo={`ir-17-${desde}-${hasta}`} />
          <BotonImprimir />
        </div>
      </div>

      <FiltrosPeriodo desde={desde} hasta={hasta} />

      {error ? <AlertaError mensaje={error} /> : null}

      <TarjetasResumen
        tarjetas={[
          { titulo: "Base sujeta", valor: formatearRd(totalBase) },
          ...totales.map((total) => ({
            titulo: total.tipo === "itbis" ? "ITBIS retenido" : "ISR retenido",
            valor: formatearRd(total.monto),
          })),
          { titulo: "Total retenido", valor: formatearRd(totalRetenido) },
        ]}
      />

      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RNC/Cédula</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Retención</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Retenido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground h-24 text-center whitespace-normal">
                    No hay retenciones a proveedores en el período.
                  </TableCell>
                </TableRow>
              ) : (
                filas.map((fila) => (
                  <FilaNavegable key={fila.id} href={rutaContacto(fila.contactoId)}>
                    <TableCell className="text-muted-foreground">{fila.rnc ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={rutaContacto(fila.contactoId)} prefetch={false} className="hover:underline">
                        {fila.proveedor}
                      </Link>
                    </TableCell>
                    <TableCell>{fila.facturaNcf ?? `#${fila.facturaNumero}`}</TableCell>
                    <TableCell>{formatoDia(fila.fecha)}</TableCell>
                    <TableCell>{fila.tipo === "itbis" ? "ITBIS" : "ISR"}</TableCell>
                    <TableCell>{fila.nombre}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(fila.base)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatearRd(fila.monto)}</TableCell>
                  </FilaNavegable>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">Reporte informativo. No crea ni envía ningún documento a la DGII.</p>
    </div>
  );
}
