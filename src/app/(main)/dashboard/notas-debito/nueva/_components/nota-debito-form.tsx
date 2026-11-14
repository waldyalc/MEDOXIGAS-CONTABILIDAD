"use client";

import { type ReactNode, useRef, useState, useTransition } from "react";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import { SelectorImpuesto } from "@/components/selector-impuesto";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  calcularLinea,
  calcularTotales,
  centavosAValor,
  parsearCantidad,
  parsearCentavos,
} from "@/lib/facturacion/calculo";
import { formatoMoneda, formatoMonedaCentavos } from "@/lib/facturacion/formato";
import { type Impuesto, impuestoNinguno } from "@/lib/impuestos/tipos";
import { crearNotaDebitoVenta } from "@/lib/notas-debito/acciones";
import type { DatosFormularioNotaDebito, TipoNotaDebito } from "@/lib/notas-debito/tipos";
import { TIPOS_NOTA_DEBITO } from "@/lib/notas-debito/tipos";

interface LineaForm {
  clave: string;
  productoId: string;
  cantidad: string;
  precio: string;
  descuentoPct: string;
  impuestoId: string;
  itbisTasa: string;
}

interface Props {
  datos: DatosFormularioNotaDebito;
  impuestos: Impuesto[];
  fechaHoy: string;
  facturaInicial?: string;
}

const CAMPO_CHICO =
  "h-8 rounded-lg border-slate-300 bg-white px-2 text-sm text-slate-700 placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-primary focus-visible:ring-0 disabled:bg-slate-50 dark:bg-white dark:disabled:bg-slate-50 md:text-sm";
const SELECT_CHICO =
  "w-full rounded-lg border-slate-300 bg-white px-2 text-sm text-slate-700 hover:border-slate-400 focus-visible:border-primary focus-visible:ring-0 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:opacity-100 dark:bg-white dark:disabled:bg-slate-50";
const SELECT_MEDIO =
  "w-full rounded-[10px] border-slate-300 bg-white px-2 text-base text-slate-700 hover:border-slate-400 focus-visible:border-primary focus-visible:ring-0 data-[size=default]:h-10 dark:bg-white";
const GRUPO_CAMPO_CHICO =
  "h-8 w-full rounded-lg border-slate-300 bg-white hover:border-slate-400 has-[[data-slot=input-group-control]:focus-visible]:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:bg-white";
const COMBO_MEDIO =
  "h-10 rounded-[10px] border-slate-300 bg-white px-2 has-[[data-slot=input-group-control]:focus-visible]:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:bg-white [&>input]:text-base";
const TITULO_SECCION = "text-base leading-6 font-semibold text-slate-700";
const DIVISOR = "h-px w-full bg-slate-400/20";
const CELDA_ENCABEZADO =
  "flex h-10 items-center border-b border-slate-400/20 bg-slate-50 px-1 text-xs leading-4 font-medium text-gray-500";
function lineaVacia(clave: string, impuestoId = ""): LineaForm {
  return { clave, productoId: "", cantidad: "1", precio: "0.00", descuentoPct: "0", impuestoId, itbisTasa: "0" };
}

function numero(texto: string): number {
  const valor = Number(texto);
  return Number.isFinite(valor) ? valor : 0;
}

