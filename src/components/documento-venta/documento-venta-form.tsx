"use client";

import { type ReactNode, useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

import {
  calcularDocumento,
  construirEntrada,
  type LineaCalculadaFormulario,
  type LineaFormulario,
  lineaVacia,
  mensajeValidacionDocumento,
} from "./calculo";
import type { ValoresIniciales } from "./prellenado";

export type ResultadoAccionDocumento = { ok: true; id: string } | { ok: false; error: string };

interface Props {
  empresa: Empresa | null;
  contactos: ContactoResumen[];
  productos: ProductoResumen[];
  cuentas?: CuentaCajaBanco[];
  fechaHoy: string;
  titulo: string;
  etiquetaNumero: string;
  conComprobante?: boolean;
  conVencimiento?: boolean;
  conPago?: boolean;
  conTerminos?: boolean;
  conPie?: boolean;
  textoGuardar: string;
  rutaCancelar: string;
  rutaDestino: string;
  accion: (entrada: unknown) => Promise<ResultadoAccionDocumento>;
  valoresIniciales?: ValoresIniciales;
  cotizacionOrigenId?: string;
  numeroActual?: string;
}

interface OpcionSelect {
  value: string;
  label: string;
}

const CAMPO_CHICO =
  "h-8 rounded-lg border-slate-300 bg-white px-2 text-sm text-slate-700 placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-primary focus-visible:ring-0 disabled:bg-slate-50 dark:bg-white dark:disabled:bg-slate-50 md:text-sm";
const CAMPO_BLOQUEADO = "disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:opacity-100";
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
const METODOS_PAGO: readonly { value: MetodoPago; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "cheque", label: "Cheque" },
];
const OPCIONES_ITBIS: readonly { value: string; label: string }[] = [
  { value: "0", label: "Sin ITBIS" },
  { value: "16", label: "ITBIS 16 %" },
  { value: "18", label: "ITBIS 18 %" },
];

function esMetodoPago(valor: string | null): valor is MetodoPago {
  return METODOS_PAGO.some((metodo) => metodo.value === valor);
}

function tipoComprobanteInicial(valor: string | undefined): TipoComprobante {
  return valor && esTipoComprobante(valor) ? valor : "02";
}

