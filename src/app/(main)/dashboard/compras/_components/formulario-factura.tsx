"use client";

import { useState, useTransition } from "react";

import Link from "next/link";

import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { crearFacturaProveedor } from "@/lib/compras/acciones";
import { aNumero, calcularLinea, calcularTotales, desdeCentavos } from "@/lib/compras/calculo";
import { esquemaFacturaProveedor } from "@/lib/compras/esquema";
import { hoyEnRd } from "@/lib/compras/fechas";
import { formatoMoneda } from "@/lib/compras/formato";
import type { OpcionesFactura } from "@/lib/compras/tipos";
import type { InicialFacturaDesdeOrden } from "@/lib/ordenes-compra/tipos";

import { ComboboxCampo, type OpcionCombobox } from "./combobox-campo";

type ModoLinea = "producto" | "gasto";

interface LineaFormulario {
  id: string;
  modo: ModoLinea;
  productoId: string;
  cuentaId: string;
  descripcion: string;
  cantidad: string;
  costo: string;
  itbisTasa: string;
}

let contadorLineas = 0;

function nuevaLinea(): LineaFormulario {
  contadorLineas += 1;
  return {
    id: `linea-${contadorLineas}`,
    modo: "producto",
    productoId: "",
    cuentaId: "",
    descripcion: "",
    cantidad: "1",
    costo: "",
    itbisTasa: "18",
  };
}

function lineaDesdeInicial(linea: InicialFacturaDesdeOrden["lineas"][number]): LineaFormulario {
  contadorLineas += 1;
  return {
    id: `linea-${contadorLineas}`,
    modo: linea.producto_id ? "producto" : "gasto",
    productoId: linea.producto_id,
    cuentaId: linea.cuenta_id,
    descripcion: linea.descripcion,
    cantidad: String(linea.cantidad),
    costo: String(linea.costo),
    itbisTasa: String(linea.itbis_tasa),
  };
}

interface Props extends OpcionesFactura {
  inicial?: InicialFacturaDesdeOrden;
  ordenId?: string;
  numeroOrden?: number;
}

