"use client";

import { useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { crearFactura } from "@/lib/facturacion/acciones";
import {
  calcularLinea,
  calcularTotales,
  centavosAValor,
  parsearCantidad,
  parsearCentavos,
} from "@/lib/facturacion/calculo";
import { esTipoComprobante, OPCIONES_TIPO_COMPROBANTE } from "@/lib/facturacion/comprobantes";
import { formatoMoneda, formatoMonedaCentavos } from "@/lib/facturacion/formato";
import type {
  ContactoResumen,
  CuentaCajaBanco,
  Empresa,
  ProductoResumen,
  TipoComprobante,
} from "@/lib/facturacion/tipos";
import type { MetodoPago } from "@/lib/pagos/tipos";

interface LineaForm {
  clave: string;
  productoId: string;
  cantidad: string;
  precio: string;
  descuentoPct: string;
  itbisTasa: string;
}

interface Props {
  empresa: Empresa | null;
  contactos: ContactoResumen[];
  productos: ProductoResumen[];
  cuentas: CuentaCajaBanco[];
  fechaHoy: string;
}

function lineaVacia(clave: string): LineaForm {
  return { clave, productoId: "", cantidad: "1", precio: "0.00", descuentoPct: "0", itbisTasa: "18" };
}

function numero(texto: string): number {
  const valor = Number(texto);
  return Number.isFinite(valor) ? valor : 0;
}

export function FacturaForm({ empresa, contactos, productos, cuentas, fechaHoy }: Props) {
  const router = useRouter();
  const contador = useRef(1);
  const [pendiente, iniciar] = useTransition();

  const [tipo, setTipo] = useState<TipoComprobante>("02");
  const [clienteId, setClienteId] = useState("");
  const [fecha, setFecha] = useState(fechaHoy);
  const [vencimiento, setVencimiento] = useState(fechaHoy);
  const [lineas, setLineas] = useState<LineaForm[]>([lineaVacia("l1")]);
  const [notas, setNotas] = useState("");
  const [terminos, setTerminos] = useState("");
  const [pie, setPie] = useState("");
  const [registrarPago, setRegistrarPago] = useState(false);
  const [cuentaPago, setCuentaPago] = useState(
    cuentas.find((cuenta) => cuenta.codigo === "1101")?.id ?? cuentas[0]?.id ?? "",
  );
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [error, setError] = useState<string | null>(null);

  const clientesItems = contactos.map((contacto) => ({ value: contacto.id, label: contacto.nombre }));
  const productosItems = productos.map((producto) => ({ value: producto.id, label: producto.nombre }));

  const calculadas = lineas.map((linea) => ({
    clave: linea.clave,
    calculo: calcularLinea({
      cantidad: parsearCantidad(linea.cantidad),
      precioCentavos: parsearCentavos(linea.precio) ?? 0,
      descuentoPct: numero(linea.descuentoPct),
      itbisTasa: numero(linea.itbisTasa),
    }),
  }));
  const totales = calcularTotales(calculadas.map((linea) => linea.calculo));

  function actualizarLinea(clave: string, cambios: Partial<LineaForm>) {
    setLineas((actuales) => actuales.map((linea) => (linea.clave === clave ? { ...linea, ...cambios } : linea)));
  }

  function seleccionarProducto(clave: string, productoId: string) {
    const producto = productos.find((item) => item.id === productoId);
    actualizarLinea(clave, {
      productoId,
      ...(producto ? { precio: producto.precio.toFixed(2), itbisTasa: String(producto.itbis_tasa) } : {}),
    });
  }

  function agregarLinea() {
    contador.current += 1;
    setLineas((actuales) => [...actuales, lineaVacia(`l${contador.current}`)]);
  }

  function quitarLinea(clave: string) {
    setLineas((actuales) => (actuales.length > 1 ? actuales.filter((linea) => linea.clave !== clave) : actuales));
  }

  function guardar() {
    setError(null);

    if (!clienteId) {
      setError("Selecciona un cliente.");
      return;
    }
    if (lineas.some((linea) => !linea.productoId)) {
      setError("Selecciona el producto en todas las líneas.");
      return;
    }
    if (totales.totalCentavos <= 0) {
      setError("El total de la factura debe ser mayor que cero.");
      return;
    }
    if (registrarPago && !cuentaPago) {
      setError("Selecciona la cuenta de caja o banco para el pago.");
      return;
    }

    const payloadLineas = lineas.map((linea) => {
      const producto = productos.find((item) => item.id === linea.productoId);
      return {
        producto_id: linea.productoId,
        descripcion: producto?.nombre ?? "",
        cantidad: parsearCantidad(linea.cantidad),
        precio: centavosAValor(parsearCentavos(linea.precio) ?? 0),
        descuento_pct: numero(linea.descuentoPct),
        itbis_tasa: numero(linea.itbisTasa),
      };
    });

    iniciar(async () => {
      const resultado = await crearFactura({
        tipo_comprobante: tipo,
        contacto_id: clienteId,
        fecha,
        vencimiento,
        notas: notas.trim() || undefined,
        terminos: terminos.trim() || undefined,
        pie: pie.trim() || undefined,
        lineas: payloadLineas,
        pago: registrarPago
          ? {
              cuenta_id: cuentaPago,
              metodo: metodoPago,
              monto: centavosAValor(totales.totalCentavos),
            }
          : undefined,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(`/dashboard/facturacion/${resultado.id}`);
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
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <p className="font-heading text-lg font-medium">{empresa?.nombre ?? "MEDOXIGAS ALC, SRL"}</p>
            {empresa?.rnc ? <p className="text-muted-foreground text-sm">RNC {empresa.rnc}</p> : null}
            {empresa?.direccion ? <p className="text-muted-foreground text-sm">{empresa.direccion}</p> : null}
            {empresa?.telefono ? <p className="text-muted-foreground text-sm">Tel. {empresa.telefono}</p> : null}
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <Label htmlFor="tipo-comprobante">Tipo de comprobante</Label>
            <NativeSelect
              id="tipo-comprobante"
              className="w-full md:w-64"
              value={tipo}
              onChange={(evento) => setTipo(esTipoComprobante(evento.target.value) ? evento.target.value : "02")}
            >
              {OPCIONES_TIPO_COMPROBANTE.map((opcion) => (
                <NativeSelectOption key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p className="text-muted-foreground text-xs">El NCF se asigna al guardar.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos generales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cliente">Cliente *</Label>
            <Combobox
              items={clientesItems}
              onValueChange={(item: { value: string; label: string } | null) => setClienteId(item?.value ?? "")}
            >
              <ComboboxInput id="cliente" className="w-full" placeholder="Buscar cliente…" showClear />
              <ComboboxContent>
                <ComboboxEmpty>Sin resultados</ComboboxEmpty>
                <ComboboxList>
                  {(item: { value: string; label: string }) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fecha">Fecha *</Label>
            <Input id="fecha" type="date" required value={fecha} onChange={(evento) => setFecha(evento.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vencimiento">Vencimiento *</Label>
            <Input
              id="vencimiento"
              type="date"
              required
              value={vencimiento}
              onChange={(evento) => setVencimiento(evento.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Líneas</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={agregarLinea}>
            <Plus />
            Agregar línea
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {lineas.map((linea, indice) => {
            const calculo = calculadas.find((item) => item.clave === linea.clave)?.calculo;
            return (
              <div
                key={linea.clave}
                className="grid grid-cols-12 items-end gap-2 rounded-lg border p-2 md:border-0 md:p-0"
              >
                <div className="col-span-12 flex flex-col gap-1.5 md:col-span-4">
                  <Label className="text-muted-foreground text-xs" htmlFor={`producto-${linea.clave}`}>
                    Producto {indice === 0 ? "*" : null}
                  </Label>
                  <Combobox
                    items={productosItems}
                    onValueChange={(item: { value: string; label: string } | null) =>
                      seleccionarProducto(linea.clave, item?.value ?? "")
                    }
                  >
                    <ComboboxInput id={`producto-${linea.clave}`} className="w-full" placeholder="Buscar producto…" />
                    <ComboboxContent>
                      <ComboboxEmpty>Sin productos</ComboboxEmpty>
                      <ComboboxList>
                        {(item: { value: string; label: string }) => (
                          <ComboboxItem key={item.value} value={item}>
                            {item.label}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>
                <div className="col-span-3 flex flex-col gap-1.5 md:col-span-1">
                  <Label className="text-muted-foreground text-xs" htmlFor={`cantidad-${linea.clave}`}>
                    Cantidad
                  </Label>
                  <Input
                    id={`cantidad-${linea.clave}`}
                    inputMode="decimal"
                    value={linea.cantidad}
                    onChange={(evento) => actualizarLinea(linea.clave, { cantidad: evento.target.value })}
                  />
                </div>
                <div className="col-span-3 flex flex-col gap-1.5 md:col-span-2">
                  <Label className="text-muted-foreground text-xs" htmlFor={`precio-${linea.clave}`}>
                    Precio
                  </Label>
                  <Input
                    id={`precio-${linea.clave}`}
                    inputMode="decimal"
                    value={linea.precio}
                    onChange={(evento) => actualizarLinea(linea.clave, { precio: evento.target.value })}
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
                  <Label className="text-muted-foreground text-xs" htmlFor={`descuento-${linea.clave}`}>
                    Desc %
                  </Label>
                  <Input
                    id={`descuento-${linea.clave}`}
                    inputMode="decimal"
                    value={linea.descuentoPct}
                    onChange={(evento) => actualizarLinea(linea.clave, { descuentoPct: evento.target.value })}
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
                  <Label className="text-muted-foreground text-xs" htmlFor={`itbis-${linea.clave}`}>
                    ITBIS %
                  </Label>
                  <NativeSelect
                    id={`itbis-${linea.clave}`}
                    className="w-full"
                    value={linea.itbisTasa}
                    onChange={(evento) => actualizarLinea(linea.clave, { itbisTasa: evento.target.value })}
                  >
                    <NativeSelectOption value="0">0 %</NativeSelectOption>
                    <NativeSelectOption value="16">16 %</NativeSelectOption>
                    <NativeSelectOption value="18">18 %</NativeSelectOption>
                  </NativeSelect>
                </div>
                <div className="col-span-10 flex flex-col items-end gap-1.5 md:col-span-2">
                  <span className="text-muted-foreground text-xs">Total</span>
                  <span className="flex h-8 items-center font-medium">
                    {formatoMonedaCentavos(calculo?.totalCentavos ?? 0)}
                  </span>
                </div>
                <div className="col-span-2 flex justify-end md:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={lineas.length === 1}
                    onClick={() => quitarLinea(linea.clave)}
                  >
                    <Trash2 />
                    <span className="sr-only">Quitar línea</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Opciones</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium">
                Notas
                <ChevronDown className="size-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pb-3">
                <Textarea
                  value={notas}
                  placeholder="Notas internas o para el cliente"
                  onChange={(evento) => setNotas(evento.target.value)}
                />
              </CollapsibleContent>
            </Collapsible>
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium">
                Términos
                <ChevronDown className="size-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pb-3">
                <Textarea
                  value={terminos}
                  placeholder="Condiciones de pago"
                  onChange={(evento) => setTerminos(evento.target.value)}
                />
              </CollapsibleContent>
            </Collapsible>
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium">
                Pie
                <ChevronDown className="size-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pb-3">
                <Textarea
                  value={pie}
                  placeholder="Texto al pie de la factura"
                  onChange={(evento) => setPie(evento.target.value)}
                />
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        <div className="flex w-full flex-col gap-3 md:w-80">
          <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatoMonedaCentavos(totales.subtotalCentavos)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Descuento</span>
              <span>{formatoMonedaCentavos(totales.descuentoCentavos)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">ITBIS</span>
              <span>{formatoMonedaCentavos(totales.itbisCentavos)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span>{formatoMonedaCentavos(totales.totalCentavos)}</span>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="registrar-pago"
              checked={registrarPago}
              onCheckedChange={(valor) => setRegistrarPago(valor)}
            />
            <Label htmlFor="registrar-pago">Registrar pago recibido</Label>
          </div>
          {registrarPago ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cuenta-pago">Cuenta</Label>
                <NativeSelect
                  id="cuenta-pago"
                  className="w-full"
                  value={cuentaPago}
                  onChange={(evento) => setCuentaPago(evento.target.value)}
                >
                  {cuentas.map((cuenta) => (
                    <NativeSelectOption key={cuenta.id} value={cuenta.id}>
                      {cuenta.codigo} · {cuenta.nombre}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="metodo-pago">Método</Label>
                <NativeSelect
                  id="metodo-pago"
                  className="w-full"
                  value={metodoPago}
                  onChange={(evento) => setMetodoPago(evento.target.value as MetodoPago)}
                >
                  <NativeSelectOption value="efectivo">Efectivo</NativeSelectOption>
                  <NativeSelectOption value="transferencia">Transferencia</NativeSelectOption>
                  <NativeSelectOption value="tarjeta">Tarjeta</NativeSelectOption>
                  <NativeSelectOption value="cheque">Cheque</NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="monto-pago">Monto</Label>
                <Input id="monto-pago" readOnly value={formatoMoneda(totales.totalCentavos / 100)} />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" render={<Link href="/dashboard/facturacion" />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Guardar factura
        </Button>
      </div>
    </form>
  );
}