function Campo({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex min-w-0 flex-col gap-1 ${className}`}>{children}</div>;
}

function Etiqueta({
  htmlFor,
  children,
  requerido = false,
}: {
  htmlFor: string;
  children: ReactNode;
  requerido?: boolean;
}) {
  return (
    <Label htmlFor={htmlFor} className="flex items-center gap-1 text-sm leading-5 font-medium text-slate-700">
      {children}
      {requerido ? <span className="text-primary text-xs">*</span> : null}
    </Label>
  );
}

export function NotaDebitoForm({ datos, impuestos, fechaHoy, facturaInicial }: Props) {
  const router = useRouter();
  const contador = useRef(1);
  const [pendiente, iniciar] = useTransition();

  const facturaPrevia = datos.facturas.find((factura) => factura.id === facturaInicial);
  const [clienteId, setClienteId] = useState(facturaPrevia?.contacto_id ?? "");
  const [tipo, setTipo] = useState<TipoNotaDebito>("montos");
  const [fecha, setFecha] = useState(fechaHoy);
  const [facturaId, setFacturaId] = useState(facturaPrevia?.id ?? "");
  const [lineas, setLineas] = useState<LineaForm[]>(() => [lineaVacia("l1", impuestoNinguno(impuestos)?.id ?? "")]);
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);

  const clientesItems = datos.contactos.map((contacto) => ({ value: contacto.id, label: contacto.nombre }));
  const productosItems = datos.productos.map((producto) => ({ value: producto.id, label: producto.nombre }));
  const tiposItems = TIPOS_NOTA_DEBITO.map((opcion) => ({ value: opcion.valor, label: opcion.etiqueta }));
  const facturasCliente = datos.facturas.filter(
    (factura) => factura.contacto_id === clienteId && factura.estado !== "anulada",
  );
  const facturasItems = facturasCliente.map((factura) => ({
    value: factura.id,
    label: `#${factura.numero} · ${factura.ncf ?? "sin NCF"} · ${formatoMoneda(factura.total)}`,
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
      ...(producto
        ? {
            precio: producto.precio.toFixed(2),
            impuestoId: producto.impuesto_id ?? "",
            itbisTasa: String(producto.itbis_tasa),
          }
        : {}),
    });
  }

  function seleccionarCliente(id: string) {
    setClienteId(id);
    if (!datos.facturas.some((factura) => factura.id === facturaId && factura.contacto_id === id)) {
      setFacturaId("");
    }
  }

  function agregarLinea() {
    contador.current += 1;
    setLineas((actuales) => [...actuales, lineaVacia(`l${contador.current}`, impuestoNinguno(impuestos)?.id ?? "")]);
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
    if (!facturaId) {
      setError("Selecciona la factura asociada.");
      return;
    }
    if (lineas.some((linea) => !linea.productoId)) {
      setError("Selecciona el producto en todas las líneas.");
      return;
    }
    if (totales.totalCentavos <= 0) {
      setError("El total de la nota de débito debe ser mayor que cero.");
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
        impuesto_id: linea.impuestoId || null,
      };
    });

    iniciar(async () => {
      const resultado = await crearNotaDebitoVenta({
        factura_id: facturaId,
        tipo,
        fecha,
        notas: notas.trim() || undefined,
        lineas: payloadLineas,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(`/dashboard/notas-debito/${resultado.id}`);
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

      <div className="flex flex-col gap-4 rounded-[12px] border border-slate-400/20 bg-white p-3 text-slate-700 shadow-sm sm:gap-6 sm:p-5 md:gap-8 md:p-8">
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
            <p className="text-base leading-6 font-semibold text-slate-700">Nota de débito</p>
            <div className="flex items-center gap-2.5 pl-2.5 text-base">
              <span className="text-slate-500">NCF</span>
              <span className="truncate text-slate-700">Se asigna al guardar (B03)</span>
            </div>
          </div>
        </header>

        <section>
          <h2 className={`mb-4 ${TITULO_SECCION}`}>Información de la nota</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo>
              <Etiqueta htmlFor="cliente" requerido>
                Cliente
              </Etiqueta>
              <Combobox
                items={clientesItems}
                onValueChange={(item: { value: string; label: string } | null) => seleccionarCliente(item?.value ?? "")}
              >
                <ComboboxInput id="cliente" className={COMBO_MEDIO} placeholder="Buscar cliente…" showClear />
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
            </Campo>

            <Campo>
              <Etiqueta htmlFor="tipo" requerido>
                Tipo de nota de débito
              </Etiqueta>
              <Select
                items={tiposItems}
                value={tipo}
                onValueChange={(valor: string | null) => {
                  if (valor === "texto" || valor === "montos") setTipo(valor);
                }}
              >
                <SelectTrigger id="tipo" className={SELECT_MEDIO}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {tiposItems.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo>
              <Etiqueta htmlFor="fecha" requerido>
                Fecha de creación
              </Etiqueta>
              <DatePicker id="fecha" value={fecha} onChange={setFecha} />
            </Campo>

            <Campo>
              <Etiqueta htmlFor="factura" requerido>
                Factura asociada
              </Etiqueta>
              <Combobox
                items={facturasItems}
                onValueChange={(item: { value: string; label: string } | null) => setFacturaId(item?.value ?? "")}
              >
                <ComboboxInput
                  id="factura"
                  className={COMBO_MEDIO}
                  placeholder={clienteId ? "Buscar factura…" : "Elige primero el cliente"}
                  disabled={!clienteId}
                  showClear
                />
                <ComboboxContent>
                  <ComboboxEmpty>Sin facturas del cliente</ComboboxEmpty>
                  <ComboboxList>
                    {(item: { value: string; label: string }) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Campo>
          </div>
        </section>

        <section>
          <div className={`mb-4 ${DIVISOR}`} />
          <h2 className={`mb-4 ${TITULO_SECCION}`}>Productos y servicios</h2>
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
                          className="w-full border-slate-300 bg-white dark:bg-white [&>input]:text-sm"
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
                        className={CAMPO_CHICO}
                      />
                    </div>
                    <div className="min-w-0 py-2 pr-1">
                      <InputGroup className={GRUPO_CAMPO_CHICO}>
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
                      <InputGroup className={GRUPO_CAMPO_CHICO}>
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
                      <SelectorImpuesto
                        id={`itbis-${linea.clave}`}
                        className={SELECT_CHICO}
                        ariaLabel={`Impuesto de la lA-nea ${indice + 1}`}
                        impuestos={impuestos}
                        value={linea.impuestoId}
                        onValueChange={(impuestoId) => {
                          const impuesto = impuestos.find((item) => item.id === impuestoId);
                          actualizarLinea(linea.clave, {
                            impuestoId,
                            itbisTasa: String(impuesto?.tarifa ?? 0),
                          });
                        }}
                      />
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

        <section className="flex justify-center md:justify-end">
          <div className="w-full text-base text-slate-500 md:w-80">
            <div className="flex h-6 items-center justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatoMonedaCentavos(totales.subtotalCentavos)}</span>
            </div>
            <div className="flex h-6 items-center justify-between">
              <span>Descuento</span>
              <span className="tabular-nums">{formatoMonedaCentavos(totales.descuentoCentavos)}</span>
            </div>
            <div className="flex h-6 items-center justify-between">
              <span>Impuestos</span>
              <span className="tabular-nums">{formatoMonedaCentavos(totales.itbisCentavos)}</span>
            </div>
            <div className="mt-7 flex items-center justify-between text-xl leading-7 font-semibold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">{formatoMonedaCentavos(totales.totalCentavos)}</span>
            </div>
          </div>
        </section>

        <section>
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-base leading-6 font-semibold text-slate-700 [&[data-panel-open]>svg]:rotate-180">
              Más opciones
              <ChevronDown className="size-4 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid gap-4 pt-2 md:grid-cols-3">
                <Campo>
                  <Etiqueta htmlFor="notas">Notas</Etiqueta>
                  <Textarea
                    id="notas"
                    value={notas}
                    placeholder="Motivo o detalle del cargo"
                    onChange={(evento) => setNotas(evento.target.value)}
                    className="focus-visible:border-primary min-h-20 border-slate-300 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus-visible:ring-0"
                  />
                </Campo>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-[12px] px-6 text-base"
          render={<Link href="/dashboard/notas-debito" />}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente} className="h-12 rounded-[12px] px-6 text-base">
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Crear nota de débito
        </Button>
      </div>
    </form>
  );
}
