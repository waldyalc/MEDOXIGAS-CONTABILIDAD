"use client";

import { useState, useTransition } from "react";

import Link from "next/link";

import { cn } from "cn";

import { SelectorContacto } from "@/components/contactos/selector-contacto";
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
  FormGrid,
  FormSectionTitle,
  FormTotal,
} from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { ChevronDown, Loader2, Plus, Trash2 } from "@/components/icons";
import { type ProductoSeleccionable, SelectorProducto } from "@/components/productos/selector-producto";
import { SelectCampo } from "@/components/select-campo";
import { SelectorImpuesto } from "@/components/selector-impuesto";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { crearFacturaProveedor } from "@/lib/compras/acciones";
import { aNumero, calcularLinea, calcularTotales, desdeCentavos } from "@/lib/compras/calculo";
import { esquemaFacturaProveedor } from "@/lib/compras/esquema";
import { hoyEnRd } from "@/lib/compras/fechas";
import { formatoMoneda } from "@/lib/compras/formato";
import type { OpcionesFactura } from "@/lib/compras/tipos";
import type { Empresa } from "@/lib/facturacion/tipos";
import { requerido } from "@/lib/formularios/validacion";
import { type Impuesto, impuestoNinguno } from "@/lib/impuestos/tipos";
import type { InicialFacturaDesdeOrden } from "@/lib/ordenes-compra/tipos";

import { ComboboxCampo, type OpcionCombobox } from "./combobox-campo";

type ModoLinea = "producto" | "gasto";

const SIN_CENTRO = "__ninguno";
const CELDA_ENCABEZADO =
  "flex h-10 items-center border-b border-slate-400/20 bg-slate-50 px-1 text-xs leading-4 font-medium text-gray-500";
/** Mismo ritmo que la tabla de la factura de venta, con la columna Tipo de la compra. */
const GRID_LINEAS =
  "grid min-w-[900px] grid-cols-[44px_112px_minmax(0,26fr)_minmax(0,7.4fr)_minmax(0,12.6fr)_148px_minmax(0,13.5fr)_32px]";

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

function EncabezadoFactura({
  empresa,
  ncf,
  onNcf,
}: {
  empresa: Empresa | null;
  ncf: string;
  onNcf: (valor: string) => void;
}) {
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
        <FormField htmlFor="ncf" label="No. / NCF del proveedor (opcional)" className="w-full">
          <Input
            id="ncf"
            value={ncf}
            onChange={(evento) => onNcf(evento.target.value)}
            placeholder="B0100000001"
            maxLength={20}
            className={FORM_INPUT}
          />
        </FormField>
      </div>
    </header>
  );
}