function claseColumnasOpciones(campos: number): string {
  if (campos <= 1) return "";
  if (campos === 2) return "md:grid-cols-2";
  return "md:grid-cols-3";
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

function Encabezado({
  empresa,
  conComprobante,
  etiquetaNumero,
  tipo,
  numeroActual,
  onTipo,
  comprobantesItems,
}: {
  empresa: Empresa | null;
  conComprobante: boolean;
  etiquetaNumero: string;
  tipo: TipoComprobante;
  numeroActual?: string;
  onTipo: (tipo: TipoComprobante) => void;
  comprobantesItems: OpcionSelect[];
}) {
  function cambiarTipo(valor: string | null) {
    if (valor && esTipoComprobante(valor)) onTipo(valor);
  }

  return (
    <header className="flex flex-col gap-4 py-3 md:flex-row md:items-center md:justify-between md:gap-6 md:py-6 lg:py-8">
      <div className="flex min-w-0 justify-center md:w-1/3 md:justify-start">
        {/* biome-ignore lint/performance/noImgElement: logo configurable de la empresa */}
        <img
          src={empresa?.logo_url?.trim() || "/marca/logo-medoxigas.png"}
          alt={empresa?.nombre ?? "Medoxigas"}
          className="h-[72px] w-auto object-contain md:h-24"
        />
      </div>

      <div className="min-w-0 text-center md:w-1/3">
        <p className="text-base leading-6 font-semibold text-slate-700">{empresa?.nombre ?? "MEDOXIGAS ALC, SRL"}</p>
        {empresa?.rnc ? <p className="text-xs leading-4 text-slate-500">RNC {empresa.rnc}</p> : null}
        {empresa?.direccion ? <p className="text-xs leading-4 text-slate-500">{empresa.direccion}</p> : null}
        {empresa?.telefono ? <p className="text-xs leading-4 text-slate-500">{empresa.telefono}</p> : null}
        {empresa?.correo ? <p className="text-xs leading-4 text-slate-500">{empresa.correo}</p> : null}
      </div>

      <div className="flex min-w-0 flex-col gap-3.5 md:w-1/3 md:items-end md:justify-center">
        {conComprobante ? (
          <div className="w-full">
            <Label htmlFor="tipo-comprobante" className="sr-only">
              Tipo de comprobante
            </Label>
            <Select items={comprobantesItems} value={tipo} onValueChange={cambiarTipo}>
              <SelectTrigger id="tipo-comprobante" className={SELECT_MEDIO}>
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
          </div>
        ) : null}
        <div className="flex items-center gap-2.5 pl-2.5 text-base">
          <span className="text-slate-500">{conComprobante ? "NCF" : etiquetaNumero}</span>
          <span className="truncate text-slate-700">{numeroActual ?? "Se asigna al guardar"}</span>
        </div>
      </div>
    </header>
  );
}

function AjustesPago({
  totalCentavos,
  cuentasItems,
  registrarPago,
  onRegistrarPago,
  cuentaPago,
  onCuentaPago,
  metodoPago,
  onMetodoPago,
}: {
  totalCentavos: number;
  cuentasItems: OpcionSelect[];
  registrarPago: boolean;
  onRegistrarPago: (valor: boolean) => void;
  cuentaPago: string;
  onCuentaPago: (valor: string) => void;
  metodoPago: MetodoPago;
  onMetodoPago: (valor: MetodoPago) => void;
}) {
  function cambiarMetodo(valor: string | null) {
    if (esMetodoPago(valor)) onMetodoPago(valor);
  }

  return (
    <section>
      <h2 className={`mb-4 ${TITULO_SECCION}`}>Ajustes</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        <Campo>
          <Etiqueta htmlFor="moneda">Moneda</Etiqueta>
          <Input id="moneda" readOnly value="DOP · Peso dominicano" className={CAMPO_CHICO} />
        </Campo>

        <Campo>
          <span className="flex items-center gap-1 text-sm leading-5 font-medium text-slate-700">Pago recibido</span>
          <div className="flex h-8 items-center gap-2">
            <Checkbox id="registrar-pago" checked={registrarPago} onCheckedChange={(valor) => onRegistrarPago(valor)} />
            <Label htmlFor="registrar-pago" className="text-sm leading-5 font-medium text-slate-700">
              Registrar
            </Label>
          </div>
        </Campo>

        <Campo>
          <Etiqueta htmlFor="cuenta-pago">Cuenta de caja o banco</Etiqueta>
          <Select
            items={cuentasItems}
            value={cuentaPago}
            disabled={!registrarPago}
            onValueChange={(valor: string | null) => onCuentaPago(valor ?? "")}
          >
            <SelectTrigger id="cuenta-pago" className={SELECT_CHICO}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {cuentasItems.map((cuenta) => (
                <SelectItem key={cuenta.value} value={cuenta.value}>
                  {cuenta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>

        <Campo>
          <Etiqueta htmlFor="metodo-pago">Método de pago</Etiqueta>
          <Select items={METODOS_PAGO} value={metodoPago} disabled={!registrarPago} onValueChange={cambiarMetodo}>
            <SelectTrigger id="metodo-pago" className={SELECT_CHICO}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {METODOS_PAGO.map((metodo) => (
                <SelectItem key={metodo.value} value={metodo.value}>
                  {metodo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>

        <Campo>
          <Etiqueta htmlFor="monto-pago">Monto</Etiqueta>
          <Input
            id="monto-pago"
            readOnly
            disabled={!registrarPago}
            value={formatoMoneda(totalCentavos / 100)}
            className={`${CAMPO_CHICO} ${CAMPO_BLOQUEADO}`}
          />
        </Campo>
      </div>
    </section>
  );
}

function LineasDocumento({
  lineas,
  productos,
  calculadas,
  onActualizar,
  onSeleccionarProducto,
  onAgregar,
  onQuitar,
}: {
  lineas: LineaFormulario[];
  productos: ProductoResumen[];
  calculadas: LineaCalculadaFormulario[];
  onActualizar: (clave: string, cambios: Partial<LineaFormulario>) => void;
  onSeleccionarProducto: (clave: string, productoId: string) => void;
  onAgregar: () => void;
  onQuitar: (clave: string) => void;
}) {
  const opcionesProductos = productos.map((item) => ({ value: item.id, label: item.nombre }));

  return (
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
            const producto = productos.find((item) => item.id === linea.productoId);
            const productoSeleccionado = opcionesProductos.find((item) => item.value === linea.productoId) ?? null;

            return (
              <div key={linea.clave} className="contents">
                <div className="flex justify-center py-2 pr-1 text-xs leading-10 text-slate-500">{indice + 1}</div>
                <div className="min-w-0 py-2 pr-1">
                  <Combobox
                    items={opcionesProductos}
                    value={productoSeleccionado}
                    onValueChange={(item: { value: string; label: string } | null) =>
                      onSeleccionarProducto(linea.clave, item?.value ?? "")
                    }
                    itemToStringLabel={(item: { value: string; label: string }) => item.label}
                    isItemEqualToValue={(a: { value: string }, b: { value: string }) => a.value === b.value}
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
                  {producto?.referencia ? (
                    <p className="mt-1 text-xs leading-4 text-slate-500">Ref. {producto.referencia}</p>
                  ) : null}
                </div>
                <div className="min-w-0 py-2 pr-1">
                  <Input
                    id={`cantidad-${linea.clave}`}
                    inputMode="decimal"
                    value={linea.cantidad}
                    onChange={(evento) => onActualizar(linea.clave, { cantidad: evento.target.value })}
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
                      onChange={(evento) => onActualizar(linea.clave, { precio: evento.target.value })}
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
                      onChange={(evento) => onActualizar(linea.clave, { descuentoPct: evento.target.value })}
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
                      if (valor) onActualizar(linea.clave, { itbisTasa: valor });
                    }}
                  >
                    <SelectTrigger
                      id={`itbis-${linea.clave}`}
                      className={SELECT_CHICO}
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
                    onClick={() => onQuitar(linea.clave)}
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
              onClick={onAgregar}
            >
              <Plus className="size-4" />
              Agregar línea
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MasOpciones({
  conTerminos,
  conPie,
  notas,
  onNotas,
  terminos,
  onTerminos,
  pie,
  onPie,
}: {
  conTerminos: boolean;
  conPie: boolean;
  notas: string;
  onNotas: (valor: string) => void;
  terminos: string;
  onTerminos: (valor: string) => void;
  pie: string;
  onPie: (valor: string) => void;
}) {
  const columnas = claseColumnasOpciones(1 + (conTerminos ? 1 : 0) + (conPie ? 1 : 0));

  return (
    <section>
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-base leading-6 font-semibold text-slate-700 [&[data-panel-open]>svg]:rotate-180">
          Más opciones
          <ChevronDown className="size-4 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={`grid gap-4 pt-2 ${columnas}`}>
            <Campo>
              <Etiqueta htmlFor="notas">Notas</Etiqueta>
              <Textarea
                id="notas"
                value={notas}
                placeholder="Notas internas o para el cliente"
                onChange={(evento) => onNotas(evento.target.value)}
                className="focus-visible:border-primary min-h-20 border-slate-300 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus-visible:ring-0"
              />
            </Campo>
            {conTerminos ? (
              <Campo>
                <Etiqueta htmlFor="terminos">Términos y condiciones</Etiqueta>
                <Textarea
                  id="terminos"
                  value={terminos}
                  placeholder="Condiciones de pago"
                  onChange={(evento) => onTerminos(evento.target.value)}
                  className="focus-visible:border-primary min-h-20 border-slate-300 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus-visible:ring-0"
                />
              </Campo>
            ) : null}
            {conPie ? (
              <Campo>
                <Etiqueta htmlFor="pie">Pie de factura</Etiqueta>
                <Textarea
                  id="pie"
                  value={pie}
                  placeholder="Texto al pie de la factura"
                  onChange={(evento) => onPie(evento.target.value)}
                  className="focus-visible:border-primary min-h-20 border-slate-300 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus-visible:ring-0"
                />
              </Campo>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

export function DocumentoVentaForm({
  empresa,
  contactos,
  productos,
  cuentas = [],
  fechaHoy,
  titulo,
  etiquetaNumero,
  conComprobante = false,
  conVencimiento = true,
  conPago = false,
  conTerminos = false,
  conPie = false,
  textoGuardar,
  rutaCancelar,
  rutaDestino,
  accion,
  valoresIniciales,
  cotizacionOrigenId,
  numeroActual,
}: Props) {
  const router = useRouter();
  const lineasIniciales =
    valoresIniciales?.lineas && valoresIniciales.lineas.length > 0 ? valoresIniciales.lineas : [lineaVacia("l1")];
  const contador = useRef(lineasIniciales.length);
  const [pendiente, iniciar] = useTransition();

  const [tipo, setTipo] = useState<TipoComprobante>(tipoComprobanteInicial(valoresIniciales?.tipoComprobante));
  const [clienteId, setClienteId] = useState(valoresIniciales?.clienteId ?? "");
  const [fecha, setFecha] = useState(valoresIniciales?.fecha ?? fechaHoy);
  const [vencimiento, setVencimiento] = useState(valoresIniciales?.vencimiento ?? fechaHoy);
  const [lineas, setLineas] = useState<LineaFormulario[]>(lineasIniciales);
  const [notas, setNotas] = useState(valoresIniciales?.notas ?? "");
  const [terminos, setTerminos] = useState(valoresIniciales?.terminos ?? "");
  const [pie, setPie] = useState("");
  const [registrarPago, setRegistrarPago] = useState(false);
  const [cuentaPago, setCuentaPago] = useState(
    cuentas.find((cuenta) => cuenta.codigo === "1101")?.id ?? cuentas[0]?.id ?? "",
  );
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [error, setError] = useState<string | null>(null);

  const clientesItems = contactos.map((contacto) => ({ value: contacto.id, label: contacto.nombre }));
  const comprobantesItems = OPCIONES_TIPO_COMPROBANTE.map((opcion) => ({
    value: opcion.valor,
    label: opcion.etiqueta,
  }));
  const cuentasItems = cuentas.map((cuenta) => ({ value: cuenta.id, label: `${cuenta.codigo} · ${cuenta.nombre}` }));
  const clienteSeleccionado = clientesItems.find((item) => item.value === clienteId) ?? null;

  const { calculadas, totales } = calcularDocumento(lineas);

  function actualizarLinea(clave: string, cambios: Partial<LineaFormulario>) {
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

    const mensaje = mensajeValidacionDocumento({
      clienteId,
      lineas,
      totalCentavos: totales.totalCentavos,
      requiereCuentaPago: conPago && registrarPago,
      cuentaPago,
    });
    if (mensaje) {
      setError(mensaje);
      return;
    }

    const entrada = construirEntrada({
      clienteId,
      fecha,
      vencimiento: conVencimiento ? vencimiento : fecha,
      notas,
      lineas,
      productos,
      ...(conComprobante ? { tipoComprobante: tipo } : {}),
      ...(conTerminos ? { terminos } : {}),
      ...(conPie ? { pie } : {}),
      cotizacionId: cotizacionOrigenId,
      ...(conPago && registrarPago ? { pago: { cuentaId: cuentaPago, metodo: metodoPago } } : {}),
    });

    iniciar(async () => {
      const resultado = await accion(entrada);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(`${rutaDestino}/${resultado.id}`);
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
        <Encabezado
          empresa={empresa}
          conComprobante={conComprobante}
          etiquetaNumero={etiquetaNumero}
          tipo={tipo}
          numeroActual={numeroActual}
          onTipo={setTipo}
          comprobantesItems={comprobantesItems}
        />

        {conPago ? (
          <AjustesPago
            totalCentavos={totales.totalCentavos}
            cuentasItems={cuentasItems}
            registrarPago={registrarPago}
            onRegistrarPago={setRegistrarPago}
            cuentaPago={cuentaPago}
            onCuentaPago={setCuentaPago}
            metodoPago={metodoPago}
            onMetodoPago={setMetodoPago}
          />
        ) : null}

        <section>
          <div className={`mb-4 ${DIVISOR}`} />
          <h2 className={`mb-4 ${TITULO_SECCION}`}>{titulo}</h2>
          <div className={`grid grid-cols-1 gap-8 ${conVencimiento ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <Campo>
              <Etiqueta htmlFor="cliente" requerido>
                Cliente
              </Etiqueta>
              <Combobox
                items={clientesItems}
                value={clienteSeleccionado}
                onValueChange={(item: { value: string; label: string } | null) => setClienteId(item?.value ?? "")}
                itemToStringLabel={(item: { value: string; label: string }) => item.label}
                isItemEqualToValue={(a: { value: string }, b: { value: string }) => a.value === b.value}
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
              <Etiqueta htmlFor="fecha" requerido>
                Fecha de creación
              </Etiqueta>
              <DatePicker id="fecha" value={fecha} onChange={setFecha} />
            </Campo>
            {conVencimiento ? (
              <Campo>
                <Etiqueta htmlFor="vencimiento" requerido>
                  Fecha de vencimiento
                </Etiqueta>
                <DatePicker id="vencimiento" value={vencimiento} onChange={setVencimiento} />
              </Campo>
            ) : null}
          </div>
        </section>

        <LineasDocumento
          lineas={lineas}
          productos={productos}
          calculadas={calculadas}
          onActualizar={actualizarLinea}
          onSeleccionarProducto={seleccionarProducto}
          onAgregar={agregarLinea}
          onQuitar={quitarLinea}
        />

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
              <span>ITBIS</span>
              <span className="tabular-nums">{formatoMonedaCentavos(totales.itbisCentavos)}</span>
            </div>
            <div className="mt-7 flex items-center justify-between text-xl leading-7 font-semibold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">{formatoMonedaCentavos(totales.totalCentavos)}</span>
            </div>
          </div>
        </section>

        <MasOpciones
          conTerminos={conTerminos}
          conPie={conPie}
          notas={notas}
          onNotas={setNotas}
          terminos={terminos}
          onTerminos={setTerminos}
          pie={pie}
          onPie={setPie}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-[12px] px-6 text-base"
          render={<Link href={rutaCancelar} />}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente} className="h-12 rounded-[12px] px-6 text-base">
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          {textoGuardar}
        </Button>
      </div>
    </form>
  );
}
