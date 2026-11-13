import { HandCoins } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { obtenerCxc } from "@/lib/reportes/consultas";
import { agruparCxc } from "@/lib/reportes/cxc";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";

import { AlertaError } from "../_components/alerta-error";
import { EncabezadoReporte } from "../_components/encabezado-reporte";
import { FiltroFechas } from "../_components/filtro-fechas";

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const { desde, hasta } = parsearRango(await searchParams);
  const { filas, error } = await obtenerCxc(hasta);
  const resumen = agruparCxc(filas);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoReporte
        titulo="Cuentas por cobrar"
        descripcion="Saldo pendiente por cliente y días de vencimiento a la fecha de corte."
        desde={desde}
        hasta={hasta}
      />

      <FiltroFechas desde={desde} hasta={hasta} />

      <p className="text-muted-foreground -mt-3 text-sm print:hidden">
        El saldo se calcula a la fecha de corte (Hasta).
      </p>

      {error ? <AlertaError mensaje={error} /> : null}

      {resumen.clientes.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HandCoins />
            </EmptyMedia>
            <EmptyTitle>Sin cuentas por cobrar</EmptyTitle>
            <EmptyDescription>No hay facturas con saldo pendiente a la fecha de corte.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {resumen.totalVencido > 0 ? (
            <p className="text-destructive text-sm">
              Saldo vencido: <span className="font-medium tabular-nums">{formatearRd(resumen.totalVencido)}</span>
            </p>
          ) : null}

          <Card className="py-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Facturas</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Días vencida</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumen.clientes.map((cliente) => (
                    <TableRow key={cliente.contactoId}>
                      <TableCell>{cliente.contactoNombre}</TableCell>
                      <TableCell className="text-right tabular-nums">{cliente.facturas}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatearRd(cliente.total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatearRd(cliente.pagado)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatearRd(cliente.saldo)}
                      </TableCell>
                      <TableCell className="text-right">
                        {cliente.diasVencida > 0 ? (
                          <span className="text-destructive tabular-nums">{cliente.diasVencida} días</span>
                        ) : (
                          <span className="text-muted-foreground">Al día</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4}>Total por cobrar al {hasta}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(resumen.totalSaldo)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
