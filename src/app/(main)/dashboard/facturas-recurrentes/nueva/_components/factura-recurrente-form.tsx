"use client";

import { useRef, useState, useTransition } from "react";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronDown, Loader2, Plus, Trash2, X } from "lucide-react";

import { type ContactoOpcion, SelectorContacto } from "@/components/contactos/selector-contacto";
import { DatePicker } from "@/components/date-picker";
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
  FormField,
  FormSectionTitle,
  FormTotal,
} from "@/components/formularios/formulario";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  calcularLinea,
  calcularTotales,
  centavosAValor,
  parsearCantidad,
  parsearCentavos,
} from "@/lib/facturacion/calculo";
import { esTipoComprobante, OPCIONES_TIPO_COMPROBANTE } from "@/lib/facturacion/comprobantes";
import { formatoMonedaCentavos } from "@/lib/facturacion/formato";
import type { TipoComprobante } from "@/lib/facturacion/tipos";
import { crearFacturaRecurrente } from "@/lib/facturas-recurrentes/acciones";
import type { DatosFormularioRecurrente } from "@/lib/facturas-recurrentes/tipos";

interface LineaForm {
  clave: string;
  productoId: string;
  cantidad: string;
  precio: string;
  descuentoPct: string;
  itbisTasa: string;
}

interface Props {
  datos: DatosFormularioRecurrente;
  fechaHoy: string;
}

const CELDA_ENCABEZADO =
  "flex h-10 items-center border-b border-slate-400/20 bg-slate-50 px-1 text-xs leading-4 font-medium text-gray-500";
const OPCIONES_ITBIS: readonly { value: string; label: string }[] = [
  { value: "0", label: "Sin ITBIS" },
  { value: "16", label: "ITBIS 16 %" },
  { value: "18", label: "ITBIS 18 %" },
];

function lineaVacia(clave: string): LineaForm {
  return { clave, productoId: "", cantidad: "1", precio: "0.00", descuentoPct: "0", itbisTasa: "18" };
}

function numero(texto: string): number {
  const valor = Number(texto);
  return Number.isFinite(valor) ? valor : 0;
}

