"use client";

import { useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";

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
import { type ProductoSeleccionable, SelectorProducto } from "@/components/productos/selector-producto";
import { SelectorImpuesto } from "@/components/selector-impuesto";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CentroCostoOpcion } from "@/lib/centros-costo/tipos";
import { centavosAValor } from "@/lib/facturacion/calculo";
import { esTipoComprobante, OPCIONES_TIPO_COMPROBANTE } from "@/lib/facturacion/comprobantes";
import { formatoMoneda, formatoMonedaCentavos } from "@/lib/facturacion/formato";
import type {
  ContactoResumen,
  CuentaCajaBanco,
  Empresa,
  ListaPrecioResumen,
  ProductoResumen,
  TipoComprobante,
} from "@/lib/facturacion/tipos";
import { type Impuesto, impuestoNinguno } from "@/lib/impuestos/tipos";
import { precioSugeridoCentavos } from "@/lib/inventario/precios";
import type { Almacen } from "@/lib/inventario/tipos";
import type { MetodoPago } from "@/lib/pagos/tipos";
import type { VendedorOpcion } from "@/lib/vendedores/tipos";

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
  vendedores?: VendedorOpcion[];
  centrosCosto?: CentroCostoOpcion[];
  notasIniciales?: string;
  terminosIniciales?: string;
  mostrarLogo?: boolean;
  listasPrecios?: ListaPrecioResumen[];
  almacenes?: Almacen[];
  impuestos?: Impuesto[];
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

const CAMPO_BLOQUEADO = "disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:opacity-100";
const CELDA_ENCABEZADO =
  "flex h-10 items-center border-b border-slate-400/20 bg-slate-50 px-1 text-xs leading-4 font-medium text-gray-500";
const SIN_SELECCION = "__ninguno";
const METODOS_PAGO: readonly { value: MetodoPago; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "cheque", label: "Cheque" },
];
function esMetodoPago(valor: string | null): valor is MetodoPago {
  return METODOS_PAGO.some((metodo) => metodo.value === valor);
}

function tipoComprobanteInicial(valor: string | undefined): TipoComprobante {
  return valor && esTipoComprobante(valor) ? valor : "02";
}

interface EstadoInicialDocumento {
  tipo: TipoComprobante;
  clienteId: string;
  fecha: string;
  vencimiento: string;
  lineas: LineaFormulario[];
  notas: string;
  terminos: string;
}

function estadoInicialDocumento(
  valores: ValoresIniciales | undefined,
  fechaHoy: string,
  notasIniciales: string,
  terminosIniciales: string,
): EstadoInicialDocumento {
  const lineas = valores?.lineas && valores.lineas.length > 0 ? valores.lineas : [lineaVacia("l1")];

  return {
    tipo: tipoComprobanteInicial(valores?.tipoComprobante),
    clienteId: valores?.clienteId ?? "",
    fecha: valores?.fecha ?? fechaHoy,
    vencimiento: valores?.vencimiento ?? fechaHoy,
    lineas,
    notas: valores?.notas ?? notasIniciales,
    terminos: valores?.terminos ?? terminosIniciales,
  };
}

function claseColumnasOpciones(campos: number): string {
  if (campos <= 1) return "";
  if (campos === 2) return "md:grid-cols-2";
  return "md:grid-cols-3";
}

interface OpcionesDocumento {
  almacenId: string;
  conComprobante: boolean;
  tipo: TipoComprobante;
  conTerminos: boolean;
  terminos: string;
  conPie: boolean;
  pie: string;
  conPago: boolean;
  registrarPago: boolean;
  cuentaPago: string;
  metodoPago: MetodoPago;
  cotizacionOrigenId?: string;
}

function opcionesDocumento(opciones: OpcionesDocumento) {
  return {
    ...(opciones.almacenId ? { almacenId: opciones.almacenId } : {}),
    ...(opciones.conComprobante ? { tipoComprobante: opciones.tipo } : {}),
    ...(opciones.conTerminos ? { terminos: opciones.terminos } : {}),
    ...(opciones.conPie ? { pie: opciones.pie } : {}),
    ...(opciones.cotizacionOrigenId ? { cotizacionId: opciones.cotizacionOrigenId } : {}),
    ...(opciones.conPago && opciones.registrarPago
      ? { pago: { cuentaId: opciones.cuentaPago, metodo: opciones.metodoPago } }
      : {}),
  };
}

