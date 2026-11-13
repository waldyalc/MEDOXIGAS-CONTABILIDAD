import Link from "next/link";

import { FileText, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rutaContacto, rutaFactura } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";
import type { FilaReporte, TablaReporte } from "@/lib/reportes/exportar/tipos";
import type { ParametrosFecha } from "@/lib/reportes/fechas";
import { listarClientes, obtenerEstadoCuentaCliente } from "@/lib/reportes/ventas/v3/consultas";
import { calcularEstadoCuenta, filtrarDocumentos, resumirEstadoCuenta } from "@/lib/reportes/ventas/v3/estado-cuenta";
import {
  ETIQUETAS_VENCIMIENTO,
  parsearBusqueda,
  parsearCliente,
  parsearCorte,
  parsearVencimiento,
} from "@/lib/reportes/ventas/v3/parametros";
import type { ClienteOpcion, FiltroVencimiento } from "@/lib/reportes/ventas/v3/tipos";

import { AlertaError } from "../_components/alerta-error";
import { BotonDescargar } from "../_components/boton-descargar";
import { BotonImprimir } from "../_components/boton-imprimir";

const OPCIONES_VENCIMIENTO: FiltroVencimiento[] = ["todas", "sin-vencer", "1-30", "31-60", "61-90", "91-mas"];

