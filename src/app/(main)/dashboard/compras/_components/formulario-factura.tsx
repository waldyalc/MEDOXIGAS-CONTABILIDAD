"use client";

import { useState, useTransition } from "react";

import Link from "next/link";

import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import { SelectorContacto } from "@/components/contactos/selector-contacto";
import { type ProductoSeleccionable, SelectorProducto } from "@/components/productos/selector-producto";
import { SelectCampo } from "@/components/select-campo";
import { SelectorImpuesto } from "@/components/selector-impuesto";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { crearFacturaProveedor } from "@/lib/compras/acciones";
import { aNumero, calcularLinea, calcularTotales, desdeCentavos } from "@/lib/compras/calculo";
import { esquemaFacturaProveedor } from "@/lib/compras/esquema";
import { hoyEnRd } from "@/lib/compras/fechas";
import { formatoMoneda } from "@/lib/compras/formato";
import type { OpcionesFactura } from "@/lib/compras/tipos";
import { impuestoNinguno } from "@/lib/impuestos/tipos";
import type { InicialFacturaDesdeOrden } from "@/lib/ordenes-compra/tipos";

import { ComboboxCampo, type OpcionCombobox } from "./combobox-campo";

type ModoLinea = "producto" | "gasto";

const SIN_CENTRO = "__ninguno";

interface LineaFormulario {
  id: string;
  modo: ModoLinea;
  productoId: string;
  cuentaId: string;
  descripcion: string;
  cantidad: string;
  costo: string;
  impuestoId: string;
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
    impuestoId: "",
    itbisTasa: "0",
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
    impuestoId: linea.impuesto_id ?? "",
    itbisTasa: String(linea.itbis_tasa),
  };
}

interface Props extends OpcionesFactura {
  inicial?: InicialFacturaDesdeOrden;
  ordenId?: string;
  numeroOrden?: number;
}

export function FormularioFactura({
  contactos,
  productos,
  cuentasGasto,
  centrosCosto,
  almacenes,
  impuestos,
  inicial,
  ordenId,
  numeroOrden,
}: Props) {
  const hoy = hoyEnRd();
  const [proveedorId, setProveedorId] = useState(inicial?.contacto_id ?? "");
  const [productosLocales, setProductosLocales] = useState<readonly ProductoSeleccionable[]>(productos);
  const [almacenId, setAlmacenId] = useState(almacenes.find((item) => item.es_principal)?.id ?? almacenes[0]?.id ?? "");
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoy);
  const [vencimiento, setVencimiento] = useState(inicial?.vencimiento ?? hoy);
  const [ncf, setNcf] = useState(inicial?.ncf ?? "");
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  const [centroCostoId, setCentroCostoId] = useState("");
  const [lineas, setLineas] = useState<LineaFormulario[]>(() =>
    inicial && inicial.lineas.length > 0
      ? inicial.lineas.map(lineaDesdeInicial)
      : [{ ...nuevaLinea(), impuestoId: impuestoNinguno(impuestos)?.id ?? "" }],
  );
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const opcionesGastos: OpcionCombobox[] = cuentasGasto.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} ${cuenta.nombre}`,
  }));

  const opcionesCentros = [
    { value: SIN_CENTRO, label: "Sin centro de costo" },
    ...centrosCosto.map((centro) => ({ value: centro.id, label: `${centro.codigo} · ${centro.nombre}` })),
  ];

  const totales = calcularTotales(
    lineas.map((linea) => ({ cantidad: linea.cantidad, costo: linea.costo, itbisTasa: linea.itbisTasa })),
  );

  function actualizarLinea(id: string, cambios: Partial<LineaFormulario>) {
    setLineas((actuales) => actuales.map((linea) => (linea.id === id ? { ...linea, ...cambios } : linea)));
  }

  function cambiarModo(id: string, modo: ModoLinea) {
    actualizarLinea(id, { modo, productoId: "", cuentaId: "", descripcion: "" });
  }

  function seleccionarProducto(id: string, producto: ProductoSeleccionable | null) {
    if (!producto) {
      actualizarLinea(id, { productoId: "" });
      return;
    }

    setProductosLocales((actuales) =>
      actuales.some((item) => item.id === producto.id) ? actuales : [...actuales, producto],
    );
    actualizarLinea(id, {
      productoId: producto.id,
      cuentaId: "",
      descripcion: producto.nombre,
      costo: String(aNumero(producto.costo)),
      impuestoId: producto.impuesto_id ?? "",
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
      almacen_id: almacenId,
      ncf,
      notas,
      ...(centroCostoId ? { centro_costo_id: centroCostoId } : {}),
      lineas: lineas.map((linea) => ({
        producto_id: linea.modo === "producto" ? linea.productoId : "",
        cuenta_id: linea.modo === "gasto" ? linea.cuentaId : "",
        descripcion: linea.descripcion,
        cantidad: aNumero(linea.cantidad),
        costo: aNumero(linea.costo),
        itbis_tasa: aNumero(linea.itbisTasa),
        impuesto_id: linea.impuestoId || undefined,
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
            <SelectorContacto
              id="proveedor"
              contactos={contactos}
              valor={proveedorId}
              onCambio={(contacto) => setProveedorId(contacto?.id ?? "")}
              tipoInicial="proveedor"
              placeholder="Buscar proveedor…"
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="almacen">Almacén</Label>
                    <SelectCampo
                      id="almacen"
                      opciones={almacenes.map((almacen) => ({
                        value: almacen.id,
                        label: almacen.es_principal ? `${almacen.nombre} (principal)` : almacen.nombre,
                      }))}
                      valor={almacenId}
                      onCambio={setAlmacenId}
                    />
                  </div>
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
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="centro-costo">Centro de costo</Label>
                    <Select
                      items={opcionesCentros}
                      value={centroCostoId || SIN_CENTRO}
                      onValueChange={(valor: string | null) =>
                        setCentroCostoId(valor == null || valor === SIN_CENTRO ? "" : valor)
                      }
                    >
                      <SelectTrigger id="centro-costo" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {opcionesCentros.map((opcion) => (
                          <SelectItem key={opcion.value} value={opcion.value}>
                            {opcion.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
            onClick={() =>
              setLineas((actuales) => [
                ...actuales,
                { ...nuevaLinea(), impuestoId: impuestoNinguno(impuestos)?.id ?? "" },
              ])
            }
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
                    <SelectCampo
                      opciones={[
                        { value: "producto", label: "Producto" },
                        { value: "gasto", label: "Gasto" },
                      ]}
                      valor={linea.modo}
                      onCambio={(valor) => cambiarModo(linea.id, valor === "gasto" ? "gasto" : "producto")}
                    />
                  </div>
                  <div className="flex flex-col gap-2 lg:col-span-4">
                    <Label className="text-muted-foreground text-xs">
                      {linea.modo === "producto" ? "Producto" : "Cuenta de gasto"}
                    </Label>
                    {linea.modo === "producto" ? (
                      <SelectorProducto
                        productos={productosLocales}
                        valor={linea.productoId}
                        onCambio={(producto) => seleccionarProducto(linea.id, producto)}
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
                    <Label className="text-muted-foreground text-xs">Impuesto</Label>
                    <SelectorImpuesto
                      className="w-full"
                      impuestos={impuestos}
                      value={linea.impuestoId}
                      onValueChange={(impuestoId) => {
                        const impuesto = impuestos.find((item) => item.id === impuestoId);
                        actualizarLinea(linea.id, {
                          impuestoId,
                          itbisTasa: String(impuesto?.tarifa ?? 0),
                        });
                      }}
                    />
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
            <span className="text-muted-foreground">Impuestos</span>
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