function Encabezado({
  empresa,
  conComprobante,
  etiquetaNumero,
  tipo,
  numeroActual,
  onTipo,
  comprobantesItems,
  mostrarLogo,
}: {
  empresa: Empresa | null;
  conComprobante: boolean;
  etiquetaNumero: string;
  tipo: TipoComprobante;
  numeroActual?: string;
  onTipo: (tipo: TipoComprobante) => void;
  comprobantesItems: OpcionSelect[];
  mostrarLogo: boolean;
}) {
  function cambiarTipo(valor: string | null) {
    if (valor && esTipoComprobante(valor)) onTipo(valor);
  }

  return (
    <header className="flex flex-col gap-4 py-3 md:flex-row md:items-center md:justify-between md:gap-6 md:py-6 lg:py-8">
      <div className="flex min-w-0 justify-center md:w-1/3 md:justify-start">
        {mostrarLogo ? (
          // biome-ignore lint/performance/noImgElement: logo configurable de la empresa
          <img
            src={empresa?.logo_url?.trim() || "/marca/logo-medoxigas.png"}
            alt={empresa?.nombre ?? "Medoxigas"}
            className="h-[72px] w-auto object-contain md:h-24"
          />
        ) : null}
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
      <FormSectionTitle className="mb-4">Ajustes</FormSectionTitle>
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-5">
        <FormField htmlFor="moneda" label="Moneda">
          <Input id="moneda" readOnly value="DOP · Peso dominicano" className={FORM_INPUT} />
        </FormField>

        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-1 text-sm leading-5 font-medium text-slate-700">Pago recibido</span>
          <div className="flex h-10 items-center gap-2">
            <Checkbox id="registrar-pago" checked={registrarPago} onCheckedChange={(valor) => onRegistrarPago(valor)} />
            <Label htmlFor="registrar-pago" className="text-sm leading-5 font-medium text-slate-700">
              Registrar
            </Label>
          </div>
        </div>

        <FormField htmlFor="cuenta-pago" label="Cuenta de caja o banco">
          <Select
            items={cuentasItems}
            value={cuentaPago}
            disabled={!registrarPago}
            onValueChange={(valor: string | null) => onCuentaPago(valor ?? "")}
          >
            <SelectTrigger id="cuenta-pago" className={FORM_SELECT}>
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
        </FormField>

        <FormField htmlFor="metodo-pago" label="Método de pago">
          <Select items={METODOS_PAGO} value={metodoPago} disabled={!registrarPago} onValueChange={cambiarMetodo}>
            <SelectTrigger id="metodo-pago" className={FORM_SELECT}>
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
        </FormField>

        <FormField htmlFor="monto-pago" label="Monto">
          <Input
            id="monto-pago"
            readOnly
            disabled={!registrarPago}
            value={formatoMoneda(totalCentavos / 100)}
            className={`${FORM_INPUT} ${CAMPO_BLOQUEADO}`}
          />
        </FormField>
      </div>
    </section>
  );
}

