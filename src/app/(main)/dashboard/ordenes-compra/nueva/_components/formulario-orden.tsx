"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { SelectorContacto } from "@/components/contactos/selector-contacto";
import { DatePicker } from "@/components/date-picker";
import { CampoFormulario } from "@/components/formularios/campo-formulario";
import {
  FORM_BUTTON,
  FORM_COMBO,
  FORM_INPUT,
  FORM_INPUT_GROUP,
  FORM_SELECT,
  FORM_TEXTAREA,
  FormActions,
  FormCard,
  FormDivider,
  FormSectionTitle,
  FormTotal,
} from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { ArrowLeft, Plus, Trash2 } from "@/components/icons";
import { type ProductoSeleccionable, SelectorProducto } from "@/components/productos/selector-producto";
import { SelectorImpuesto } from "@/components/selector-impuesto";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { aNumero, calcularTotales, desdeCentavos } from "@/lib/compras/calculo";
import { hoyEnRd } from "@/lib/compras/fechas";
import { formatoMoneda } from "@/lib/compras/formato";
import { rutaOrdenCompra } from "@/lib/enlaces";
import { requerido } from "@/lib/formularios/validacion";
import { impuestoNinguno } from "@/lib/impuestos/tipos";
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
  impuestoId: string;
  itbisTasa: string;
}

const OPCIONES_MODO = [
  { value: "producto", label: "Producto" },
  { value: "gasto", label: "Gasto" },
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
    impuestoId: "",
    itbisTasa: "0",
  };
}