function FilaLinea({
  linea,
  indice,
  productos,
  impuestos,
  opcionesGastos,
  onActualizar,
  onCambiarModo,
  onSeleccionarProducto,
  onSeleccionarCuenta,
  onQuitar,
  puedeQuitar,
  errorDe,
}: {
  linea: LineaFormulario;
  indice: number;
  productos: readonly ProductoSeleccionable[];
  impuestos: Impuesto[];
  opcionesGastos: OpcionCombobox[];
  onActualizar: (id: string, cambios: Partial<LineaFormulario>) => void;
  onCambiarModo: (id: string, modo: ModoLinea) => void;
  onSeleccionarProducto: (id: string, producto: ProductoSeleccionable | null) => void;
  onSeleccionarCuenta: (id: string, cuentaId: string) => void;
  onQuitar: (id: string) => void;
  puedeQuitar: boolean;
  errorDe: (campo: string) => string | undefined;
}) {
  const idProducto = `linea-${linea.id}-producto`;
  const idCuenta = `linea-${linea.id}-cuenta`;
  const idCantidad = `linea-${linea.id}-cantidad`;
  const idCosto = `linea-${linea.id}-costo`;
  const errorProducto = errorDe(linea.modo === "producto" ? idProducto : idCuenta);
  const errorCantidad = errorDe(idCantidad);
  const errorCosto = errorDe(idCosto);
  const producto = productos.find((item) => item.id === linea.productoId);
  const calculo = calcularLinea({
    cantidad: linea.cantidad,
    costo: linea.costo,
    itbisTasa: linea.itbisTasa,
  });

  return (
    <div className="contents">
      <div className="flex justify-center py-2 pr-1 text-xs leading-10 text-slate-500">{indice + 1}</div>
      <div className="min-w-0 py-2 pr-1">
        <SelectCampo
          aria-label={`Tipo de la línea ${indice + 1}`}
          opciones={[
            { value: "producto", label: "Producto" },
            { value: "gasto", label: "Gasto" },
          ]}
          valor={linea.modo}
          onCambio={(valor) => onCambiarModo(linea.id, valor === "gasto" ? "gasto" : "producto")}
          className={cn(FORM_SELECT, "text-sm")}
        />
      </div>
      <div className="min-w-0 py-2 pr-1">
        {linea.modo === "producto" ? (
          <SelectorProducto
            id={idProducto}
            productos={productos}
            valor={linea.productoId}
            onCambio={(seleccionado) => onSeleccionarProducto(linea.id, seleccionado)}
            className={cn(FORM_COMBO, "[&>input]:text-sm")}
            aria-label={`Producto de la línea ${indice + 1}`}
            {...propsError(errorProducto, idProducto)}
          />
        ) : (
          <ComboboxCampo
            id={idCuenta}
            opciones={opcionesGastos}
            valor={linea.cuentaId}
            onCambio={(valor) => onSeleccionarCuenta(linea.id, valor)}
            placeholder="Buscar cuenta…"
            vacio="No hay cuentas de gasto."
            className={cn(FORM_COMBO, "[&>input]:text-sm")}
            aria-label={`Cuenta de gasto de la línea ${indice + 1}`}
            {...propsError(errorProducto, idCuenta)}
          />
        )}
        {linea.modo === "producto" && producto?.referencia ? (
          <p className="mt-1 text-xs leading-4 text-slate-500">Ref. {producto.referencia}</p>
        ) : null}
        <ErrorInline id={linea.modo === "producto" ? idProducto : idCuenta} mensaje={errorProducto} />
      </div>
      <div className="min-w-0 py-2 pr-1">
        <Input
          id={idCantidad}
          inputMode="decimal"
          value={linea.cantidad}
          onChange={(evento) => onActualizar(linea.id, { cantidad: evento.target.value })}
          aria-label={`Cantidad de la línea ${indice + 1}`}
          className={FORM_INPUT}
          {...propsError(errorCantidad, idCantidad)}
        />
        <ErrorInline id={idCantidad} mensaje={errorCantidad} />
      </div>
      <div className="min-w-0 py-2 pr-1">
        <InputGroup className={FORM_INPUT_GROUP}>
          <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
            RD$
          </InputGroupAddon>
          <InputGroupInput
            id={idCosto}
            inputMode="decimal"
            value={linea.costo}
            placeholder="0.00"
            onChange={(evento) => onActualizar(linea.id, { costo: evento.target.value })}
            aria-label={`Costo de la línea ${indice + 1}`}
            className="h-full min-w-0 pl-1 text-sm text-slate-700 md:text-sm"
            {...propsError(errorCosto, idCosto)}
          />
        </InputGroup>
        <ErrorInline id={idCosto} mensaje={errorCosto} />
      </div>
      <div className="min-w-0 py-2 pr-1">
        <SelectorImpuesto
          id={`linea-${linea.id}-impuesto`}
          className={FORM_SELECT}
          ariaLabel={`Impuesto de la línea ${indice + 1}`}
          impuestos={impuestos}
          value={linea.impuestoId}
          onValueChange={(impuestoId) => {
            const impuesto = impuestos.find((item) => item.id === impuestoId);
            onActualizar(linea.id, {
              impuestoId,
              itbisTasa: String(impuesto?.tarifa ?? 0),
            });
          }}
        />
      </div>
      <div className="flex min-w-0 justify-end py-2 pr-1">
        <span className="mt-1 text-sm leading-8 text-slate-700 tabular-nums">
          {formatoMoneda(desdeCentavos(calculo.subtotalCentavos))}
        </span>
      </div>
      <div className="flex justify-center py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8 text-slate-900 hover:bg-slate-200/45"
          disabled={!puedeQuitar}
          onClick={() => onQuitar(linea.id)}
        >
          <Trash2 />
          <span className="sr-only">Quitar línea {indice + 1}</span>
        </Button>
      </div>
    </div>
  );
}