function LineasDocumento({
  lineas,
  productos,
  impuestos,
  calculadas,
  onActualizar,
  onSeleccionarProducto,
  onAgregar,
  onQuitar,
}: {
  lineas: LineaFormulario[];
  productos: readonly ProductoSeleccionable[];
  impuestos: Impuesto[];
  calculadas: LineaCalculadaFormulario[];
  onActualizar: (clave: string, cambios: Partial<LineaFormulario>) => void;
  onSeleccionarProducto: (clave: string, producto: ProductoSeleccionable | null) => void;
  onAgregar: () => void;
  onQuitar: (clave: string) => void;
}) {
  return (
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
            const producto = productos.find((item) => item.id === linea.productoId);

            return (
              <div key={linea.clave} className="contents">
                <div className="flex justify-center py-2 pr-1 text-xs leading-10 text-slate-500">{indice + 1}</div>
                <div className="min-w-0 py-2 pr-1">
                  <SelectorProducto
                    id={`producto-${linea.clave}`}
                    productos={productos}
                    valor={linea.productoId}
                    onCambio={(producto) => onSeleccionarProducto(linea.clave, producto)}
                    className={`${FORM_COMBO} border [&>input]:text-sm`}
                    aria-label={`Producto de la línea ${indice + 1}`}
                  />
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
                      onChange={(evento) => onActualizar(linea.clave, { precio: evento.target.value })}
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
                      onChange={(evento) => onActualizar(linea.clave, { descuentoPct: evento.target.value })}
                      aria-label={`Descuento de la línea ${indice + 1}`}
                      className="h-full min-w-0 pl-1 text-sm text-slate-700 md:text-sm"
                    />
                  </InputGroup>
                </div>
                <div className="min-w-0 py-2 pr-1">
                  <SelectorImpuesto
                    id={`itbis-${linea.clave}`}
                    className={FORM_SELECT}
                    ariaLabel={`Impuesto de la lA-nea ${indice + 1}`}
                    impuestos={impuestos}
                    value={linea.impuestoId}
                    onValueChange={(impuestoId) => {
                      const impuesto = impuestos.find((item) => item.id === impuestoId);
                      onActualizar(linea.clave, {
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
  vendedoresItems,
  vendedorId,
  onVendedor,
  centrosItems,
  centroCostoId,
  onCentroCosto,
  listasPrecios,
  listaPrecioId,
  onListaPrecio,
  almacenes,
  almacenId,
  onAlmacen,
}: {
  conTerminos: boolean;
  conPie: boolean;
  notas: string;
  onNotas: (valor: string) => void;
  terminos: string;
  onTerminos: (valor: string) => void;
  pie: string;
  onPie: (valor: string) => void;
  vendedoresItems: OpcionSelect[];
  vendedorId: string;
  onVendedor: (valor: string) => void;
  centrosItems: OpcionSelect[];
  centroCostoId: string;
  onCentroCosto: (valor: string) => void;
  listasPrecios: ListaPrecioResumen[];
  listaPrecioId: string;
  onListaPrecio: (valor: string) => void;
  almacenes: Almacen[];
  almacenId: string;
  onAlmacen: (valor: string) => void;
}) {
  const columnas = claseColumnasOpciones(
    1 +
      (conTerminos ? 1 : 0) +
      (conPie ? 1 : 0) +
      (vendedoresItems.length > 1 ? 1 : 0) +
      (centrosItems.length > 1 ? 1 : 0) +
      (listasPrecios.length > 0 ? 1 : 0) +
      (almacenes.length > 0 ? 1 : 0),
  );
  const opcionesListas = listasPrecios.map((lista) => ({
    value: lista.id,
    label: lista.es_principal ? `${lista.nombre} (principal)` : lista.nombre,
  }));
  const opcionesAlmacenes = almacenes.map((almacen) => ({
    value: almacen.id,
    label: almacen.es_principal ? `${almacen.nombre} (principal)` : almacen.nombre,
  }));

  return (
    <section>
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-base leading-6 font-semibold text-slate-700 [&[data-panel-open]>svg]:rotate-180">
          Más opciones
          <ChevronDown className="size-4 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={`grid gap-x-8 gap-y-4 pt-2 ${columnas}`}>
            {listasPrecios.length > 0 ? (
              <FormField htmlFor="lista-precios" label="Lista de precios">
                <Select
                  items={opcionesListas}
                  value={listaPrecioId}
                  onValueChange={(valor: string | null) => onListaPrecio(valor ?? "")}
                >
                  <SelectTrigger id="lista-precios" className={FORM_SELECT}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {opcionesListas.map((opcion) => (
                      <SelectItem key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            ) : null}
            {almacenes.length > 0 ? (
              <FormField htmlFor="almacen-documento" label="Almacén">
                <Select
                  items={opcionesAlmacenes}
                  value={almacenId}
                  onValueChange={(valor: string | null) => onAlmacen(valor ?? "")}
                >
                  <SelectTrigger id="almacen-documento" className={FORM_SELECT}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {opcionesAlmacenes.map((opcion) => (
                      <SelectItem key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            ) : null}
            <FormField htmlFor="notas" label="Notas">
              <Textarea
                id="notas"
                value={notas}
                placeholder="Notas internas o para el cliente"
                onChange={(evento) => onNotas(evento.target.value)}
                className={FORM_TEXTAREA}
              />
            </FormField>
            {conTerminos ? (
              <FormField htmlFor="terminos" label="Términos y condiciones">
                <Textarea
                  id="terminos"
                  value={terminos}
                  placeholder="Condiciones de pago"
                  onChange={(evento) => onTerminos(evento.target.value)}
                  className={FORM_TEXTAREA}
                />
              </FormField>
            ) : null}
            {vendedoresItems.length > 1 ? (
              <FormField htmlFor="vendedor" label="Vendedor">
                <Select
                  items={vendedoresItems}
                  value={vendedorId || SIN_SELECCION}
                  onValueChange={(valor: string | null) =>
                    onVendedor(valor == null || valor === SIN_SELECCION ? "" : valor)
                  }
                >
                  <SelectTrigger id="vendedor" className={FORM_SELECT}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {vendedoresItems.map((opcion) => (
                      <SelectItem key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            ) : null}
            {centrosItems.length > 1 ? (
              <FormField htmlFor="centro-costo" label="Centro de costo">
                <Select
                  items={centrosItems}
                  value={centroCostoId || SIN_SELECCION}
                  onValueChange={(valor: string | null) =>
                    onCentroCosto(valor == null || valor === SIN_SELECCION ? "" : valor)
                  }
                >
                  <SelectTrigger id="centro-costo" className={FORM_SELECT}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {centrosItems.map((opcion) => (
                      <SelectItem key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            ) : null}
            {conPie ? (
              <FormField htmlFor="pie" label="Pie de factura">
                <Textarea
                  id="pie"
                  value={pie}
                  placeholder="Texto al pie de la factura"
                  onChange={(evento) => onPie(evento.target.value)}
                  className={FORM_TEXTAREA}
                />
              </FormField>
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
  vendedores = [],
  centrosCosto = [],
  notasIniciales = "",
  terminosIniciales = "",
  mostrarLogo = true,
  listasPrecios = [],
  almacenes = [],
  impuestos = [],
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
  const inicial = estadoInicialDocumento(valoresIniciales, fechaHoy, notasIniciales, terminosIniciales);
  const contador = useRef(inicial.lineas.length);
  const [pendiente, iniciar] = useTransition();

  const [tipo, setTipo] = useState<TipoComprobante>(inicial.tipo);
  const [clienteId, setClienteId] = useState(inicial.clienteId);
  const [productosLocales, setProductosLocales] = useState<readonly ProductoSeleccionable[]>(productos);
  const [fecha, setFecha] = useState(inicial.fecha);
  const [vencimiento, setVencimiento] = useState(inicial.vencimiento);
  const [lineas, setLineas] = useState<LineaFormulario[]>(() =>
    inicial.lineas.map((linea) => ({
      ...linea,
      impuestoId: linea.impuestoId !== "" ? linea.impuestoId : (impuestoNinguno(impuestos)?.id ?? ""),
    })),
  );
  const [notas, setNotas] = useState(inicial.notas);
  const [terminos, setTerminos] = useState(inicial.terminos);
  const [pie, setPie] = useState("");
  const [vendedorId, setVendedorId] = useState(valoresIniciales?.vendedorId ?? "");
  const [centroCostoId, setCentroCostoId] = useState(valoresIniciales?.centroCostoId ?? "");
  const [registrarPago, setRegistrarPago] = useState(false);
  const [cuentaPago, setCuentaPago] = useState(
    cuentas.find((cuenta) => cuenta.codigo === "1101")?.id ?? cuentas[0]?.id ?? "",
  );
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [listaPrecioId, setListaPrecioId] = useState(listasPrecios.find((lista) => lista.es_principal)?.id ?? "");
  const [almacenId, setAlmacenId] = useState(
    almacenes.find((almacen) => almacen.es_principal)?.id ?? almacenes[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  const comprobantesItems = OPCIONES_TIPO_COMPROBANTE.map((opcion) => ({
    value: opcion.valor,
    label: opcion.etiqueta,
  }));
  const cuentasItems = cuentas.map((cuenta) => ({ value: cuenta.id, label: `${cuenta.codigo} · ${cuenta.nombre}` }));
  const vendedoresItems = [
    { value: SIN_SELECCION, label: "Sin vendedor" },
    ...vendedores.map((vendedor) => ({ value: vendedor.id, label: vendedor.nombre })),
  ];
  const centrosItems = [
    { value: SIN_SELECCION, label: "Sin centro" },
    ...centrosCosto.map((centro) => ({ value: centro.id, label: `${centro.codigo} · ${centro.nombre}` })),
  ];
  const { calculadas, totales } = calcularDocumento(lineas);

  function actualizarLinea(clave: string, cambios: Partial<LineaFormulario>) {
    setLineas((actuales) => actuales.map((linea) => (linea.clave === clave ? { ...linea, ...cambios } : linea)));
  }

  function precioDeProducto(producto: ProductoSeleccionable, listaId: string): string {
    const centavos = precioSugeridoCentavos(producto.precio, listasPrecios, producto.precios ?? [], listaId);
    return centavosAValor(centavos).toFixed(2);
  }

  function seleccionarProducto(clave: string, producto: ProductoSeleccionable | null) {
    if (!producto) {
      actualizarLinea(clave, { productoId: "" });
      return;
    }

    setProductosLocales((actuales) =>
      actuales.some((item) => item.id === producto.id) ? actuales : [...actuales, producto],
    );
    actualizarLinea(clave, {
      productoId: producto.id,
      precio: precioDeProducto(producto, listaPrecioId),
      impuestoId: producto.impuesto_id ?? "",
      itbisTasa: String(producto.itbis_tasa),
    });
  }

  function seleccionarCliente(contacto: ContactoOpcion | null) {
    setClienteId(contacto?.id ?? "");
    const lista = contacto?.lista_precio_id;
    if (lista && listasPrecios.some((opcion) => opcion.id === lista)) cambiarListaPrecio(lista);
  }

  function cambiarListaPrecio(listaId: string) {
    setListaPrecioId(listaId);
    setLineas((actuales) =>
      actuales.map((linea) => {
        const producto = productosLocales.find((item) => item.id === linea.productoId);
        return producto ? { ...linea, precio: precioDeProducto(producto, listaId) } : linea;
      }),
    );
  }

  function agregarLinea() {
    contador.current += 1;
    setLineas((actuales) => [
      ...actuales,
      lineaVacia(`l${contador.current}`, impuestoNinguno(impuestos)?.id ?? "", "0"),
    ]);
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
      productos: productosLocales,
      vendedorId,
      centroCostoId,
      ...opcionesDocumento({
        almacenId,
        conComprobante,
        tipo,
        conTerminos,
        terminos,
        conPie,
        pie,
        conPago,
        registrarPago,
        cuentaPago,
        metodoPago,
        cotizacionOrigenId,
      }),
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

      <FormCard className="gap-6 p-4 sm:p-5">
        <Encabezado
          empresa={empresa}
          conComprobante={conComprobante}
          etiquetaNumero={etiquetaNumero}
          tipo={tipo}
          numeroActual={numeroActual}
          onTipo={setTipo}
          comprobantesItems={comprobantesItems}
          mostrarLogo={mostrarLogo}
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
          <FormDivider className="mb-4" />
          <FormSectionTitle className="mb-4">{titulo}</FormSectionTitle>
          <div className={`grid grid-cols-1 gap-x-8 gap-y-4 ${conVencimiento ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <FormField htmlFor="cliente" label="Cliente" required>
              <SelectorContacto
                id="cliente"
                contactos={contactos}
                valor={clienteId}
                onCambio={seleccionarCliente}
                tipoInicial="cliente"
                className={FORM_COMBO}
                placeholder="Buscar cliente…"
              />
            </FormField>
            <FormField htmlFor="fecha" label="Fecha de creación" required>
              <DatePicker id="fecha" value={fecha} onChange={setFecha} />
            </FormField>
            {conVencimiento ? (
              <FormField htmlFor="vencimiento" label="Fecha de vencimiento" required>
                <DatePicker id="vencimiento" value={vencimiento} onChange={setVencimiento} />
              </FormField>
            ) : null}
          </div>
        </section>

        <LineasDocumento
          lineas={lineas}
          productos={productosLocales}
          impuestos={impuestos}
          calculadas={calculadas}
          onActualizar={actualizarLinea}
          onSeleccionarProducto={seleccionarProducto}
          onAgregar={agregarLinea}
          onQuitar={quitarLinea}
        />

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
            <span>Impuestos</span>
            <span className="tabular-nums">{formatoMonedaCentavos(totales.itbisCentavos)}</span>
          </div>
          <div className="mt-7 flex items-center justify-between text-xl leading-7 font-semibold text-slate-900">
            <span>Total</span>
            <span className="tabular-nums">{formatoMonedaCentavos(totales.totalCentavos)}</span>
          </div>
        </FormTotal>

        <MasOpciones
          conTerminos={conTerminos}
          conPie={conPie}
          notas={notas}
          onNotas={setNotas}
          terminos={terminos}
          onTerminos={setTerminos}
          pie={pie}
          onPie={setPie}
          vendedoresItems={vendedoresItems}
          vendedorId={vendedorId}
          onVendedor={setVendedorId}
          centrosItems={centrosItems}
          centroCostoId={centroCostoId}
          onCentroCosto={setCentroCostoId}
          listasPrecios={listasPrecios}
          listaPrecioId={listaPrecioId}
          onListaPrecio={cambiarListaPrecio}
          almacenes={almacenes}
          almacenId={almacenId}
          onAlmacen={setAlmacenId}
        />
      </FormCard>

      <FormActions>
        <Button type="button" variant="outline" className={FORM_BUTTON} render={<Link href={rutaCancelar} />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente} className={FORM_BUTTON}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          {textoGuardar}
        </Button>
      </FormActions>
    </form>
  );
}