export default async function Page({ searchParams }: { searchParams: Promise<ParametrosFecha> }) {
  const params = await searchParams;
  const corte = parsearCorte(params);
  const clienteId = parsearCliente(params);
  const vencimiento = parsearVencimiento(params);
  const documento = parsearBusqueda(params, "documento");

  const { filas: clientes, error: errorClientes } = await listarClientes();
  const estado = clienteId != null ? await obtenerEstadoCuentaCliente(clienteId, corte) : null;
  const documentos = estado != null ? calcularEstadoCuenta(estado.filas, corte) : [];
  const filtrados = filtrarDocumentos(documentos, vencimiento, documento);
  const totales = resumirEstadoCuenta(filtrados);
  const error = estado?.error ?? errorClientes;

  const clienteNombre = estado?.clienteNombre ?? clientes.find((cliente) => cliente.id === clienteId)?.nombre ?? null;

  const opciones: ClienteOpcion[] =
    clienteId != null && clienteNombre != null && !clientes.some((cliente) => cliente.id === clienteId)
      ? [...clientes, { id: clienteId, nombre: clienteNombre }]
      : clientes;

  const filas: FilaReporte[] = filtrados.map((fila) => ({
    celdas: {
      documento: fila.documento,
      creacion: fila.creacion,
      vencimiento: fila.vencimiento,
      antiguedad: fila.antiguedad,
      diasVencidos: fila.diasVencidos,
      estado: fila.estado,
      moneda: fila.moneda,
      total: fila.total,
      retenido: fila.retenido,
      cobrado: fila.cobrado,
      saldo: fila.saldo,
    },
  }));

  const tabla: TablaReporte = {
    titulo: "Estado de cuenta por cliente",
    subtitulo: `Cliente: ${clienteNombre ?? "—"} · Corte al ${corte}`,
    columnas: [
      { clave: "documento", titulo: "Documento", tipo: "texto" },
      { clave: "creacion", titulo: "Creación", tipo: "fecha" },
      { clave: "vencimiento", titulo: "Vencimiento", tipo: "fecha" },
      { clave: "antiguedad", titulo: "Antigüedad", tipo: "texto" },
      { clave: "diasVencidos", titulo: "Días vencidos", tipo: "texto" },
      { clave: "estado", titulo: "Estado", tipo: "texto" },
      { clave: "moneda", titulo: "Moneda", tipo: "texto" },
      { clave: "total", titulo: "Total", tipo: "dinero" },
      { clave: "retenido", titulo: "Retenido", tipo: "dinero" },
      { clave: "cobrado", titulo: "Cobrado", tipo: "dinero" },
      { clave: "saldo", titulo: "Saldo", tipo: "dinero" },
    ],
    filas,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Estado de cuenta por cliente</h1>
          <p className="text-muted-foreground text-sm">
            Facturas y saldos del cliente a la fecha de corte, con antigüedad y días vencidos.
          </p>
          <p className="text-muted-foreground text-sm">Corte al {formatoDia(corte)}</p>
        </div>
        <BotonImprimir />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cliente">Cliente *</Label>
            <NativeSelect id="cliente" name="cliente" defaultValue={clienteId ?? ""} className="w-60">
              <NativeSelectOption value="">Elige un cliente</NativeSelectOption>
              {opciones.map((cliente) => (
                <NativeSelectOption key={cliente.id} value={cliente.id}>
                  {cliente.nombre}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="corte">Corte al</Label>
            <Input id="corte" name="corte" type="date" defaultValue={corte} className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vencimiento">Estado de vencimiento</Label>
            <NativeSelect id="vencimiento" name="vencimiento" defaultValue={vencimiento} className="w-56">
              {OPCIONES_VENCIMIENTO.map((opcion) => (
                <NativeSelectOption key={opcion} value={opcion}>
                  {ETIQUETAS_VENCIMIENTO[opcion]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="documento">Buscar documento</Label>
            <Input
              id="documento"
              name="documento"
              type="search"
              defaultValue={documento}
              placeholder="Documento"
              className="w-48"
            />
          </div>
          <Button type="submit" variant="secondary">
            Aplicar
          </Button>
        </form>
        <div className="flex flex-wrap gap-2 print:hidden">
          {clienteId != null && clienteNombre != null ? (
            <Button variant="outline" render={<Link href={rutaContacto(clienteId)} />}>
              <UserRound />
              Ver ficha del cliente
            </Button>
          ) : null}
          <BotonDescargar tabla={tabla} nombreArchivo={`estado-cuenta-${corte}`} />
        </div>
      </div>

      {error ? <AlertaError mensaje={error} /> : null}

      {clienteId == null ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRound />
            </EmptyMedia>
            <EmptyTitle>Elige un cliente</EmptyTitle>
            <EmptyDescription>Selecciona un cliente y la fecha de corte para ver su estado de cuenta.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="flex flex-col gap-1">
                <p className="text-muted-foreground text-sm">Total en ventas</p>
                <p className="text-2xl font-semibold tabular-nums">{formatearRd(totales.totalVentas)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1">
                <p className="text-muted-foreground text-sm">Retenciones</p>
                <p className="text-2xl font-semibold tabular-nums">{formatearRd(totales.retenciones)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1">
                <p className="text-muted-foreground text-sm">Total cobrado</p>
                <p className="text-2xl font-semibold tabular-nums">{formatearRd(totales.totalCobrado)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1">
                <p className="text-muted-foreground text-sm">Saldo por cobrar</p>
                <p className="text-2xl font-semibold tabular-nums">{formatearRd(totales.saldoPorCobrar)}</p>
              </CardContent>
            </Card>
          </div>

          {filtrados.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>No encontramos documentos que coincidan con tu búsqueda</EmptyTitle>
                <EmptyDescription>Prueba con otro estado de vencimiento o revisa el documento.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Card className="py-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Creación</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead className="text-right">Antigüedad</TableHead>
                      <TableHead className="text-right">Días vencidos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Moneda</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Retenido</TableHead>
                      <TableHead className="text-right">Cobrado</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.map((fila) => (
                      <TableRow key={fila.facturaId}>
                        <TableCell>
                          <Link className="font-medium hover:underline" href={rutaFactura(fila.facturaId)}>
                            {fila.documento}
                          </Link>
                        </TableCell>
                        <TableCell>{formatoDia(fila.creacion)}</TableCell>
                        <TableCell>{formatoDia(fila.vencimiento)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fila.antiguedad}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fila.diasVencidos > 0 ? (
                            <span className="text-destructive">{fila.diasVencidos}</span>
                          ) : (
                            fila.diasVencidos
                          )}
                        </TableCell>
                        <TableCell>
                          {fila.estado === "Pendiente" ? (
                            <Badge>{fila.estado}</Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                            >
                              {fila.estado}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{fila.moneda}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatearRd(fila.total)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatearRd(fila.retenido)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatearRd(fila.cobrado)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatearRd(fila.saldo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
