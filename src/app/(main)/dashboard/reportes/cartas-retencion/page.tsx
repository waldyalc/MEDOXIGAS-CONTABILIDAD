import Link from "next/link";

import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";
import { type ParametrosFecha, parsearRango } from "@/lib/reportes/fechas";
import { agruparCartas, type CartaProveedor } from "@/lib/reportes/fiscales/ir17";
import { obtenerRetencionesProveedores } from "@/lib/reportes/fiscales/retenciones-consultas";

import { AlertaError } from "../_components/alerta-error";
import { BotonImprimir } from "../_components/boton-imprimir";
import { FiltrosPeriodo } from "../fiscales/_components/filtros-periodo";
import { TarjetasResumen } from "../fiscales/_components/tarjetas-resumen";

const BASE = "/dashboard/reportes/cartas-retencion";

function leerContacto(params: ParametrosFecha): string | null {
  const valor = params.contacto;
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto ?? null;
}

function Carta({
  carta,
  desde,
  hasta,
  empresa,
}: {
  carta: CartaProveedor;
  desde: string;
  hasta: string;
  empresa: {
    nombre: string;
    rnc: string | null;
    direccion: string | null;
    telefono: string | null;
    correo: string | null;
  } | null;
}) {
  return (
    <Card className="mx-auto w-full max-w-[860px] gap-0 py-0 shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b">
        <CardTitle className="text-lg">Carta de retención</CardTitle>
        <BotonImprimir />
      </CardHeader>
      <CardContent className="p-8">
        <article className="flex flex-col gap-6 text-sm text-slate-800">
          <header className="flex flex-col gap-1 border-b pb-4">
            <p className="text-base font-semibold">{empresa?.nombre ?? "MEDOXIGAS ALC, SRL"}</p>
            {empresa?.rnc ? <p>RNC: {empresa.rnc}</p> : null}
            {empresa?.direccion ? <p>{empresa.direccion}</p> : null}
            {empresa?.telefono || empresa?.correo ? (
              <p>{[empresa.telefono, empresa.correo].filter(Boolean).join(" · ")}</p>
            ) : null}
          </header>

          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Carta de retención</h2>
            <p>
              Período: {formatoDia(desde)} al {formatoDia(hasta)}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <p>
              <span className="font-medium">Proveedor:</span> {carta.proveedor}
            </p>
            <p>
              <span className="font-medium">RNC/Cédula:</span> {carta.rnc ?? "—"}
            </p>
          </div>

          <p>
            Hacemos constar que a {carta.proveedor} le fueron retenidos los siguientes valores en el período indicado:
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Retención</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Retenido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carta.filas.map((fila) => (
                <TableRow key={fila.id}>
                  <TableCell>{fila.facturaNcf ?? `#${fila.facturaNumero}`}</TableCell>
                  <TableCell>{formatoDia(fila.fecha)}</TableCell>
                  <TableCell>{fila.nombre}</TableCell>
                  <TableCell>{fila.tipo === "itbis" ? "ITBIS" : "ISR"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(fila.base)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearRd(fila.monto)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-1 self-end text-right">
            <p>ITBIS retenido: {formatearRd(carta.totalItbis)}</p>
            <p>ISR retenido: {formatearRd(carta.totalIsr)}</p>
            <p className="text-base font-semibold">Total retenido: {formatearRd(carta.totalMonto)}</p>
          </div>

          <p>Se extiende la presente carta a los fines que estime convenientes.</p>

          <div className="mt-12 flex flex-col items-center gap-1">
            <div className="w-64 border-t border-slate-400" />
            <p>Firma autorizada</p>
          </div>
        </article>
      </CardContent>
    </Card>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const { desde, hasta } = parsearRango(params);
  const [{ filas, error }, empresa] = await Promise.all([obtenerRetencionesProveedores(desde, hasta), getEmpresa()]);

  const cartas = agruparCartas(filas);
  const contactoId = leerContacto(params);
  const carta = cartas.find((item) => item.contactoId === contactoId) ?? null;
  const totalRetenido = cartas.reduce((total, item) => total + item.totalMonto, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between print:hidden">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Cartas de retención</h1>
          <p className="text-muted-foreground text-sm">
            Retenciones agrupadas por proveedor y período, con su carta imprimible.
          </p>
          <p className="text-muted-foreground text-sm">
            Del {formatoDia(desde)} al {formatoDia(hasta)}
          </p>
        </div>
      </div>

      <div className="print:hidden">
        <FiltrosPeriodo
          desde={desde}
          hasta={hasta}
          extras={carta ? [{ nombre: "contacto", valor: carta.contactoId }] : []}
        />
      </div>

      {error ? <AlertaError mensaje={error} /> : null}

      <div className="print:hidden">
        <TarjetasResumen
          tarjetas={[
            { titulo: "Proveedores con retenciones", valor: String(cartas.length) },
            { titulo: "Total retenido", valor: formatearRd(totalRetenido) },
          ]}
        />
      </div>

      <Card className="py-0 print:hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>RNC/Cédula</TableHead>
                <TableHead className="text-right">ITBIS</TableHead>
                <TableHead className="text-right">ISR</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cartas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground h-24 text-center whitespace-normal">
                    No hay retenciones a proveedores en el período.
                  </TableCell>
                </TableRow>
              ) : (
                cartas.map((item) => (
                  <TableRow key={item.contactoId}>
                    <TableCell className="font-medium">{item.proveedor}</TableCell>
                    <TableCell className="text-muted-foreground">{item.rnc ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(item.totalItbis)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearRd(item.totalIsr)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatearRd(item.totalMonto)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`${BASE}?desde=${desde}&hasta=${hasta}&contacto=${item.contactoId}`} />}
                      >
                        <FileText />
                        Ver carta
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {carta ? (
        <Carta carta={carta} desde={desde} hasta={hasta} empresa={empresa} />
      ) : (
        <p className="text-muted-foreground text-sm print:hidden">
          Elige un proveedor para ver e imprimir su carta de retención.
        </p>
      )}
    </div>
  );
}
