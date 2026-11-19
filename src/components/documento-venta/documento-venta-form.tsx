"use client";

import { type Dispatch, type ReactNode, type SetStateAction, useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronDown, Eye, Loader2, Plus, Settings, Trash2, X } from "lucide-react";

import { type ContactoOpcion, SelectorContacto } from "@/components/contactos/selector-contacto";
import { DatePicker } from "@/components/date-picker";
import {
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import type { CentroCostoOpcion } from "@/lib/centros-costo/tipos";
import type { PrevisualizacionNumero } from "@/lib/cotizaciones/numero";
import type { DocumentoLinea } from "@/lib/cotizaciones/tipos";
import { centavosAValor, parsearCentavos, type TotalesFactura } from "@/lib/facturacion/calculo";
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
import { formatoDia } from "@/lib/formato";
import { type Impuesto, impuestoNinguno } from "@/lib/impuestos/tipos";
import { precioSugeridoCentavos } from "@/lib/inventario/precios";
import type { Almacen } from "@/lib/inventario/tipos";
import { type PrevisualizacionNcf, previsualizarNcf } from "@/lib/numeraciones/preview";
import type { Numeracion } from "@/lib/numeraciones/tipos";
import type { MetodoPago } from "@/lib/pagos/tipos";
import type { VendedorOpcion } from "@/lib/vendedores/tipos";

import {
  type CampoDocumento,
  calcularDocumento,
  claveErrorDocumento,
  construirEntrada,
  type ErrorDocumento,
  erroresValidacionDocumento,
  idCampoDocumento,
  type LineaCalculadaFormulario,
  type LineaFormulario,
  lineaVacia,
  numero,
} from "./calculo";
import { DocumentoPapel } from "./documento-papel";
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
  /** Próximo número de cotización o conduce, calculado en el servidor sin consumirlo. */
  vistaNumero?: PrevisualizacionNumero;
  /** Numeraciones para previsualizar el NCF antes de guardar (solo facturas). */
  numeraciones?: Numeracion[];
}

interface OpcionSelect {
  value: string;
  label: string;
}

const CAMPO_BLOQUEADO = "disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:opacity-100";
/** Campos chicos (32 px) de la fila "Ajustes", como en Alegra (guía de factura §6.1). */
const FORM_INPUT_CHICO =
  "h-8 rounded-lg border-slate-300 bg-white px-2 text-sm text-slate-700 placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary dark:bg-white";
const FORM_SELECT_CHICO =
  "w-full rounded-lg border-slate-300 bg-white px-2 text-sm text-slate-700 hover:border-slate-400 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary data-[size=default]:h-8 dark:bg-white";
/** Botones grandes del pie (48 px), como en Alegra (guía de factura §6.5). */
const BOTON_GRANDE = "h-12 rounded-[12px] px-6 text-base font-medium";
const CAJA_NUMERO = "flex h-14 w-[215px] shrink-0 items-center gap-2.5 rounded-[10px] bg-white px-3 text-base";
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