export function FormularioFactura({ contactos, productos, cuentasGasto, inicial, ordenId, numeroOrden }: Props) {
  const hoy = hoyEnRd();
  const [proveedorId, setProveedorId] = useState(inicial?.contacto_id ?? "");
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoy);
  const [vencimiento, setVencimiento] = useState(inicial?.vencimiento ?? hoy);
  const [ncf, setNcf] = useState(inicial?.ncf ?? "");
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  const [lineas, setLineas] = useState<LineaFormulario[]>(() =>
    inicial && inicial.lineas.length > 0 ? inicial.lineas.map(lineaDesdeInicial) : [nuevaLinea()],
  );
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const opcionesContactos: OpcionCombobox[] = contactos.map((contacto) => ({
    value: contacto.id,
    label: contacto.nombre,
    hint: contacto.rnc_cedula ?? undefined,
  }));

  const opcionesProductos: OpcionCombobox[] = productos.map((producto) => ({
    value: producto.id,
    label: producto.nombre,
    hint: `ITBIS ${aNumero(producto.itbis_tasa)} %`,
  }));

  const opcionesGastos: OpcionCombobox[] = cuentasGasto.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} ${cuenta.nombre}`,
  }));

  const totales = calcularTotales(
    lineas.map((linea) => ({ cantidad: linea.cantidad, costo: linea.costo, itbisTasa: linea.itbisTasa })),
  );

  function actualizarLinea(id: string, cambios: Partial<LineaFormulario>) {
    setLineas((actuales) => actuales.map((linea) => (linea.id === id ? { ...linea, ...cambios } : linea)));
  }

  function cambiarModo(id: string, modo: ModoLinea) {
    actualizarLinea(id, { modo, productoId: "", cuentaId: "", descripcion: "" });
  }

  function seleccionarProducto(id: string, productoId: string) {
    const producto = productos.find((item) => item.id === productoId);
    if (!producto) {
      actualizarLinea(id, { productoId: "" });
      return;
    }

    actualizarLinea(id, {
      productoId,
      cuentaId: "",
      descripcion: producto.nombre,
      costo: String(aNumero(producto.costo)),
      itbisTasa: String(aNumero(producto.itbis_tasa)),
    });
  }

  function seleccionarCuenta(id: string, cuentaId: string) {
    const cuenta = cuentasGasto.find((item) => item.id === cuentaId);
    if (!cuenta) {
      actualizarLinea(id, { cuentaId: "" });
      return;
    }

    actualizarLinea(id, {
      cuentaId,
      productoId: "",
      descripcion: cuenta.nombre,
    });
  }

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    if (!proveedorId) {
      setError("Selecciona un proveedor.");
      return;
    }

    const lineaIncompleta = lineas.some(
      (linea) => (linea.modo === "producto" && !linea.productoId) || (linea.modo === "gasto" && !linea.cuentaId),
    );
    if (lineaIncompleta) {
      setError("Selecciona un producto o una cuenta de gasto en cada línea.");
      return;
    }

    const entrada = {
      contacto_id: proveedorId,
      fecha,
      vencimiento,
      ncf,
      notas,
      lineas: lineas.map((linea) => ({
        producto_id: linea.modo === "producto" ? linea.productoId : "",
        cuenta_id: linea.modo === "gasto" ? linea.cuentaId : "",
        descripcion: linea.descripcion,
        cantidad: aNumero(linea.cantidad),
        costo: aNumero(linea.costo),
        itbis_tasa: aNumero(linea.itbisTasa),
      })),
    };

    const validacion = esquemaFacturaProveedor.safeParse(entrada);
    if (!validacion.success) {
      setError(validacion.error.issues[0]?.message ?? "Revisa los datos de la factura.");
      return;
    }

    iniciar(async () => {
      const resultado = await crearFacturaProveedor(entrada, ordenId);
      if (!resultado.ok) setError(resultado.error);
    });
  }

  return (
    <form onSubmit={enviar} className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            render={<Link href="/dashboard/compras" prefetch={false} />}
          >
            <ArrowLeft data-icon="inline-start" />
            Compras
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Nueva factura de proveedor</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" type="button" render={<Link href="/dashboard/compras/pagos" prefetch={false} />}>
            Pagos
          </Button>
          <Button type="submit" disabled={pendiente}>
            {pendiente ? "Guardando…" : "Guardar factura"}
          </Button>
        </div>
      </div>

      {numeroOrden ? (
        <Alert>
          <AlertDescription>
            Datos tomados de la orden de compra #{numeroOrden}. Al guardar, la orden queda convertida.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Datos de la factura</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="proveedor">Proveedor *</Label>
            <ComboboxCampo
              id="proveedor"
              opciones={opcionesContactos}
              valor={proveedorId}
              onCambio={setProveedorId}
              placeholder="Buscar proveedor…"
              vacio="No hay proveedores registrados."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fecha">Fecha *</Label>
            <Input id="fecha" type="date" value={fecha} onChange={(evento) => setFecha(evento.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vencimiento">Vencimiento *</Label>
            <Input
              id="vencimiento"
              type="date"
              value={vencimiento}
              onChange={(evento) => setVencimiento(evento.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="ncf">No. / NCF del proveedor (opcional)</Label>
            <Input
              id="ncf"
              value={ncf}
              onChange={(evento) => setNcf(evento.target.value)}
              placeholder="B0100000001"
              maxLength={20}
            />
          </div>
          <Accordion className="sm:col-span-2">
            <AccordionItem value="mas" className="border-0">
              <AccordionTrigger>Más opciones</AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="notas">Notas</Label>
                  <Textarea
                    id="notas"
                    value={notas}
                    onChange={(evento) => setNotas(evento.target.value)}
                    placeholder="Observaciones de la compra"
                    maxLength={500}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Líneas</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLineas((actuales) => [...actuales, nuevaLinea()])}
          >
            <Plus data-icon="inline-start" />
            Agregar línea
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {lineas.map((linea, indice) => {
            const calculo = calcularLinea({
              cantidad: linea.cantidad,
              costo: linea.costo,
              itbisTasa: linea.itbisTasa,
            });

            return (
              <div key={linea.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium">Línea {indice + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Quitar línea"
                    disabled={lineas.length === 1}
                    onClick={() => setLineas((actuales) => actuales.filter((item) => item.id !== linea.id))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                  <div className="flex flex-col gap-2 lg:col-span-2">
                    <Label className="text-muted-foreground text-xs">Tipo</Label>
                    <NativeSelect
                      value={linea.modo}
                      onChange={(evento) =>
                        cambiarModo(linea.id, evento.target.value === "gasto" ? "gasto" : "producto")
                      }
                      className="w-full"
                    >
                      <option value="producto">Producto</option>
                      <option value="gasto">Gasto</option>
                    </NativeSelect>
                  </div>
                  <div className="flex flex-col gap-2 lg:col-span-4">
                    <Label className="text-muted-foreground text-xs">
                      {linea.modo === "producto" ? "Producto" : "Cuenta de gasto"}
                    </Label>
                    {linea.modo === "producto" ? (
                      <ComboboxCampo
                        opciones={opcionesProductos}
                        valor={linea.productoId}
                        onCambio={(valor) => seleccionarProducto(linea.id, valor)}
                        placeholder="Buscar producto…"
                        vacio="No hay productos registrados."
                      />
                    ) : (
                      <ComboboxCampo
                        opciones={opcionesGastos}
                        valor={linea.cuentaId}
                        onCambio={(valor) => seleccionarCuenta(linea.id, valor)}
                        placeholder="Buscar cuenta…"
                        vacio="No hay cuentas de gasto."
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-2 lg:col-span-1">
                    <Label className="text-muted-foreground text-xs">Cantidad</Label>
                    <Input
                      inputMode="decimal"
                      value={linea.cantidad}
                      onChange={(evento) => actualizarLinea(linea.id, { cantidad: evento.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2 lg:col-span-2">
                    <Label className="text-muted-foreground text-xs">Costo</Label>
                    <Input
                      inputMode="decimal"
                      value={linea.costo}
                      placeholder="0.00"
                      onChange={(evento) => actualizarLinea(linea.id, { costo: evento.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2 lg:col-span-1">
                    <Label className="text-muted-foreground text-xs">ITBIS %</Label>
                    <NativeSelect
                      value={linea.itbisTasa}
                      onChange={(evento) => actualizarLinea(linea.id, { itbisTasa: evento.target.value })}
                      className="w-full"
                    >
                      <option value="18">18</option>
                      <option value="16">16</option>
                      <option value="0">0</option>
                    </NativeSelect>
                  </div>
                  <div className="flex flex-col gap-2 lg:col-span-2">
                    <Label className="text-muted-foreground text-xs">Subtotal</Label>
                    <div className="flex h-8 items-center justify-end text-sm tabular-nums">
                      {formatoMoneda(desdeCentavos(calculo.subtotalCentavos))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="mx-auto flex w-full max-w-sm flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatoMoneda(desdeCentavos(totales.subtotalCentavos))}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">ITBIS</span>
            <span className="tabular-nums">{formatoMoneda(desdeCentavos(totales.itbisCentavos))}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatoMoneda(desdeCentavos(totales.totalCentavos))}</span>
          </div>
          <Button type="submit" className="mt-2" disabled={pendiente}>
            {pendiente ? "Guardando…" : "Guardar factura"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
