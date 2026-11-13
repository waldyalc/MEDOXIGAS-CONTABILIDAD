"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import { Enlace } from "@/components/enlace";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { aNumero, calcularLinea, calcularTotales, desdeCentavos } from "@/lib/compras/calculo";
import { formatoCantidad, formatoMoneda } from "@/lib/compras/formato";
import { crearNotaCreditoCompra } from "@/lib/compras/notas-credito/acciones";
import type { DatosFormularioNotaCompra } from "@/lib/compras/notas-credito/tipos";
import { rutaCompra, rutaNotaCreditoCompra } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";

interface Props {
  datos: DatosFormularioNotaCompra;
  fechaHoy: string;
}

function excedePendiente(cantidad: number, pendiente: number) {
  return Math.round(cantidad * 100) > Math.round(pendiente * 100);
}

export function NotaCreditoCompraForm({ datos, fechaHoy }: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [fecha, setFecha] = useState(fechaHoy);
  const [ncf, setNcf] = useState("");
  const [notas, setNotas] = useState("");
  const [devuelveInventario, setDevuelveInventario] = useState(true);
  const [cantidades, setCantidades] = useState<Record<string, string>>(() =>
    Object.fromEntries(datos.lineas.map((linea) => [linea.id, "0"])),
  );
  const [error, setError] = useState<string | null>(null);

  const calculadas = datos.lineas.map((linea) => {
    const cantidad = aNumero(cantidades[linea.id] ?? "");
    return {
      linea,
      cantidad,
      calculo: calcularLinea({
        cantidad,
        costo: linea.costo,
        itbisTasa: linea.itbis_tasa,
      }),
    };
  });
  const totales = calcularTotales(
    calculadas.map((item) => ({
      cantidad: item.cantidad,
      costo: item.linea.costo,
      itbisTasa: item.linea.itbis_tasa,
    })),
  );
  const saldo = datos.factura.total - datos.factura.pagado - datos.factura.credito;

  function cambiarCantidad(id: string, valor: string) {
    setCantidades((actuales) => ({ ...actuales, [id]: valor }));
  }

  function guardar() {
    setError(null);

    const seleccionadas = calculadas.filter((item) => item.cantidad > 0);
    if (seleccionadas.length === 0) {
      setError("Indica al menos una cantidad a devolver.");
      return;
    }

    const excedida = seleccionadas.find((item) => excedePendiente(item.cantidad, item.linea.pendiente));
    if (excedida) {
      setError(
        `La cantidad de "${excedida.linea.descripcion}" supera lo pendiente (${formatoCantidad(excedida.linea.pendiente)}).`,
      );
      return;
    }

    iniciar(async () => {
      const resultado = await crearNotaCreditoCompra({
        factura_proveedor_id: datos.factura.id,
        fecha,
        ncf: ncf.trim() || undefined,
        notas: notas.trim() || undefined,
        devuelve_inventario: devuelveInventario,
        lineas: seleccionadas.map((item) => ({
          factura_proveedor_linea_id: item.linea.id,
          cantidad: item.cantidad,
          pendiente: item.linea.pendiente,
        })),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(rutaNotaCreditoCompra(resultado.id));
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Factura de proveedor #{datos.factura.numero}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <p>
              <span className="text-muted-foreground">NCF: </span>
              <span className="font-mono">{datos.factura.ncf ?? "—"}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Proveedor: </span>
              {datos.factura.proveedor_nombre}
            </p>
            <p>
              <span className="text-muted-foreground">Fecha: </span>
              {formatoDia(datos.factura.fecha)}
            </p>
          </div>
          <div className="flex flex-col gap-1 md:items-end">
            <p>
              <span className="text-muted-foreground">Total factura: </span>
              {formatoMoneda(datos.factura.total)}
            </p>
            <p>
              <span className="text-muted-foreground">Crédito aplicado: </span>
              {formatoMoneda(datos.factura.credito)}
            </p>
            <p>
              <span className="text-muted-foreground">Saldo: </span>
              <span className="font-medium">{formatoMoneda(saldo)}</span>
            </p>
            <Enlace href={rutaCompra(datos.factura.id)}>Ver factura de proveedor</Enlace>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la nota</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ncf">NCF del proveedor (B04)</Label>
            <Input
              id="ncf"
              className="font-mono"
              maxLength={13}
              placeholder="B0400000001"
              value={ncf}
              onChange={(evento) => setNcf(evento.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Opcional. Lo emite el proveedor; no consume nuestra numeración.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fecha">Fecha *</Label>
            <DatePicker id="fecha" value={fecha} onChange={setFecha} />
          </div>
          <div className="flex items-start gap-2 pt-6">
            <Checkbox
              id="devuelve-inventario"
              checked={devuelveInventario}
              onCheckedChange={(valor) => setDevuelveInventario(valor)}
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor="devuelve-inventario">Devuelve inventario</Label>
              <p className="text-muted-foreground text-xs">
                Saca las cantidades del inventario y recalcula el costo promedio.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              placeholder="Motivo o detalle de la devolución (opcional)"
              value={notas}
              onChange={(evento) => setNotas(evento.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Líneas a acreditar</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Comprada</TableHead>
                <TableHead className="text-right">Acreditada</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="w-28 text-right">A devolver</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculadas.map((item) => (
                <TableRow key={item.linea.id}>
                  <TableCell className="font-medium">{item.linea.descripcion}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoCantidad(item.linea.cantidad)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoCantidad(item.linea.acreditado)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoCantidad(item.linea.pendiente)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoMoneda(item.linea.costo)}</TableCell>
                  <TableCell>
                    <Input
                      className="text-right"
                      inputMode="decimal"
                      aria-label={`Cantidad a devolver de ${item.linea.descripcion}`}
                      value={cantidades[item.linea.id] ?? "0"}
                      disabled={item.linea.pendiente <= 0}
                      onChange={(evento) => cambiarCantidad(item.linea.id, evento.target.value)}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatoMoneda(desdeCentavos(item.calculo.totalCentavos))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <div className="bg-muted/50 flex w-full flex-col gap-2 rounded-xl p-4 text-sm md:w-80">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatoMoneda(desdeCentavos(totales.subtotalCentavos))}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">ITBIS</span>
            <span>{formatoMoneda(desdeCentavos(totales.itbisCentavos))}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
            <span>Total nota</span>
            <span>{formatoMoneda(desdeCentavos(totales.totalCentavos))}</span>
          </div>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" render={<Link href={rutaCompra(datos.factura.id)} />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Crear nota de crédito
        </Button>
      </div>
    </form>
  );
}