function LineasFactura({
  lineas,
  productos,
  impuestos,
  opcionesGastos,
  onActualizar,
  onCambiarModo,
  onSeleccionarProducto,
  onSeleccionarCuenta,
  onAgregar,
  onQuitar,
  errorDe,
}: {
  lineas: LineaFormulario[];
  productos: readonly ProductoSeleccionable[];
  impuestos: Impuesto[];
  opcionesGastos: OpcionCombobox[];
  onActualizar: (id: string, cambios: Partial<LineaFormulario>) => void;
  onCambiarModo: (id: string, modo: ModoLinea) => void;
  onSeleccionarProducto: (id: string, producto: ProductoSeleccionable | null) => void;
  onSeleccionarCuenta: (id: string, cuentaId: string) => void;
  onAgregar: () => void;
  onQuitar: (id: string) => void;
  errorDe: (campo: string) => string | undefined;
}) {
  return (
    <section>
      <FormDivider className="mb-4" />
      <FormSectionTitle className="mb-4">Líneas</FormSectionTitle>
      <div className="overflow-x-auto">
        <div className={GRID_LINEAS}>
          <div className={`${CELDA_ENCABEZADO} justify-center`}>N.º</div>
          <div className={CELDA_ENCABEZADO}>Tipo</div>
          <div className={CELDA_ENCABEZADO}>Producto o cuenta</div>
          <div className={CELDA_ENCABEZADO}>Cantidad</div>
          <div className={CELDA_ENCABEZADO}>Costo</div>
          <div className={CELDA_ENCABEZADO}>Impuesto</div>
          <div className={`${CELDA_ENCABEZADO} justify-end`}>Subtotal</div>
          <div className={CELDA_ENCABEZADO} />

          {lineas.map((linea, indice) => (
            <FilaLinea
              key={linea.id}
              linea={linea}
              indice={indice}
              productos={productos}
              impuestos={impuestos}
              opcionesGastos={opcionesGastos}
              onActualizar={onActualizar}
              onCambiarModo={onCambiarModo}
              onSeleccionarProducto={onSeleccionarProducto}
              onSeleccionarCuenta={onSeleccionarCuenta}
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
  almacenes,
  almacenId,
  onAlmacen,
  notas,
  onNotas,
  centrosItems,
  centroCostoId,
  onCentroCosto,
}: {
  almacenes: OpcionesFactura["almacenes"];
  almacenId: string;
  onAlmacen: (valor: string) => void;
  notas: string;
  onNotas: (valor: string) => void;
  centrosItems: OpcionCombobox[];
  centroCostoId: string;
  onCentroCosto: (valor: string) => void;
}) {
  return (
    <section>
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-base leading-6 font-semibold text-slate-700 [&[data-panel-open]>svg]:rotate-180">
          Más opciones
          <ChevronDown className="size-4 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <FormGrid className="pt-2">
            <FormField htmlFor="almacen" label="Almacén">
              <SelectCampo
                id="almacen"
                opciones={almacenes.map((almacen) => ({
                  value: almacen.id,
                  label: almacen.es_principal ? `${almacen.nombre} (principal)` : almacen.nombre,
                }))}
                valor={almacenId}
                onCambio={onAlmacen}
                className={FORM_SELECT}
              />
            </FormField>
            <FormField htmlFor="notas" label="Notas">
              <Textarea
                id="notas"
                value={notas}
                onChange={(evento) => onNotas(evento.target.value)}
                placeholder="Observaciones de la compra"
                maxLength={500}
                className={FORM_TEXTAREA}
              />
            </FormField>
            <FormField htmlFor="centro-costo" label="Centro de costo">
              <Select
                items={centrosItems}
                value={centroCostoId || SIN_CENTRO}
                onValueChange={(valor: string | null) =>
                  onCentroCosto(valor == null || valor === SIN_CENTRO ? "" : valor)
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
          </FormGrid>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

interface Props extends OpcionesFactura {
  empresa: Empresa | null;
  inicial?: InicialFacturaDesdeOrden;
  ordenId?: string;
  numeroOrden?: number;
}

export function FormularioFactura({
  empresa,
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
  const validacion = useValidacionFormulario();

  const opcionesGastos: OpcionCombobox[] = cuentasGasto.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} ${cuenta.nombre}`,
  }));

  const opcionesCentros: OpcionCombobox[] = [
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

  function agregarLinea() {
    setLineas((actuales) => [...actuales, { ...nuevaLinea(), impuestoId: impuestoNinguno(impuestos)?.id ?? "" }]);
  }

  function quitarLinea(id: string) {
    setLineas((actuales) => (actuales.length > 1 ? actuales.filter((item) => item.id !== id) : actuales));
  }

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const reglas = [
      requerido("proveedor", proveedorId, "El proveedor es requerido."),
      requerido("fecha", fecha, "La fecha es requerida."),
      requerido("vencimiento", vencimiento, "El vencimiento es requerido."),
      {
        campo: "vencimiento",
        invalido: vencimiento !== "" && fecha !== "" && vencimiento < fecha,
        mensaje: "El vencimiento no puede ser anterior a la fecha.",
      },
      ...lineas.flatMap((linea) => {
        const cantidad = aNumero(linea.cantidad);
        const costo = aNumero(linea.costo);
        const reglasLinea = [
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
        return reglasLinea;
      }),
    ];

    if (!validacion.validar(reglas)) return;

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

    const resultadoValidacion = esquemaFacturaProveedor.safeParse(entrada);
    if (!resultadoValidacion.success) {
      setError(resultadoValidacion.error.issues[0]?.message ?? "Revisa los datos de la factura.");
      return;
    }

    iniciar(async () => {
      const resultado = await crearFacturaProveedor(entrada, ordenId);
      if (!resultado.ok) setError(resultado.error);
    });
  }

  const errorProveedor = validacion.errorDe("proveedor");
  const errorFecha = validacion.errorDe("fecha");
  const errorVencimiento = validacion.errorDe("vencimiento");

  return (
    <form
      noValidate
      onSubmit={enviar}
      className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 [font-family:var(--font-inter)]"
    >
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

      <FormCard className="p-4 sm:p-5">
        <EncabezadoFactura empresa={empresa} ncf={ncf} onNcf={setNcf} />

        <section>
          <FormDivider className="mb-4" />
          <FormSectionTitle className="mb-4">Información de la factura</FormSectionTitle>
          <FormGrid>
            <FormField htmlFor="proveedor" label="Proveedor" required error={errorProveedor}>
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
                {...propsError(errorProveedor, "proveedor")}
              />
            </FormField>
            <FormField htmlFor="fecha" label="Fecha" required error={errorFecha}>
              <DatePicker
                id="fecha"
                value={fecha}
                onChange={(valor) => {
                  setFecha(valor);
                  validacion.limpiar("fecha");
                }}
                {...propsError(errorFecha, "fecha")}
              />
            </FormField>
            <FormField htmlFor="vencimiento" label="Vencimiento" required error={errorVencimiento}>
              <DatePicker
                id="vencimiento"
                value={vencimiento}
                onChange={(valor) => {
                  setVencimiento(valor);
                  validacion.limpiar("vencimiento");
                }}
                {...propsError(errorVencimiento, "vencimiento")}
              />
            </FormField>
          </FormGrid>
        </section>

        <LineasFactura
          lineas={lineas}
          productos={productosLocales}
          impuestos={impuestos}
          opcionesGastos={opcionesGastos}
          onActualizar={actualizarLinea}
          onCambiarModo={cambiarModo}
          onSeleccionarProducto={seleccionarProducto}
          onSeleccionarCuenta={seleccionarCuenta}
          onAgregar={agregarLinea}
          onQuitar={quitarLinea}
          errorDe={validacion.errorDe}
        />

        <FormTotal>
          <div className="flex h-6 items-center justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatoMoneda(desdeCentavos(totales.subtotalCentavos))}</span>
          </div>
          <div className="flex h-6 items-center justify-between">
            <span>Impuestos</span>
            <span className="tabular-nums">{formatoMoneda(desdeCentavos(totales.itbisCentavos))}</span>
          </div>
          <div className="mt-7 flex items-center justify-between text-xl leading-7 font-semibold text-slate-900">
            <span>Total</span>
            <span className="tabular-nums">{formatoMoneda(desdeCentavos(totales.totalCentavos))}</span>
          </div>
        </FormTotal>

        <MasOpciones
          almacenes={almacenes}
          almacenId={almacenId}
          onAlmacen={setAlmacenId}
          notas={notas}
          onNotas={setNotas}
          centrosItems={opcionesCentros}
          centroCostoId={centroCostoId}
          onCentroCosto={setCentroCostoId}
        />
      </FormCard>

      <FormActions>
        <Button type="button" variant="outline" className={FORM_BUTTON} render={<Link href="/dashboard/compras" />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente} className={FORM_BUTTON}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          {pendiente ? "Guardando…" : "Guardar factura"}
        </Button>
      </FormActions>
    </form>
  );
}