/** Columnas de la fila "Ajustes": iguales al número de campos visibles (máximo 5, como Alegra). */
function claseColumnasAjustes(campos: number): string {
  if (campos <= 1) return "";
  if (campos === 2) return "sm:grid-cols-2";
  if (campos === 3) return "sm:grid-cols-3";
  if (campos === 4) return "sm:grid-cols-4";
  return "sm:grid-cols-5";
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

function NumeroComprobante({
  etiqueta,
  numeroActual,
  vistaNumero,
  vistaNcf,
}: {
  etiqueta: string;
  numeroActual?: string;
  vistaNumero?: PrevisualizacionNumero;
  vistaNcf?: PrevisualizacionNcf | null;
}) {
  if (vistaNcf) {
    const hayNumero = vistaNcf.estado === "lista";

    return (
      <div className="w-full">
        <div className="flex w-full items-center justify-between gap-2.5">
          <div className={CAJA_NUMERO} title="El NCF se asigna al guardar la factura">
            <span className="text-slate-500">{etiqueta}</span>
            <span className="truncate text-slate-700 tabular-nums" aria-live="polite">
              {hayNumero ? vistaNcf.ncf : "—"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 rounded-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            render={<Link href="/dashboard/contabilidad/numeraciones" prefetch={false} />}
            aria-label="Configurar numeración"
            title="Configurar numeración"
          >
            <Settings className="size-4" aria-hidden="true" />
          </Button>
        </div>
        {hayNumero ? null : (
          <p className="text-destructive mt-1 max-w-[215px] text-xs leading-4" role="status">
            {vistaNcf.mensaje}
          </p>
        )}
      </div>
    );
  }

  if (vistaNumero) {
    const hayNumero = vistaNumero.estado === "lista";

    return (
      <div className="w-full">
        <div className="flex w-full justify-end">
          <div className={CAJA_NUMERO} title="El número se asigna al guardar el documento">
            <span className="text-slate-500">{etiqueta}</span>
            <span className="truncate text-slate-700 tabular-nums" aria-live="polite">
              {hayNumero ? String(vistaNumero.numero) : "—"}
            </span>
          </div>
        </div>
        {hayNumero ? null : (
          <p className="text-destructive mt-1 ml-auto max-w-[215px] text-xs leading-4" role="status">
            {vistaNumero.mensaje}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 pl-2.5 text-base">
      <span className="text-slate-500">{etiqueta}</span>
      <span className="truncate text-slate-700 tabular-nums">{numeroActual ?? "Se asigna al guardar"}</span>
    </div>
  );
}

function Encabezado({
  empresa,
  conComprobante,
  etiquetaNumero,
  tipo,
  numeroActual,
  vistaNumero,
  vistaNcf,
  onTipo,
  comprobantesItems,
  mostrarLogo,
}: {
  empresa: Empresa | null;
  conComprobante: boolean;
  etiquetaNumero: string;
  tipo: TipoComprobante;
  numeroActual?: string;
  vistaNumero?: PrevisualizacionNumero;
  vistaNcf?: PrevisualizacionNcf | null;
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
        <NumeroComprobante
          etiqueta={conComprobante ? "NCF" : etiquetaNumero}
          numeroActual={numeroActual}
          vistaNumero={vistaNumero}
          vistaNcf={vistaNcf}
        />
      </div>
    </header>
  );
}

function SelectAjuste({
  id,
  etiqueta,
  items,
  value,
  onValueChange,
}: {
  id: string;
  etiqueta: string;
  items: OpcionSelect[];
  value: string;
  onValueChange: (valor: string) => void;
}) {
  return (
    <FormField htmlFor={id} label={etiqueta}>
      <Select items={items} value={value} onValueChange={(valor: string | null) => onValueChange(valor ?? "")}>
        <SelectTrigger id={id} className={FORM_SELECT_CHICO}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {items.map((opcion) => (
            <SelectItem key={opcion.value} value={opcion.value}>
              {opcion.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

/** Fila "Ajustes" de Alegra: Moneda, Vendedor, Almacén, Centro de costo y Lista de precios. */
function AjustesDocumento({
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
  const opcionesListas = listasPrecios.map((lista) => ({
    value: lista.id,
    label: lista.es_principal ? `${lista.nombre} (principal)` : lista.nombre,
  }));
  const opcionesAlmacenes = almacenes.map((almacen) => ({
    value: almacen.id,
    label: almacen.es_principal ? `${almacen.nombre} (principal)` : almacen.nombre,
  }));
  const columnas = claseColumnasAjustes(
    1 +
      (vendedoresItems.length > 1 ? 1 : 0) +
      (almacenes.length > 0 ? 1 : 0) +
      (centrosItems.length > 1 ? 1 : 0) +
      (listasPrecios.length > 0 ? 1 : 0),
  );

  return (
    <section>
      <FormSectionTitle className="mb-4">Ajustes</FormSectionTitle>
      <div className={`grid grid-cols-1 gap-4 ${columnas}`}>
        <FormField htmlFor="moneda" label="Moneda">
          <Input id="moneda" readOnly value="DOP · Peso dominicano" className={FORM_INPUT_CHICO} />
        </FormField>
        {vendedoresItems.length > 1 ? (
          <SelectAjuste
            id="vendedor"
            etiqueta="Vendedor"
            items={vendedoresItems}
            value={vendedorId || SIN_SELECCION}
            onValueChange={(valor) => onVendedor(valor === SIN_SELECCION ? "" : valor)}
          />
        ) : null}
        {almacenes.length > 0 ? (
          <SelectAjuste
            id="almacen-documento"
            etiqueta="Almacén"
            items={opcionesAlmacenes}
            value={almacenId}
            onValueChange={onAlmacen}
          />
        ) : null}
        {centrosItems.length > 1 ? (
          <SelectAjuste
            id="centro-costo"
            etiqueta="Centro de costo"
            items={centrosItems}
            value={centroCostoId || SIN_SELECCION}
            onValueChange={(valor) => onCentroCosto(valor === SIN_SELECCION ? "" : valor)}
          />
        ) : null}
        {listasPrecios.length > 0 ? (
          <SelectAjuste
            id="lista-precios"
            etiqueta="Lista de precios"
            items={opcionesListas}
            value={listaPrecioId}
            onValueChange={onListaPrecio}
          />
        ) : null}
      </div>
    </section>
  );
}

/** Bloque "Pago recibido" de Alegra: segunda tarjeta debajo de la principal, con numeración, fecha, cuenta, método y valor. */
function PagoRecibidoDocumento({
  totalCentavos,
  fecha,
  cuentasItems,
  registrarPago,
  onRegistrarPago,
  cuentaPago,
  onCuentaPago,
  metodoPago,
  onMetodoPago,
  errorCuenta,
}: {
  totalCentavos: number;
  fecha: string;
  cuentasItems: OpcionSelect[];
  registrarPago: boolean;
  onRegistrarPago: (valor: boolean) => void;
  cuentaPago: string;
  onCuentaPago: (valor: string) => void;
  metodoPago: MetodoPago;
  onMetodoPago: (valor: MetodoPago) => void;
  errorCuenta?: string;
}) {
  function cambiarMetodo(valor: string | null) {
    if (esMetodoPago(valor)) onMetodoPago(valor);
  }

  return (
    <FormCard className="gap-4 p-3 sm:gap-6 sm:p-5 md:gap-8 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <FormSectionTitle descripcion="Puede agregar un pago ya recibido por esta venta.">
          Pago recibido
        </FormSectionTitle>
        <Button
          type="button"
          variant="ghost"
          className="text-primary h-9 shrink-0 gap-1 rounded-[10px] px-4 text-sm font-medium hover:bg-slate-200/45"
          onClick={() => onRegistrarPago(!registrarPago)}
        >
          {registrarPago ? <X className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {registrarPago ? "Quitar pago" : "Agregar pago"}
        </Button>
      </div>

      {registrarPago ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <FormField htmlFor="numeracion-pago" label="Numeración">
              <Input
                id="numeracion-pago"
                readOnly
                disabled
                value="Se asigna al guardar"
                className={`${FORM_INPUT} ${CAMPO_BLOQUEADO}`}
              />
            </FormField>

            <FormField htmlFor="fecha-pago" label="Fecha">
              <Input
                id="fecha-pago"
                readOnly
                disabled
                value={formatoDia(fecha)}
                className={`${FORM_INPUT} ${CAMPO_BLOQUEADO}`}
              />
            </FormField>

            <FormField htmlFor="cuenta-pago" label="Cuenta de caja o banco" error={errorCuenta}>
              <Select
                items={cuentasItems}
                value={cuentaPago}
                onValueChange={(valor: string | null) => onCuentaPago(valor ?? "")}
              >
                <SelectTrigger
                  id="cuenta-pago"
                  className={FORM_SELECT}
                  aria-invalid={errorCuenta ? true : undefined}
                  aria-describedby={errorCuenta ? "cuenta-pago-error" : undefined}
                >
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
              <Select items={METODOS_PAGO} value={metodoPago} onValueChange={cambiarMetodo}>
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

            <FormField htmlFor="monto-pago" label="Valor">
              <Input
                id="monto-pago"
                readOnly
                disabled
                value={formatoMoneda(totalCentavos / 100)}
                className={`${FORM_INPUT} tabular-nums ${CAMPO_BLOQUEADO}`}
              />
            </FormField>
          </div>
          <p className="text-sm leading-5 text-slate-500">
            Al guardar la factura se creará un recibo de caja por un valor de{" "}
            <span className="tabular-nums">{formatoMoneda(totalCentavos / 100)}</span>.
          </p>
        </>
      ) : null}
    </FormCard>
  );
}

function propsError(mensaje: string | undefined, id: string) {
  return mensaje ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};
}

function ErrorInline({ id, mensaje }: { id: string; mensaje?: string }) {
  if (!mensaje) return null;

  return (
    <p id={`${id}-error`} role="alert" className="text-destructive mt-1 text-xs leading-4">
      {mensaje}
    </p>
  );
}

type ActualizarErrores = Dispatch<SetStateAction<ErrorDocumento[]>>;

function limpiarError(setErrores: ActualizarErrores, campo: string) {
  setErrores((actuales) => {
    const siguientes = actuales.filter((item) => claveErrorDocumento(item.campo) !== campo);
    return siguientes.length === actuales.length ? actuales : siguientes;
  });
}

function limpiarErroresDeLinea(setErrores: ActualizarErrores, clave: string) {
  setErrores((actuales) => {
    const siguientes = actuales.filter((item) => typeof item.campo === "string" || item.campo.linea !== clave);
    return siguientes.length === actuales.length ? actuales : siguientes;
  });
}

function enfocarCampo(campo: CampoDocumento) {
  const id = idCampoDocumento(campo);
  requestAnimationFrame(() => {
    const elemento = document.getElementById(id);
    if (!elemento) return;
    elemento.scrollIntoView({ block: "center", behavior: "smooth" });
    elemento.focus({ preventScroll: true });
  });
}

/** Muestra los errores inline y el toast, enfoca el primero y dice si el documento puede guardarse. */
function mostrarErroresDocumento(erroresDocumento: ErrorDocumento[], setErrores: ActualizarErrores): boolean {
  if (erroresDocumento.length === 0) {
    setErrores([]);
    return true;
  }

  setErrores(erroresDocumento);
  toast.add({
    type: "error",
    title: "Revise los campos obligatorios",
    description: "Asegúrese de completar todos los campos marcados en rojo",
  });
  const primero = erroresDocumento[0];
  if (primero) enfocarCampo(primero.campo);
  return false;
}

function FilaLinea({
  linea,
  indice,
  productos,
  producto,
  calculo,
  impuestos,
  onActualizar,
  onSeleccionarProducto,
  onQuitar,
  puedeQuitar,
  errorDe,
}: {
  linea: LineaFormulario;
  indice: number;
  productos: readonly ProductoSeleccionable[];
  producto: ProductoSeleccionable | undefined;
  calculo: LineaCalculadaFormulario["calculo"] | undefined;
  impuestos: Impuesto[];
  onActualizar: (clave: string, cambios: Partial<LineaFormulario>) => void;
  onSeleccionarProducto: (clave: string, producto: ProductoSeleccionable | null) => void;
  onQuitar: (clave: string) => void;
  puedeQuitar: boolean;
  errorDe: (campo: string) => string | undefined;
}) {
  const clave = linea.clave;
  const errorProducto = errorDe(`producto:${clave}`);
  const errorCantidad = errorDe(`cantidad:${clave}`);
  const errorPrecio = errorDe(`precio:${clave}`);
  const errorDescuento = errorDe(`descuento:${clave}`);

  return (
    <div className="contents">
      <div className="flex justify-center py-2 pr-1 text-xs leading-10 text-slate-500">{indice + 1}</div>
      <div className="min-w-0 py-2 pr-1">
        <SelectorProducto
          id={`producto-${clave}`}
          productos={productos}
          valor={linea.productoId}
          onCambio={(seleccionado) => onSeleccionarProducto(clave, seleccionado)}
          className={`${FORM_COMBO} border [&>input]:text-sm`}
          aria-label={`Producto de la línea ${indice + 1}`}
          {...propsError(errorProducto, `producto-${clave}`)}
        />
        {producto?.referencia ? (
          <p className="mt-1 text-xs leading-4 text-slate-500">Ref. {producto.referencia}</p>
        ) : null}
        <ErrorInline id={`producto-${clave}`} mensaje={errorProducto} />
      </div>
      <div className="min-w-0 py-2 pr-1">
        <Input
          id={`cantidad-${clave}`}
          inputMode="decimal"
          value={linea.cantidad}
          onChange={(evento) => onActualizar(clave, { cantidad: evento.target.value })}
          aria-label={`Cantidad de la línea ${indice + 1}`}
          className={FORM_INPUT}
          {...propsError(errorCantidad, `cantidad-${clave}`)}
        />
        <ErrorInline id={`cantidad-${clave}`} mensaje={errorCantidad} />
      </div>
      <div className="min-w-0 py-2 pr-1">
        <InputGroup className={FORM_INPUT_GROUP}>
          <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
            RD$
          </InputGroupAddon>
          <InputGroupInput
            id={`precio-${clave}`}
            inputMode="decimal"
            value={linea.precio}
            onChange={(evento) => onActualizar(clave, { precio: evento.target.value })}
            aria-label={`Precio de la línea ${indice + 1}`}
            className="h-full min-w-0 pl-1 text-sm text-slate-700 md:text-sm"
            {...propsError(errorPrecio, `precio-${clave}`)}
          />
        </InputGroup>
        <ErrorInline id={`precio-${clave}`} mensaje={errorPrecio} />
      </div>
      <div className="min-w-0 py-2 pr-1">
        <InputGroup className={FORM_INPUT_GROUP}>
          <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
            %
          </InputGroupAddon>
          <InputGroupInput
            id={`descuento-${clave}`}
            inputMode="decimal"
            value={linea.descuentoPct}
            onChange={(evento) => onActualizar(clave, { descuentoPct: evento.target.value })}
            aria-label={`Descuento de la línea ${indice + 1}`}
            className="h-full min-w-0 pl-1 text-sm text-slate-700 md:text-sm"
            {...propsError(errorDescuento, `descuento-${clave}`)}
          />
        </InputGroup>
        <ErrorInline id={`descuento-${clave}`} mensaje={errorDescuento} />
      </div>
      <div className="min-w-0 py-2 pr-1">
        <SelectorImpuesto
          id={`itbis-${clave}`}
          className={FORM_SELECT}
          ariaLabel={`Impuesto de la línea ${indice + 1}`}
          impuestos={impuestos}
          value={linea.impuestoId}
          onValueChange={(impuestoId) => {
            const impuesto = impuestos.find((item) => item.id === impuestoId);
            onActualizar(clave, {
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
          disabled={!puedeQuitar}
          onClick={() => onQuitar(clave)}
        >
          <Trash2 />
          <span className="sr-only">Quitar línea {indice + 1}</span>
        </Button>
      </div>
    </div>
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
  errorDe,
  errorGeneral,
}: {
  lineas: LineaFormulario[];
  productos: readonly ProductoSeleccionable[];
  impuestos: Impuesto[];
  calculadas: LineaCalculadaFormulario[];
  onActualizar: (clave: string, cambios: Partial<LineaFormulario>) => void;
  onSeleccionarProducto: (clave: string, producto: ProductoSeleccionable | null) => void;
  onAgregar: () => void;
  onQuitar: (clave: string) => void;
  errorDe: (campo: string) => string | undefined;
  errorGeneral?: string;
}) {
  return (
    <section>
      <FormDivider className="mb-4" />
      <FormSectionTitle className="mb-4">Productos y servicios</FormSectionTitle>
      {errorGeneral ? (
        <p id="lineas-error" role="alert" tabIndex={-1} className="text-destructive mb-2 text-xs leading-4">
          {errorGeneral}
        </p>
      ) : null}
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

          {lineas.map((linea, indice) => (
            <FilaLinea
              key={linea.clave}
              linea={linea}
              indice={indice}
              productos={productos}
              producto={productos.find((item) => item.id === linea.productoId)}
              calculo={calculadas.find((item) => item.clave === linea.clave)?.calculo}
              impuestos={impuestos}
              onActualizar={onActualizar}
              onSeleccionarProducto={onSeleccionarProducto}
              onQuitar={onQuitar}
              puedeQuitar={lineas.length > 1}
              errorDe={errorDe}
            />
          ))}

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
          <div className={`grid gap-x-8 gap-y-4 pt-2 ${columnas}`}>
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

function DatosDocumento({
  titulo,
  clienteId,
  contactos,
  fecha,
  vencimiento,
  conVencimiento,
  errorCliente,
  errorFecha,
  errorVencimiento,
  onCliente,
  onFecha,
  onVencimiento,
}: {
  titulo: string;
  clienteId: string;
  contactos: ContactoResumen[];
  fecha: string;
  vencimiento: string;
  conVencimiento: boolean;
  errorCliente?: string;
  errorFecha?: string;
  errorVencimiento?: string;
  onCliente: (contacto: ContactoOpcion | null) => void;
  onFecha: (valor: string) => void;
  onVencimiento: (valor: string) => void;
}) {
  return (
    <section>
      <FormDivider className="mb-4" />
      <FormSectionTitle className="mb-4">{titulo}</FormSectionTitle>
      <div className={`grid grid-cols-1 gap-x-8 gap-y-4 ${conVencimiento ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <FormField htmlFor="cliente" label="Cliente" required error={errorCliente}>
          <SelectorContacto
            id="cliente"
            contactos={contactos}
            valor={clienteId}
            onCambio={onCliente}
            tipoInicial="cliente"
            className={FORM_COMBO}
            placeholder="Buscar cliente…"
            {...propsError(errorCliente, "cliente")}
          />
        </FormField>
        <FormField htmlFor="fecha" label="Fecha de creación" required error={errorFecha}>
          <DatePicker id="fecha" value={fecha} onChange={onFecha} {...propsError(errorFecha, "fecha")} />
        </FormField>
        {conVencimiento ? (
          <FormField htmlFor="vencimiento" label="Fecha de vencimiento" required error={errorVencimiento}>
            <DatePicker
              id="vencimiento"
              value={vencimiento}
              onChange={onVencimiento}
              {...propsError(errorVencimiento, "vencimiento")}
            />
          </FormField>
        ) : null}
      </div>
    </section>
  );
}

function TotalesDocumento({
  subtotalCentavos,
  descuentoCentavos,
  itbisCentavos,
  totalCentavos,
  error,
}: {
  subtotalCentavos: number;
  descuentoCentavos: number;
  itbisCentavos: number;
  totalCentavos: number;
  error?: string;
}) {
  return (
    <FormTotal className="md:w-80">
      <div className="flex h-6 items-center justify-between">
        <span>Subtotal</span>
        <span className="tabular-nums">{formatoMonedaCentavos(subtotalCentavos)}</span>
      </div>
      <div className="flex h-6 items-center justify-between">
        <span>Descuento</span>
        <span className="tabular-nums">{formatoMonedaCentavos(descuentoCentavos)}</span>
      </div>
      <div className="flex h-6 items-center justify-between">
        <span>Impuestos</span>
        <span className="tabular-nums">{formatoMonedaCentavos(itbisCentavos)}</span>
      </div>
      <div className="mt-7 flex items-center justify-between text-xl leading-7 font-semibold text-slate-900">
        <span>Total</span>
        <span className="tabular-nums">{formatoMonedaCentavos(totalCentavos)}</span>
      </div>
      {error ? (
        <p id="total-error" role="alert" tabIndex={-1} className="text-destructive mt-2 text-right text-xs leading-4">
          {error}
        </p>
      ) : null}
    </FormTotal>
  );
}

/** Líneas del formulario convertidas al formato que usa el papel de impresión. */
function lineasParaPapel(
  lineas: LineaFormulario[],
  calculadas: LineaCalculadaFormulario[],
  productos: readonly ProductoSeleccionable[],
): DocumentoLinea[] {
  return lineas.map((linea) => {
    const calculo = calculadas.find((item) => item.clave === linea.clave)?.calculo;
    const producto = productos.find((item) => item.id === linea.productoId);
    return {
      id: linea.clave,
      producto_id: linea.productoId || null,
      descripcion: producto?.nombre ?? "",
      cantidad: numero(linea.cantidad),
      precio: centavosAValor(parsearCentavos(linea.precio) ?? 0),
      descuento_pct: numero(linea.descuentoPct),
      itbis_tasa: numero(linea.itbisTasa),
      impuesto_id: linea.impuestoId || null,
      subtotal: centavosAValor(calculo?.subtotalCentavos ?? 0),
      itbis: centavosAValor(calculo?.itbisCentavos ?? 0),
      total: centavosAValor(calculo?.totalCentavos ?? 0),
    };
  });
}

/** Número que muestra el papel: la vista previa si existe, o el número real al editar. */
function numeroPrevistoPapel(
  vistaNumero: PrevisualizacionNumero | undefined,
  numeroActual: string | undefined,
): number {
  if (vistaNumero?.estado === "lista") return vistaNumero.numero;
  const previsto = Number.parseInt(numeroActual ?? "", 10);
  return Number.isFinite(previsto) && previsto > 0 ? previsto : 0;
}

/**
 * El formulario no recibe el tipo de documento: se deduce de la ruta de destino
 * (facturación, cotizaciones o conduces) para elegir el papel de la vista previa.
 */
function tipoPapelDeRuta(rutaDestino: string): "factura" | "cotizacion" | "conduce" {
  if (rutaDestino.endsWith("/cotizaciones")) return "cotizacion";
  if (rutaDestino.endsWith("/conduces")) return "conduce";
  return "factura";
}

/** Datos del formulario ya convertidos al formato del papel de impresión. */
interface BasePapelFormulario {
  empresa: Empresa | null;
  contacto: ContactoResumen;
  clienteId: string;
  fecha: string;
  vencimiento: string;
  lineas: DocumentoLinea[];
  subtotal: number;
  descuento: number;
  itbis: number;
  total: number;
  notas: string | null;
  terminos: string | null;
  pie: string | null;
  vendedorId: string | null;
  centroCostoId: string | null;
  impuestos: Impuesto[];
  mostrarLogo: boolean;
}

function papelFacturaFormulario(
  base: BasePapelFormulario,
  tipoComprobante: TipoComprobante,
  ncf: string | null,
  conPago: boolean,
  registrarPago: boolean,
): ReactNode {
  return (
    <DocumentoPapel
      tipo="factura"
      empresa={base.empresa}
      factura={{
        id: "prevista",
        numero: 0,
        ncf,
        tipo_comprobante: tipoComprobante,
        contacto_id: base.clienteId,
        fecha: base.fecha,
        vencimiento: base.vencimiento,
        total: base.total,
        pagado: conPago && registrarPago ? base.total : 0,
        credito: 0,
        retenido: 0,
        estado: "abierta",
        subtotal: base.subtotal,
        descuento: base.descuento,
        itbis: base.itbis,
        otros_impuestos: 0,
        propina: 0,
        notas: base.notas,
        terminos: base.terminos,
        pie: base.pie,
        asiento_id: null,
        vendedor_id: base.vendedorId,
        centro_costo_id: base.centroCostoId,
      }}
      lineas={base.lineas}
      contacto={base.contacto}
      ncfVence={null}
      impuestos={base.impuestos}
      mostrarLogo={base.mostrarLogo}
    />
  );
}

function papelDocumentoFormulario(
  base: BasePapelFormulario,
  tipo: "cotizacion" | "conduce",
  numero: number,
): ReactNode {
  return (
    <DocumentoPapel
      tipo={tipo}
      mostrarLogo={base.mostrarLogo}
      vista={{
        documento: {
          id: "prevista",
          numero,
          contacto_id: base.clienteId,
          fecha: base.fecha,
          vencimiento: base.vencimiento,
          total: base.total,
          estado: "abierta",
          factura_id: null,
          subtotal: base.subtotal,
          descuento: base.descuento,
          itbis: base.itbis,
          otros_impuestos: 0,
          propina: 0,
          notas: base.notas,
          terminos: base.terminos,
          vendedor_id: base.vendedorId,
          centro_costo_id: base.centroCostoId,
        },
        lineas: base.lineas,
        impuestos: base.impuestos,
        contacto: base.contacto,
        empresa: base.empresa,
        facturaRelacionada: null,
        cotizacionOrigen: null,
        remisionRelacionada: null,
      }}
    />
  );
}

/** Diálogo "Vista previa": el papel de impresión con los datos actuales del formulario. */
function VistaPreviaDocumento({
  abierto,
  onOpenChange,
  empresa,
  contactos,
  clienteId,
  fecha,
  vencimiento,
  conVencimiento,
  conPago,
  registrarPago,
  conTerminos,
  conPie,
  tipo,
  tipoPapel,
  lineas,
  calculadas,
  productos,
  totales,
  impuestos,
  mostrarLogo,
  notas,
  terminos,
  pie,
  vendedorId,
  centroCostoId,
  vistaNcf,
  vistaNumero,
  numeroActual,
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  empresa: Empresa | null;
  contactos: ContactoResumen[];
  clienteId: string;
  fecha: string;
  vencimiento: string;
  conVencimiento: boolean;
  conPago: boolean;
  registrarPago: boolean;
  conTerminos: boolean;
  conPie: boolean;
  tipo: TipoComprobante;
  tipoPapel: "factura" | "cotizacion" | "conduce";
  lineas: LineaFormulario[];
  calculadas: LineaCalculadaFormulario[];
  productos: readonly ProductoSeleccionable[];
  totales: TotalesFactura;
  impuestos: Impuesto[];
  mostrarLogo: boolean;
  notas: string;
  terminos: string;
  pie: string;
  vendedorId: string;
  centroCostoId: string;
  vistaNcf: PrevisualizacionNcf | null;
  vistaNumero?: PrevisualizacionNumero;
  numeroActual?: string;
}) {
  const base: BasePapelFormulario = {
    empresa,
    contacto: contactos.find((contacto) => contacto.id === clienteId) ?? {
      id: "",
      nombre: "Sin cliente",
      rnc_cedula: null,
      direccion: null,
    },
    clienteId,
    fecha,
    vencimiento: conVencimiento ? vencimiento : fecha,
    lineas: lineasParaPapel(lineas, calculadas, productos),
    subtotal: centavosAValor(totales.subtotalCentavos),
    descuento: centavosAValor(totales.descuentoCentavos),
    itbis: centavosAValor(totales.itbisCentavos),
    total: centavosAValor(totales.totalCentavos),
    notas: notas.trim() || null,
    terminos: conTerminos ? terminos.trim() || null : null,
    pie: conPie ? pie.trim() || null : null,
    vendedorId: vendedorId || null,
    centroCostoId: centroCostoId || null,
    impuestos,
    mostrarLogo,
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[880px]">
        <DialogHeader>
          <DialogTitle>Vista previa</DialogTitle>
          <DialogDescription>Así se verá el documento con los datos actuales del formulario.</DialogDescription>
        </DialogHeader>
        <div className="border border-slate-200">
          {tipoPapel === "factura"
            ? papelFacturaFormulario(
                base,
                tipo,
                vistaNcf && vistaNcf.estado === "lista" ? vistaNcf.ncf : null,
                conPago,
                registrarPago,
              )
            : papelDocumentoFormulario(base, tipoPapel, numeroPrevistoPapel(vistaNumero, numeroActual))}
        </div>
      </DialogContent>
    </Dialog>
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
  vistaNumero,
  numeraciones,
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
  const [errores, setErrores] = useState<ErrorDocumento[]>([]);
  const [vistaPreviaAbierta, setVistaPreviaAbierta] = useState(false);

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
  const vistaNcf = conComprobante && numeraciones ? previsualizarNcf({ numeraciones, tipo, fecha }) : null;
  const erroresPorCampo = new Map(errores.map((item) => [claveErrorDocumento(item.campo), item.mensaje]));
  const errorDe = (campo: string) => erroresPorCampo.get(campo);

  function actualizarLinea(clave: string, cambios: Partial<LineaFormulario>) {
    setLineas((actuales) => actuales.map((linea) => (linea.clave === clave ? { ...linea, ...cambios } : linea)));
    limpiarErroresDeLinea(setErrores, clave);
    limpiarError(setErrores, "total");
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
    limpiarError(setErrores, "cliente");
    const lista = contacto?.lista_precio_id;
    if (lista && listasPrecios.some((opcion) => opcion.id === lista)) cambiarListaPrecio(lista);
  }

  function cambiarFecha(valor: string) {
    setFecha(valor);
    limpiarError(setErrores, "fecha");
    limpiarError(setErrores, "vencimiento");
  }

  function cambiarVencimiento(valor: string) {
    setVencimiento(valor);
    limpiarError(setErrores, "vencimiento");
  }

  function cambiarCuentaPago(valor: string) {
    setCuentaPago(valor);
    limpiarError(setErrores, "cuentaPago");
  }

  function cambiarRegistrarPago(valor: boolean) {
    setRegistrarPago(valor);
    limpiarError(setErrores, "cuentaPago");
  }

  function cambiarListaPrecio(listaId: string) {
    setListaPrecioId(listaId);
    setLineas((actuales) =>
      actuales.map((linea) => {
        const producto = productosLocales.find((item) => item.id === linea.productoId);
        return producto ? { ...linea, precio: precioDeProducto(producto, listaId) } : linea;
      }),
    );
    limpiarError(setErrores, "total");
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
    limpiarErroresDeLinea(setErrores, clave);
    limpiarError(setErrores, "total");
  }

  function guardar() {
    setError(null);

    const erroresDocumento = erroresValidacionDocumento({
      clienteId,
      fecha,
      vencimiento,
      conVencimiento,
      lineas,
      totalCentavos: totales.totalCentavos,
      requiereCuentaPago: conPago && registrarPago,
      cuentaPago,
    });
    if (!mostrarErroresDocumento(erroresDocumento, setErrores)) return;

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

  const errorCliente = errorDe("cliente");
  const errorFecha = errorDe("fecha");
  const errorVencimiento = errorDe("vencimiento");
  const errorLineas = errorDe("lineas");
  const errorCuentaPago = errorDe("cuentaPago");
  const errorTotal = errorDe("total");

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

      {/* TODO backend: pestañas "Factura convencional / Factura rápida" como en Alegra
          (interruptor arriba del formulario); el backend solo crea facturas convencionales,
          así que no se muestran. */}
      <FormCard className="gap-4 p-3 sm:gap-6 sm:p-5 md:gap-8 md:p-8">
        <Encabezado
          empresa={empresa}
          conComprobante={conComprobante}
          etiquetaNumero={etiquetaNumero}
          tipo={tipo}
          numeroActual={numeroActual}
          vistaNumero={vistaNumero}
          vistaNcf={vistaNcf}
          onTipo={setTipo}
          comprobantesItems={comprobantesItems}
          mostrarLogo={mostrarLogo}
        />

        <AjustesDocumento
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

        <DatosDocumento
          titulo={titulo}
          clienteId={clienteId}
          contactos={contactos}
          fecha={fecha}
          vencimiento={vencimiento}
          conVencimiento={conVencimiento}
          errorCliente={errorCliente}
          errorFecha={errorFecha}
          errorVencimiento={errorVencimiento}
          onCliente={seleccionarCliente}
          onFecha={cambiarFecha}
          onVencimiento={cambiarVencimiento}
        />

        <LineasDocumento
          lineas={lineas}
          productos={productosLocales}
          impuestos={impuestos}
          calculadas={calculadas}
          onActualizar={actualizarLinea}
          onSeleccionarProducto={seleccionarProducto}
          onAgregar={agregarLinea}
          onQuitar={quitarLinea}
          errorDe={errorDe}
          errorGeneral={errorLineas}
        />

        <TotalesDocumento
          subtotalCentavos={totales.subtotalCentavos}
          descuentoCentavos={totales.descuentoCentavos}
          itbisCentavos={totales.itbisCentavos}
          totalCentavos={totales.totalCentavos}
          error={errorTotal}
        />

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
      </FormCard>

      {conPago ? (
        <PagoRecibidoDocumento
          totalCentavos={totales.totalCentavos}
          fecha={fecha}
          cuentasItems={cuentasItems}
          registrarPago={registrarPago}
          onRegistrarPago={cambiarRegistrarPago}
          cuentaPago={cuentaPago}
          onCuentaPago={cambiarCuentaPago}
          metodoPago={metodoPago}
          onMetodoPago={setMetodoPago}
          errorCuenta={errorCuentaPago}
        />
      ) : null}

      <FormActions>
        <Button type="button" variant="outline" className={BOTON_GRANDE} render={<Link href={rutaCancelar} />}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="outline"
          className={BOTON_GRANDE}
          disabled={pendiente}
          onClick={() => setVistaPreviaAbierta(true)}
        >
          <Eye className="size-4" aria-hidden="true" />
          Vista previa
        </Button>
        <Button type="submit" disabled={pendiente} className={BOTON_GRANDE}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          {textoGuardar}
        </Button>
      </FormActions>

      <VistaPreviaDocumento
        abierto={vistaPreviaAbierta}
        onOpenChange={setVistaPreviaAbierta}
        empresa={empresa}
        contactos={contactos}
        clienteId={clienteId}
        fecha={fecha}
        vencimiento={vencimiento}
        conVencimiento={conVencimiento}
        conPago={conPago}
        registrarPago={registrarPago}
        conTerminos={conTerminos}
        conPie={conPie}
        tipo={tipo}
        tipoPapel={tipoPapelDeRuta(rutaDestino)}
        lineas={lineas}
        calculadas={calculadas}
        productos={productosLocales}
        totales={totales}
        impuestos={impuestos}
        mostrarLogo={mostrarLogo}
        notas={notas}
        terminos={terminos}
        pie={pie}
        vendedorId={vendedorId}
        centroCostoId={centroCostoId}
        vistaNcf={vistaNcf}
        vistaNumero={vistaNumero}
        numeroActual={numeroActual}
      />
    </form>
  );
}