export function FacturaRecurrenteForm({ datos, fechaHoy }: Props) {
  const router = useRouter();
  const contador = useRef(1);
  const [pendiente, iniciar] = useTransition();

  const [clienteId, setClienteId] = useState("");
  const [tipo, setTipo] = useState<TipoComprobante>("02");
  const [fechaInicio, setFechaInicio] = useState(fechaHoy);
  const [vigenciaHasta, setVigenciaHasta] = useState("");
  const [frecuencia, setFrecuencia] = useState("1");
  const [plazo, setPlazo] = useState("30");
  const [lineas, setLineas] = useState<LineaForm[]>([lineaVacia("l1")]);
  const [notas, setNotas] = useState("");
  const [terminos, setTerminos] = useState("");
  const [pie, setPie] = useState("");
  const [error, setError] = useState<string | null>(null);

  const productosItems = datos.productos.map((producto) => ({ value: producto.id, label: producto.nombre }));
  const comprobantesItems = OPCIONES_TIPO_COMPROBANTE.map((opcion) => ({
    value: opcion.valor,
    label: opcion.etiqueta,
  }));

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
    const producto = datos.productos.find((item) => item.id === productoId);
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
      setError("Selecciona el cliente.");
      return;
    }
    if (lineas.some((linea) => !linea.productoId)) {
      setError("Selecciona el producto en todas las líneas.");
      return;
    }
    if (totales.totalCentavos <= 0) {
      setError("El total de la factura recurrente debe ser mayor que cero.");
      return;
    }

    const payloadLineas = lineas.map((linea) => {
      const producto = datos.productos.find((item) => item.id === linea.productoId);
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
      const resultado = await crearFacturaRecurrente({
        contacto_id: clienteId,
        tipo_comprobante: tipo,
        fecha_inicio: fechaInicio,
        ...(vigenciaHasta ? { vigencia_hasta: vigenciaHasta } : {}),
        frecuencia_meses: Number(frecuencia),
        plazo_dias: Number(plazo),
        notas: notas.trim() || undefined,
        terminos: terminos.trim() || undefined,
        pie: pie.trim() || undefined,
        lineas: payloadLineas,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(`/dashboard/facturas-recurrentes/${resultado.id}`);
    });
  }

  return (
    <form
      className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 [font-family:var(--font-inter)]"
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar();
      }}
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormCard className="gap-6 p-4 sm:p-5">
        <header className="flex flex-col gap-4 py-3 md:flex-row md:items-center md:justify-between md:gap-6 md:py-6 lg:py-8">
          <div className="flex min-w-0 justify-center md:w-1/3 md:justify-start">
            <Image
              src="/marca/logo-medoxigas.png"
              alt={datos.empresa?.nombre ?? "Medoxigas"}
              width={185}
              height={96}
              preload
              className="h-[72px] w-auto object-contain md:h-24"
            />
          </div>

          <div className="min-w-0 text-center md:w-1/3">
            <p className="text-base leading-6 font-semibold text-slate-700">
              {datos.empresa?.nombre ?? "MEDOXIGAS ALC, SRL"}
            </p>
            {datos.empresa?.rnc ? <p className="text-xs leading-4 text-slate-500">RNC {datos.empresa.rnc}</p> : null}
            {datos.empresa?.correo ? <p className="text-xs leading-4 text-slate-500">{datos.empresa.correo}</p> : null}
          </div>

          <div className="flex min-w-0 flex-col gap-3.5 md:w-1/3 md:items-end">
            <p className="text-base leading-6 font-semibold text-slate-700">Factura recurrente</p>
            <p className="text-sm text-slate-500">La factura se emite al generar el periodo.</p>
          </div>
        </header>

        <section>
          <FormSectionTitle className="mb-4">Información de la recurrencia</FormSectionTitle>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField htmlFor="cliente" label="Cliente" required>
              <SelectorContacto
                id="cliente"
                contactos={datos.contactos}
                valor={clienteId}
                onCambio={(contacto: ContactoOpcion | null) => setClienteId(contacto?.id ?? "")}
                tipoInicial="cliente"
                className={FORM_COMBO}
                placeholder="Buscar cliente…"
              />
            </FormField>

            <FormField htmlFor="tipo-comprobante" label="Tipo de comprobante" required>
              <Select
                items={comprobantesItems}
                value={tipo}
                onValueChange={(valor: string | null) => {
                  if (valor && esTipoComprobante(valor)) setTipo(valor);
                }}
              >
                <SelectTrigger id="tipo-comprobante" className={FORM_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {comprobantesItems.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField htmlFor="fecha-inicio" label="Fecha de inicio" required>
              <DatePicker id="fecha-inicio" value={fechaInicio} onChange={setFechaInicio} />
            </FormField>

            <FormField htmlFor="vigencia" label="Vigencia hasta">
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <DatePicker
                    id="vigencia"
                    value={vigenciaHasta}
                    onChange={setVigenciaHasta}
                    placeholder="Sin límite"
                  />
                </div>
                {vigenciaHasta ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setVigenciaHasta("")}
                    aria-label="Quitar la vigencia"
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
            </FormField>

            <FormField htmlFor="frecuencia" label="Frecuencia (meses)" required>
              <Input
                id="frecuencia"
                inputMode="numeric"
                value={frecuencia}
                onChange={(evento) => setFrecuencia(evento.target.value)}
                className={FORM_INPUT}
              />
            </FormField>

            <FormField htmlFor="plazo" label="Plazo de pago (días)" required>
              <Input
                id="plazo"
                inputMode="numeric"
                value={plazo}
                onChange={(evento) => setPlazo(evento.target.value)}
                className={FORM_INPUT}
              />
            </FormField>
          </div>
        </section>

        <section>
          <FormDivider className="mb-4" />
          <FormSectionTitle className="mb-4">Productos y servicios</FormSectionTitle>
          <div className="overflow-x-auto">
            <div className="grid min-w-[820px] grid-cols-[44px_minmax(0,29fr)_minmax(0,7.4fr)_minmax(0,12.6fr)_148px_minmax(0,13.6fr)_minmax(0,13.5fr)_32px]">
              <div className={`${CELDA_ENCABEZADO} justify-center`}>N.º</div>
              <div className={CELDA_ENCABEZADO}>Producto o servicio</div>
              <div className={CELDA_ENCABEZADO}>Cantidad</div>
              <div className={CELDA_ENCABEZADO}>Precio</div>
              <div className={CELDA_ENCABEZADO}>Descuento</div>
              <div className={CELDA_ENCABEZADO}>Impuesto</div>
              <div className={`${CELDA_ENCABEZADO} justify-end`}>Subtotal</div>
              <div className={CELDA_ENCABEZADO} />

              {lineas.map((linea, indice) => {
                const calculo = calculadas.find((item) => item.clave === linea.clave)?.calculo;
                return (
                  <div key={linea.clave} className="contents">
                    <div className="flex justify-center py-2 pr-1 text-xs leading-10 text-slate-500">{indice + 1}</div>
                    <div className="min-w-0 py-2 pr-1">
                      <Combobox
                        items={productosItems}
                        onValueChange={(item: { value: string; label: string } | null) =>
                          seleccionarProducto(linea.clave, item?.value ?? "")
                        }
                      >
                        <ComboboxInput
                          id={`producto-${linea.clave}`}
                          className={`${FORM_COMBO} border [&>input]:text-sm`}
                          placeholder="Buscar producto…"
                          aria-label={`Producto de la línea ${indice + 1}`}
                        />
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
                    <div className="min-w-0 py-2 pr-1">
                      <Input
                        id={`cantidad-${linea.clave}`}
                        inputMode="decimal"
                        value={linea.cantidad}
                        onChange={(evento) => actualizarLinea(linea.clave, { cantidad: evento.target.value })}
                        aria-label={`Cantidad de la línea ${indice + 1}`}
                        className={FORM_INPUT}
                      />
                    </div>
                    <div className="min-w-0 py-2 pr-1">
                      <InputGroup className={FORM_INPUT_GROUP}>
                        <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                          RD$
                        </InputGroupAddon>
                        <InputGroupInput
                          id={`precio-${linea.clave}`}
                          inputMode="decimal"
                          value={linea.precio}
                          onChange={(evento) => actualizarLinea(linea.clave, { precio: evento.target.value })}
                          aria-label={`Precio de la línea ${indice + 1}`}
                          className="h-full min-w-0 pl-1 text-sm text-slate-700 md:text-sm"
                        />
                      </InputGroup>
                    </div>
                    <div className="min-w-0 py-2 pr-1">
                      <InputGroup className={FORM_INPUT_GROUP}>
                        <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                          %
                        </InputGroupAddon>
                        <InputGroupInput
                          id={`descuento-${linea.clave}`}
                          inputMode="decimal"
                          value={linea.descuentoPct}
                          onChange={(evento) => actualizarLinea(linea.clave, { descuentoPct: evento.target.value })}
                          aria-label={`Descuento de la línea ${indice + 1}`}
                          className="h-full min-w-0 pl-1 text-sm text-slate-700 md:text-sm"
                        />
                      </InputGroup>
                    </div>
                    <div className="min-w-0 py-2 pr-1">
                      <Select
                        items={OPCIONES_ITBIS}
                        value={linea.itbisTasa}
                        onValueChange={(valor: string | null) => {
                          if (valor) actualizarLinea(linea.clave, { itbisTasa: valor });
                        }}
                      >
                        <SelectTrigger
                          id={`itbis-${linea.clave}`}
                          className={FORM_SELECT}
                          aria-label={`ITBIS de la línea ${indice + 1}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          {OPCIONES_ITBIS.map((opcion) => (
                            <SelectItem key={opcion.value} value={opcion.value}>
                              {opcion.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex min-w-0 justify-end py-2 pr-1">
                      <span className="mt-1 text-sm leading-8 text-slate-700 tabular-nums">
                        {formatoMonedaCentavos(calculo?.totalCentavos ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-center py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-8 text-slate-900 hover:bg-slate-200/45"
                        disabled={lineas.length === 1}
                        onClick={() => quitarLinea(linea.clave)}
                      >
                        <Trash2 />
                        <span className="sr-only">Quitar línea {indice + 1}</span>
                      </Button>
                    </div>
                  </div>
                );
              })}

              <div className="col-span-full">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-primary h-9 w-fit justify-start gap-1 rounded-[10px] px-2 text-sm font-medium hover:bg-slate-200/45"
                  onClick={agregarLinea}
                >
                  <Plus className="size-4" />
                  Agregar línea
                </Button>
              </div>
            </div>
          </div>
        </section>

        <FormTotal>
          <div className="flex h-6 items-center justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatoMonedaCentavos(totales.subtotalCentavos)}</span>
          </div>
          <div className="flex h-6 items-center justify-between">
            <span>Descuento</span>
            <span className="tabular-nums">{formatoMonedaCentavos(totales.descuentoCentavos)}</span>
          </div>
          <div className="flex h-6 items-center justify-between">
            <span>ITBIS</span>
            <span className="tabular-nums">{formatoMonedaCentavos(totales.itbisCentavos)}</span>
          </div>
          <div className="mt-7 flex items-center justify-between text-xl leading-7 font-semibold text-slate-900">
            <span>Total por factura</span>
            <span className="tabular-nums">{formatoMonedaCentavos(totales.totalCentavos)}</span>
          </div>
        </FormTotal>

        <section>
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-base leading-6 font-semibold text-slate-700 [&[data-panel-open]>svg]:rotate-180">
              Más opciones
              <ChevronDown className="size-4 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid gap-x-8 gap-y-4 pt-2 md:grid-cols-3">
                <FormField htmlFor="notas" label="Observaciones">
                  <Textarea
                    id="notas"
                    value={notas}
                    placeholder="Notas internas de la recurrencia"
                    onChange={(evento) => setNotas(evento.target.value)}
                    className={FORM_TEXTAREA}
                  />
                </FormField>
                <FormField htmlFor="terminos" label="Términos y condiciones">
                  <Textarea
                    id="terminos"
                    value={terminos}
                    placeholder="Condiciones de pago de las facturas"
                    onChange={(evento) => setTerminos(evento.target.value)}
                    className={FORM_TEXTAREA}
                  />
                </FormField>
                <FormField htmlFor="pie" label="Pie de factura">
                  <Textarea
                    id="pie"
                    value={pie}
                    placeholder="Texto al pie de las facturas"
                    onChange={(evento) => setPie(evento.target.value)}
                    className={FORM_TEXTAREA}
                  />
                </FormField>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>
      </FormCard>

      <FormActions>
        <Button
          type="button"
          variant="outline"
          className={FORM_BUTTON}
          render={<Link href="/dashboard/facturas-recurrentes" />}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente} className={FORM_BUTTON}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Crear factura recurrente
        </Button>
      </FormActions>
    </form>
  );
}
