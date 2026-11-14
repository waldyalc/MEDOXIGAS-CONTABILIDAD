"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import { SelectorContacto } from "@/components/contactos/selector-contacto";
import { DatePicker } from "@/components/date-picker";
import { type ProductoSeleccionable, SelectorProducto } from "@/components/productos/selector-producto";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { aNumero, calcularTotales, desdeCentavos } from "@/lib/compras/calculo";
import { hoyEnRd } from "@/lib/compras/fechas";
import { formatoMoneda } from "@/lib/compras/formato";
import { rutaOrdenCompra } from "@/lib/enlaces";
import { crearOrdenCompra } from "@/lib/ordenes-compra/acciones";
import { esquemaOrdenCompra } from "@/lib/ordenes-compra/esquema";
import type { OpcionesOrden } from "@/lib/ordenes-compra/tipos";

import { ComboboxCampo, type OpcionCombobox } from "../../../compras/_components/combobox-campo";

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

const OPCIONES_MODO = [
  { value: "producto", label: "Producto" },
  { value: "gasto", label: "Gasto" },
];

const OPCIONES_ITBIS = [
  { value: "18", label: "18 %" },
  { value: "16", label: "16 %" },
  { value: "0", label: "0 %" },
];

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

export function FormularioOrden({ contactos, productos, cuentasGasto }: OpcionesOrden) {
  const router = useRouter();
  const hoy = hoyEnRd();
  const [proveedorId, setProveedorId] = useState("");
  const [productosLocales, setProductosLocales] = useState<readonly ProductoSeleccionable[]>(productos);
  const [fecha, setFecha] = useState(hoy);
  const [fechaEntrega, setFechaEntrega] = useState(hoy);
  const [notas, setNotas] = useState("");
  const [terminos, setTerminos] = useState("");
  const [lineas, setLineas] = useState<LineaFormulario[]>([nuevaLinea()]);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

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
      itbisTasa: String(aNumero(producto.itbis_tasa)),
    });
  }

  function seleccionarCuenta(id: string, cuentaId: string) {
    const cuenta = cuentasGasto.find((item) => item.id === cuentaId);
    if (!cuenta) {
      actualizarLinea(id, { cuentaId: "" });
      return;
    }

    actualizarLinea(id, { cuentaId, productoId: "", descripcion: cuenta.nombre });
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
      fecha_entrega: fechaEntrega,
      notas,
      terminos,
      lineas: lineas.map((linea) => ({
        producto_id: linea.modo === "producto" ? linea.productoId : "",
        cuenta_id: linea.modo === "gasto" ? linea.cuentaId : "",
        descripcion: linea.descripcion,
        cantidad: aNumero(linea.cantidad),
        costo: aNumero(linea.costo),
        itbis_tasa: aNumero(linea.itbisTasa),
      })),
    };

    const validacion = esquemaOrdenCompra.safeParse(entrada);
    if (!validacion.success) {
      setError(validacion.error.issues[0]?.message ?? "Revisa los datos de la orden.");
      return;
    }

    iniciar(async () => {
      const resultado = await crearOrdenCompra(entrada);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(rutaOrdenCompra(resultado.id));
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
            render={<Link href="/dashboard/ordenes-compra" prefetch={false} />}
          >
            <ArrowLeft data-icon="inline-start" />
            Órdenes de compra
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Nueva orden de compra</h1>
        </div>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar orden"}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Datos de la orden</CardTitle>
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
            <DatePicker id="fecha" value={fecha} onChange={setFecha} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fecha-entrega">Fecha de entrega *</Label>
            <DatePicker id="fecha-entrega" value={fechaEntrega} onChange={setFechaEntrega} />
          </div>
          <Accordion className="sm:col-span-2">
            <AccordionItem value="mas" className="border-0">
              <AccordionTrigger>Más opciones</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="notas">Notas</Label>
                    <Textarea
                      id="notas"
                      value={notas}
                      onChange={(evento) => setNotas(evento.target.value)}
                      placeholder="Observaciones de la orden"
                      maxLength={500}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="terminos">Términos</Label>
                    <Textarea
                      id="terminos"
                      value={terminos}
                      onChange={(evento) => setTerminos(evento.target.value)}
                      placeholder="Condiciones de la compra"
                      maxLength={500}
                    />
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
            onClick={() => setLineas((actuales) => [...actuales, nuevaLinea()])}
          >
            <Plus data-icon="inline-start" />
            Agregar línea
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {lineas.map((linea, indice) => (
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
                  <Select
                    value={linea.modo}
                    items={OPCIONES_MODO}
                    onValueChange={(valor: string | null) => {
                      if (valor) cambiarModo(linea.id, valor === "gasto" ? "gasto" : "producto");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPCIONES_MODO.map((opcion) => (
                        <SelectItem key={opcion.value} value={opcion.value}>
                          {opcion.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <InputGroup>
                    <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                      RD$
                    </InputGroupAddon>
                    <InputGroupInput
                      inputMode="decimal"
                      value={linea.costo}
                      placeholder="0.00"
                      onChange={(evento) => actualizarLinea(linea.id, { costo: evento.target.value })}
                    />
                  </InputGroup>
                </div>
                <div className="flex flex-col gap-2 lg:col-span-1">
                  <Label className="text-muted-foreground text-xs">ITBIS</Label>
                  <Select
                    value={linea.itbisTasa}
                    items={OPCIONES_ITBIS}
                    onValueChange={(valor: string | null) => {
                      if (valor) actualizarLinea(linea.id, { itbisTasa: valor });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPCIONES_ITBIS.map((opcion) => (
                        <SelectItem key={opcion.value} value={opcion.value}>
                          {opcion.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2 lg:col-span-2">
                  <Label className="text-muted-foreground text-xs">Subtotal</Label>
                  <div className="flex h-8 items-center justify-end text-sm tabular-nums">
                    {formatoMoneda(aNumero(linea.cantidad) * aNumero(linea.costo))}
                  </div>
                </div>
              </div>
            </div>
          ))}
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
            {pendiente ? "Guardando…" : "Guardar orden"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