export function FormularioOrden({ contactos, productos, cuentasGasto, impuestos }: OpcionesOrden) {
  const router = useRouter();
  const hoy = hoyEnRd();
  const [proveedorId, setProveedorId] = useState("");
  const [productosLocales, setProductosLocales] = useState<readonly ProductoSeleccionable[]>(productos);
  const [fecha, setFecha] = useState(hoy);
  const [fechaEntrega, setFechaEntrega] = useState(hoy);
  const [notas, setNotas] = useState("");
  const [terminos, setTerminos] = useState("");
  const [lineas, setLineas] = useState<LineaFormulario[]>(() => [
    { ...nuevaLinea(), impuestoId: impuestoNinguno(impuestos)?.id ?? "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const validacion = useValidacionFormulario();

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

    actualizarLinea(id, { cuentaId, productoId: "", descripcion: cuenta.nombre });
  }

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    if (
      !validacion.validar([
        requerido("proveedor", proveedorId, "El proveedor es requerido."),
        requerido("fecha", fecha, "La fecha es requerida."),
        requerido("fecha-entrega", fechaEntrega, "La fecha de entrega es requerida."),
        ...lineas.flatMap((linea) => {
          const cantidad = aNumero(linea.cantidad);
          const costo = aNumero(linea.costo);
          return [
            linea.modo === "producto"
              ? requerido(`linea-${linea.id}-producto`, linea.productoId, "Seleccione un producto.")
              : requerido(`linea-${linea.id}-cuenta`, linea.cuentaId, "Seleccione una cuenta de gasto."),
            {
              campo: `linea-${linea.id}-cantidad`,
              invalido: !Number.isFinite(cantidad) || cantidad <= 0,
              mensaje: "La cantidad debe ser mayor que cero.",
            },
            {
              campo: `linea-${linea.id}-costo`,
              invalido: !Number.isFinite(costo) || costo < 0,
              mensaje: "El costo no puede ser negativo.",
            },
          ];
        }),
      ])
    ) {
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
        impuesto_id: linea.impuestoId || undefined,
      })),
    };

    const resultadoValidacion = esquemaOrdenCompra.safeParse(entrada);
    if (!resultadoValidacion.success) {
      setError(resultadoValidacion.error.issues[0]?.message ?? "Revisa los datos de la orden.");
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
    <form noValidate onSubmit={enviar} className="mx-auto flex w-full max-w-[1040px] flex-col gap-6">
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
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormCard>
        <section>
          <FormSectionTitle className="mb-4">Datos de la orden</FormSectionTitle>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <CampoFormulario
              htmlFor="proveedor"
              label="Proveedor"
              required
              error={validacion.errorDe("proveedor")}
              className="sm:col-span-2"
            >
              <SelectorContacto
                id="proveedor"
                contactos={contactos}
                valor={proveedorId}
                onCambio={(contacto) => {
                  setProveedorId(contacto?.id ?? "");
                  validacion.limpiar("proveedor");
                }}
                tipoInicial="proveedor"
                placeholder="Buscar proveedor…"
                className={FORM_COMBO}
              />
            </CampoFormulario>
            <CampoFormulario htmlFor="fecha" label="Fecha" required error={validacion.errorDe("fecha")}>
              <DatePicker
                id="fecha"
                value={fecha}
                onChange={(valor) => {
                  setFecha(valor);
                  validacion.limpiar("fecha");
                }}
              />
            </CampoFormulario>
            <CampoFormulario
              htmlFor="fecha-entrega"
              label="Fecha de entrega"
              required
              error={validacion.errorDe("fecha-entrega")}
            >
              <DatePicker
                id="fecha-entrega"
                value={fechaEntrega}
                onChange={(valor) => {
                  setFechaEntrega(valor);
                  validacion.limpiar("fecha-entrega");
                }}
              />
            </CampoFormulario>
            <Accordion className="sm:col-span-2">
              <AccordionItem value="mas" className="border-0">
                <AccordionTrigger>Más opciones</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-x-8 gap-y-4">
                    <CampoFormulario htmlFor="notas" label="Notas">
                      <Textarea
                        id="notas"
                        value={notas}
                        onChange={(evento) => setNotas(evento.target.value)}
                        placeholder="Observaciones de la orden"
                        maxLength={500}
                        className={FORM_TEXTAREA}
                      />
                    </CampoFormulario>
                    <CampoFormulario htmlFor="terminos" label="Términos">
                      <Textarea
                        id="terminos"
                        value={terminos}
                        onChange={(evento) => setTerminos(evento.target.value)}
                        placeholder="Condiciones de la compra"
                        maxLength={500}
                        className={FORM_TEXTAREA}
                      />
                    </CampoFormulario>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        <FormDivider />

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <FormSectionTitle>Líneas</FormSectionTitle>
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
          </div>
          <div className="flex flex-col gap-3">
            {lineas.map((linea, indice) => (
              <div key={linea.id} className="rounded-xl border border-slate-200 p-3">
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
                  <CampoFormulario label="Tipo" className="lg:col-span-2">
                    <Select
                      value={linea.modo}
                      items={OPCIONES_MODO}
                      onValueChange={(valor: string | null) => {
                        if (valor) cambiarModo(linea.id, valor === "gasto" ? "gasto" : "producto");
                      }}
                    >
                      <SelectTrigger className={FORM_SELECT}>
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
                  </CampoFormulario>
                  <CampoFormulario
                    label={linea.modo === "producto" ? "Producto" : "Cuenta de gasto"}
                    error={validacion.errorDe(
                      linea.modo === "producto" ? `linea-${linea.id}-producto` : `linea-${linea.id}-cuenta`,
                    )}
                    className="lg:col-span-4"
                  >
                    {linea.modo === "producto" ? (
                      <SelectorProducto
                        id={`linea-${linea.id}-producto`}
                        productos={productosLocales}
                        valor={linea.productoId}
                        onCambio={(producto) => {
                          seleccionarProducto(linea.id, producto);
                          validacion.limpiar(`linea-${linea.id}-producto`);
                        }}
                        className={FORM_COMBO}
                      />
                    ) : (
                      <ComboboxCampo
                        id={`linea-${linea.id}-cuenta`}
                        opciones={opcionesGastos}
                        valor={linea.cuentaId}
                        onCambio={(valor) => {
                          seleccionarCuenta(linea.id, valor);
                          validacion.limpiar(`linea-${linea.id}-cuenta`);
                        }}
                        placeholder="Buscar cuenta…"
                        vacio="No hay cuentas de gasto."
                        className={FORM_COMBO}
                      />
                    )}
                  </CampoFormulario>
                  <CampoFormulario
                    label="Cantidad"
                    error={validacion.errorDe(`linea-${linea.id}-cantidad`)}
                    className="lg:col-span-1"
                  >
                    <Input
                      id={`linea-${linea.id}-cantidad`}
                      inputMode="decimal"
                      value={linea.cantidad}
                      onChange={(evento) => {
                        actualizarLinea(linea.id, { cantidad: evento.target.value });
                        validacion.limpiar(`linea-${linea.id}-cantidad`);
                      }}
                      className={FORM_INPUT}
                    />
                  </CampoFormulario>
                  <CampoFormulario
                    label="Costo"
                    error={validacion.errorDe(`linea-${linea.id}-costo`)}
                    className="lg:col-span-2"
                  >
                    <InputGroup className={FORM_INPUT_GROUP}>
                      <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                        RD$
                      </InputGroupAddon>
                      <InputGroupInput
                        id={`linea-${linea.id}-costo`}
                        inputMode="decimal"
                        value={linea.costo}
                        placeholder="0.00"
                        onChange={(evento) => {
                          actualizarLinea(linea.id, { costo: evento.target.value });
                          validacion.limpiar(`linea-${linea.id}-costo`);
                        }}
                      />
                    </InputGroup>
                  </CampoFormulario>
                  <CampoFormulario label="Impuesto" className="lg:col-span-1">
                    <SelectorImpuesto
                      className={FORM_SELECT}
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
                  </CampoFormulario>
                  <CampoFormulario label="Subtotal" className="lg:col-span-2">
                    <div className="flex h-10 items-center justify-end text-sm tabular-nums">
                      {formatoMoneda(aNumero(linea.cantidad) * aNumero(linea.costo))}
                    </div>
                  </CampoFormulario>
                </div>
              </div>
            ))}
          </div>
        </section>

        <FormTotal>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatoMoneda(desdeCentavos(totales.subtotalCentavos))}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Impuestos</span>
            <span className="tabular-nums">{formatoMoneda(desdeCentavos(totales.itbisCentavos))}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xl leading-7 font-semibold text-slate-900">
            <span>Total</span>
            <span className="tabular-nums">{formatoMoneda(desdeCentavos(totales.totalCentavos))}</span>
          </div>
        </FormTotal>
      </FormCard>

      <FormActions>
        <Button
          type="button"
          variant="outline"
          className={FORM_BUTTON}
          render={<Link href="/dashboard/ordenes-compra" />}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente} className={FORM_BUTTON}>
          {pendiente ? "Guardando…" : "Guardar orden"}
        </Button>
      </FormActions>
    </form>
  );
}
