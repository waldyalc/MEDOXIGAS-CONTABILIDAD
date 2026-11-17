"use client";

import { type ChangeEvent, type FormEvent, useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronDown, ImagePlus, Loader2, Package, Trash2, TriangleAlert, Wrench } from "lucide-react";

import { CampoFormulario } from "@/components/formularios/campo-formulario";
import {
  FORM_COMBO,
  FORM_INPUT,
  FORM_SELECT,
  FORM_TEXTAREA,
  FormCard,
  FormSectionTitle,
} from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { type ColumnaLista, TablaLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { SelectCampo } from "@/components/select-campo";
import { SelectorImpuesto } from "@/components/selector-impuesto";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { CuentaOpcion } from "@/lib/contabilidad/validacion";
import { rutaProducto } from "@/lib/enlaces";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import { requerido } from "@/lib/formularios/validacion";
import { etiquetaImpuesto, type Impuesto, impuestoNinguno, impuestoPorTasa } from "@/lib/impuestos/tipos";
import { etiquetaTipoLista } from "@/lib/inventario/precios";
import type { Almacen, CategoriaProducto, ExistenciaAlmacen, ListaPrecio } from "@/lib/inventario/tipos";
import { esAccionCrearOtro } from "@/lib/productos/acciones-formulario";
import { actualizarProducto, crearProducto } from "@/lib/productos/actions";
import type { ProductoEditable } from "@/lib/productos/consultas";
import { precioConItbis } from "@/lib/productos/ficha";
import {
  BUCKET_IMAGENES_PRODUCTO,
  extensionImagenProducto,
  mensajeSubidaImagen,
  validarImagenProducto,
} from "@/lib/productos/imagen";
import { type PreciosListaFormulario, preciosIniciales } from "@/lib/productos/precios-formulario";
import { etiquetaTasaItbis, etiquetaTipoProducto, type ProductoTipo, parsearMonto } from "@/lib/productos/productos";
import { createClient } from "@/lib/supabase/client";

interface ValoresFormulario {
  nombre: string;
  referencia: string;
  tipo: ProductoTipo;
  inventariable: boolean;
  activo: boolean;
  vendeNegativo: boolean;
  precio: string;
  costo: string;
  cantidad: string;
  impuestoId: string;
  itbisTasa: string;
  unidadMedida: string;
  almacenId: string;
  categoriaId: string;
  descripcion: string;
}

type MinimosAlmacen = Record<string, { minimo: string; maximo: string }>;

const OPCIONES_TIPO: { valor: ProductoTipo; etiqueta: string }[] = [
  { valor: "producto", etiqueta: "Producto" },
  { valor: "servicio", etiqueta: "Servicio" },
  { valor: "combo", etiqueta: "Combo" },
];

function impuestoInicial(producto: ProductoEditable | null, impuestos: Impuesto[]) {
  if (producto) {
    return (
      producto.impuesto_id ??
      impuestoPorTasa(impuestos, producto.itbis_tasa)?.id ??
      impuestoNinguno(impuestos)?.id ??
      ""
    );
  }

  return impuestoNinguno(impuestos)?.id ?? "";
}

function valoresIniciales(
  producto: ProductoEditable | null,
  almacenPorDefecto: string,
  impuestos: Impuesto[],
): ValoresFormulario {
  const impuestoId = impuestoInicial(producto, impuestos);
  const impuesto = impuestos.find((item) => item.id === impuestoId);

  return {
    nombre: producto?.nombre ?? "",
    referencia: producto?.referencia ?? "",
    tipo: producto?.tipo ?? "producto",
    inventariable: producto?.inventariable ?? true,
    activo: producto?.activo ?? true,
    vendeNegativo: producto?.vende_negativo ?? false,
    precio: producto ? String(producto.precio) : "",
    costo: producto ? String(producto.costo) : "0",
    cantidad: producto ? String(producto.cantidad) : "0",
    impuestoId,
    itbisTasa: String(producto ? producto.itbis_tasa : (impuesto?.tarifa ?? 0)),
    unidadMedida: producto?.unidad_medida ?? "Unidad",
    almacenId: producto?.almacen_id ?? almacenPorDefecto,
    categoriaId: producto?.categoria_id ?? "",
    descripcion: producto?.descripcion ?? "",
  };
}

function minimosIniciales(existencias: ExistenciaAlmacen[]): MinimosAlmacen {
  return Object.fromEntries(
    existencias.map((existencia) => [
      existencia.almacen_id,
      {
        minimo: String(existencia.minimo),
        maximo: existencia.maximo === null ? "" : String(existencia.maximo),
      },
    ]),
  );
}

function valoresConTipo(actuales: ValoresFormulario, tipo: string): ValoresFormulario {
  if (tipo !== "producto" && tipo !== "servicio" && tipo !== "combo") return actuales;
  if (tipo === "producto") return { ...actuales, tipo, inventariable: true };
  return { ...actuales, tipo, inventariable: false, vendeNegativo: false };
}

function valoresConImpuesto(actuales: ValoresFormulario, impuestos: Impuesto[], impuestoId: string): ValoresFormulario {
  const impuesto = impuestos.find((item) => item.id === impuestoId);
  return { ...actuales, impuestoId, itbisTasa: String(impuesto?.tarifa ?? 0) };
}

function errorDeRango(fila: MinimosAlmacen[string] | undefined, nombre: string): string | null {
  if (!fila) return null;

  const minimoTexto = fila.minimo.trim();
  const maximoTexto = fila.maximo.trim();
  const minimo = minimoTexto === "" ? 0 : parsearMonto(minimoTexto);
  const maximo = maximoTexto === "" ? null : parsearMonto(maximoTexto);

  if (minimo === null) return `El mínimo de ${nombre} no es válido.`;
  if (maximo === null && maximoTexto !== "") return `El máximo de ${nombre} no es válido.`;
  if (maximo !== null && maximo < minimo) return `El máximo de ${nombre} no puede ser menor que el mínimo.`;
  return null;
}

function errorEnMinimosDeFormulario(
  almacenes: readonly Almacen[],
  almacenId: string,
  minimos: MinimosAlmacen,
  existenciasPorAlmacen: ReadonlySet<string>,
  controlaInventario: boolean,
): string | null {
  if (!controlaInventario) return null;

  const editables = almacenes.filter((almacen) => existenciasPorAlmacen.has(almacen.id) || almacen.id === almacenId);

  for (const almacen of editables) {
    const error = errorDeRango(minimos[almacen.id], almacen.nombre);
    if (error) return error;
  }

  return null;
}

function TarjetaImagen({
  imagenUrl,
  nombre,
  subiendo,
  error,
  onSubir,
  onQuitar,
}: {
  readonly imagenUrl: string | null;
  readonly nombre: string;
  readonly subiendo: boolean;
  readonly error: string | null;
  readonly onSubir: (evento: ChangeEvent<HTMLInputElement>) => void;
  readonly onQuitar: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <FormCard className="gap-3">
      <div className="bg-muted/30 relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300">
        {imagenUrl ? (
          // biome-ignore lint/performance/noImgElement: vista previa de la imagen del producto
          <img src={imagenUrl} alt={`Imagen de ${nombre || "producto"}`} className="size-full object-contain" />
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="text-muted-foreground hover:text-primary flex size-full flex-col items-center justify-center gap-2 transition-colors"
          >
            <ImagePlus className="size-9" strokeWidth={1.5} />
            <span className="text-sm">Subir imagen</span>
          </button>
        )}
      </div>

      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onSubir} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={subiendo} onClick={() => input.current?.click()}>
          {subiendo ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {imagenUrl ? "Cambiar imagen" : "Subir imagen"}
        </Button>
        {imagenUrl ? (
          <Button type="button" variant="ghost" size="sm" disabled={subiendo} onClick={onQuitar}>
            <Trash2 />
            Quitar
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">PNG, JPG o WebP de hasta 5 MB.</p>
    </FormCard>
  );
}

function ResumenProducto({
  valores,
  controlaInventario,
  precioBase,
  precioTotal,
  etiquetaImpuestoActual,
  onCambiar,
}: {
  readonly valores: ValoresFormulario;
  readonly controlaInventario: boolean;
  readonly precioBase: string;
  readonly precioTotal: string;
  readonly etiquetaImpuestoActual: string;
  readonly onCambiar: (cambios: Partial<ValoresFormulario>) => void;
}) {
  const esProducto = valores.tipo === "producto";
  const Icono = valores.tipo === "servicio" ? Wrench : Package;

  return (
    <FormCard className="gap-4">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Icono className="size-5" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-muted-foreground text-xs">{etiquetaTipoProducto(valores.tipo)}</span>
          <span className="truncate text-sm font-semibold">{valores.nombre.trim() || "Producto sin nombre"}</span>
        </div>
      </div>

      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Costo por unidad</dt>
          <dd className="font-medium tabular-nums">{formatoMoneda(parsearMonto(valores.costo) ?? 0)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Precio sin impuesto</dt>
          <dd className="font-medium tabular-nums">{precioBase}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Precio de venta</dt>
          <dd className="text-primary text-lg font-semibold tabular-nums">{precioTotal}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Impuesto</dt>
          <dd className="font-medium">{etiquetaImpuestoActual}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-slate-700">Inventariable</span>
            <span className="text-muted-foreground text-xs">Lleva el costo y las cantidades por almacén.</span>
          </div>
          <Switch
            checked={controlaInventario}
            disabled={!esProducto}
            aria-label="Producto inventariable"
            onCheckedChange={(marcado) => onCambiar({ inventariable: marcado })}
          />
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-slate-700">Venta en negativo</span>
            <span className="text-muted-foreground text-xs">Vende sin unidades disponibles.</span>
          </div>
          <Switch
            checked={valores.vendeNegativo}
            disabled={!esProducto}
            aria-label="Permitir venta en negativo"
            onCheckedChange={(marcado) => onCambiar({ vendeNegativo: marcado })}
          />
        </div>
      </div>
    </FormCard>
  );
}

function TablaAlmacenes({
  almacenes,
  existencias,
  valores,
  minimos,
  controlaInventario,
  onCambiarMinimo,
}: {
  readonly almacenes: Almacen[];
  readonly existencias: ExistenciaAlmacen[];
  readonly valores: ValoresFormulario;
  readonly minimos: MinimosAlmacen;
  readonly controlaInventario: boolean;
  readonly onCambiarMinimo: (almacenId: string, campo: "minimo" | "maximo", valor: string) => void;
}) {
  const porAlmacen = new Map(existencias.map((existencia) => [existencia.almacen_id, existencia]));

  const columnas: readonly ColumnaLista<Almacen>[] = [
    {
      clave: "almacen",
      encabezado: "Almacén",
      celda: (almacen) => (
        <span className="inline-flex items-center gap-2 font-medium">
          {almacen.nombre}
          {almacen.es_principal ? <span className="text-muted-foreground text-xs">(principal)</span> : null}
        </span>
      ),
    },
    {
      clave: "inicial",
      encabezado: "Cant. inicial",
      alineacion: "derecha",
      celda: (almacen) => {
        const existencia = porAlmacen.get(almacen.id);
        if (existencia) return <span className="tabular-nums">{formatoCantidad(existencia.cantidad_inicial)}</span>;
        if (almacen.id === valores.almacenId) {
          return <span className="tabular-nums">{formatoCantidad(parsearMonto(valores.cantidad) ?? 0)}</span>;
        }
        return <span className="text-muted-foreground">—</span>;
      },
    },
    {
      clave: "actual",
      encabezado: "Cant. actual",
      alineacion: "derecha",
      celda: (almacen) => {
        const existencia = porAlmacen.get(almacen.id);
        if (!existencia) return <span className="text-muted-foreground">—</span>;
        return <span className="font-medium tabular-nums">{formatoCantidad(existencia.cantidad)}</span>;
      },
    },
    {
      clave: "minimo",
      encabezado: "Mín.",
      alineacion: "derecha",
      celda: (almacen) => {
        if (!controlaInventario) return <span className="text-muted-foreground">—</span>;
        if (!porAlmacen.has(almacen.id) && almacen.id !== valores.almacenId) {
          return <span className="text-muted-foreground">—</span>;
        }
        const fila = minimos[almacen.id] ?? { minimo: "", maximo: "" };
        return (
          <Input
            aria-label={`Mínimo de ${almacen.nombre}`}
            name={`existencia_minimo_${almacen.id}`}
            inputMode="decimal"
            placeholder="0"
            value={fila.minimo}
            onChange={(evento) => onCambiarMinimo(almacen.id, "minimo", evento.target.value)}
            className="ml-auto h-8 w-20 text-right"
          />
        );
      },
    },
    {
      clave: "maximo",
      encabezado: "Máx.",
      alineacion: "derecha",
      celda: (almacen) => {
        if (!controlaInventario) return <span className="text-muted-foreground">—</span>;
        if (!porAlmacen.has(almacen.id) && almacen.id !== valores.almacenId) {
          return <span className="text-muted-foreground">—</span>;
        }
        const fila = minimos[almacen.id] ?? { minimo: "", maximo: "" };
        return (
          <Input
            aria-label={`Máximo de ${almacen.nombre}`}
            name={`existencia_maximo_${almacen.id}`}
            inputMode="decimal"
            placeholder="Sin máximo"
            value={fila.maximo}
            onChange={(evento) => onCambiarMinimo(almacen.id, "maximo", evento.target.value)}
            className="ml-auto h-8 w-24 text-right"
          />
        );
      },
    },
    {
      clave: "conduces",
      encabezado: "En conduces",
      alineacion: "derecha",
      // TODO backend: los conduces no guardan el almacén, así que no se puede repartir lo comprometido.
      celda: () => <span className="text-muted-foreground">—</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <FormSectionTitle descripcion="Los mínimos y máximos se guardan por almacén; la cantidad actual solo cambia con ajustes o transferencias.">
        Almacenes
      </FormSectionTitle>
      <div className="ring-foreground/10 overflow-hidden rounded-lg ring-1">
        <TablaLista
          columnas={columnas}
          filas={almacenes}
          claveFila={(almacen) => almacen.id}
          vacio={{ titulo: "No hay almacenes activos" }}
          densidad="compacta"
        />
      </div>
    </div>
  );
}

function ListasPrecios({
  listasPrecios,
  valores,
  onCambiar,
}: {
  readonly listasPrecios: ListaPrecio[];
  readonly valores: PreciosListaFormulario;
  readonly onCambiar: (listaId: string, valor: string) => void;
}) {
  if (listasPrecios.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <FormSectionTitle>Listas de precios</FormSectionTitle>
        <p className="text-muted-foreground text-sm">No hay listas de precios activas.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FormSectionTitle descripcion="Valor fijo en RD$ o porcentaje sobre el precio (10 = +10 %, -10 = descuento).">
        Listas de precios
      </FormSectionTitle>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {listasPrecios.map((lista) => (
          <CampoFormulario
            key={lista.id}
            htmlFor={`precio_lista_${lista.id}`}
            label={`${lista.nombre}${lista.es_principal ? " (principal)" : ""}`}
          >
            <Input
              id={`precio_lista_${lista.id}`}
              name={`precio_lista_${lista.id}`}
              inputMode="decimal"
              placeholder={lista.tipo === "porcentaje" ? "0" : "0.00"}
              value={valores[lista.id] ?? ""}
              onChange={(evento) => onCambiar(lista.id, evento.target.value)}
              className={FORM_INPUT}
            />
            <span className="text-muted-foreground text-xs">{etiquetaTipoLista(lista.tipo)}</span>
          </CampoFormulario>
        ))}
      </div>
    </div>
  );
}

function CuentasContables({
  producto,
  cuentas,
  controlaInventario,
}: {
  readonly producto: ProductoEditable | null;
  readonly cuentas: CuentaOpcion[];
  readonly controlaInventario: boolean;
}) {
  const opcionesCuenta = cuentas.map((cuenta) => ({ value: cuenta.id, label: `${cuenta.codigo} · ${cuenta.nombre}` }));

  return (
    <div className="flex flex-col gap-3">
      <FormSectionTitle descripcion="Si no eliges una cuenta, se usa la de la configuración contable.">
        Contabilidad
      </FormSectionTitle>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <CampoFormulario htmlFor="cuenta_ingreso_id" label="Cuenta de ventas">
          <SelectCampo
            id="cuenta_ingreso_id"
            name="cuenta_ingreso_id"
            opciones={opcionesCuenta}
            valorInicial={producto?.cuenta_ingreso_id ?? ""}
            etiquetaVacia="Cuenta por defecto"
            buscable
            className={FORM_COMBO}
          />
        </CampoFormulario>

        {controlaInventario ? (
          <CampoFormulario htmlFor="cuenta_inventario_id" label="Cuenta de inventario">
            <SelectCampo
              id="cuenta_inventario_id"
              name="cuenta_inventario_id"
              opciones={opcionesCuenta}
              valorInicial={producto?.cuenta_inventario_id ?? ""}
              etiquetaVacia="Cuenta por defecto"
              buscable
              className={FORM_COMBO}
            />
          </CampoFormulario>
        ) : null}

        <CampoFormulario htmlFor="cuenta_costo_id" label="Cuenta de costo">
          <SelectCampo
            id="cuenta_costo_id"
            name="cuenta_costo_id"
            opciones={opcionesCuenta}
            valorInicial={producto?.cuenta_costo_id ?? ""}
            etiquetaVacia="Cuenta por defecto"
            buscable
            className={FORM_COMBO}
          />
        </CampoFormulario>
      </div>
    </div>
  );
}

function EncabezadoFormulario({
  producto,
  pendiente,
  hrefCancelar,
}: {
  readonly producto: ProductoEditable | null;
  readonly pendiente: boolean;
  readonly hrefCancelar: string;
}) {
  const migas = [
    { etiqueta: "Productos", href: "/dashboard/productos" },
    { etiqueta: producto ? producto.nombre : "Nuevo producto" },
  ];

  return (
    <EncabezadoPagina
      titulo={producto ? "Editar producto" : "Nuevo producto"}
      subtitulo={
        producto
          ? "Cambia la información, el inventario y los precios del producto."
          : "Crea productos inventariables, servicios y combos para tus ventas."
      }
      migas={migas}
      acciones={
        <>
          <Button variant="outline" nativeButton={false} render={<Link href={hrefCancelar} prefetch={false} />}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pendiente}>
            {pendiente ? "Guardando..." : "Guardar"}
          </Button>
        </>
      }
    />
  );
}

function AvisosFormulario({ error, mensaje }: { readonly error: string | null; readonly mensaje: string | null }) {
  return (
    <>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {mensaje ? (
        <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
          {mensaje}
        </p>
      ) : null}
    </>
  );
}

function PieFormulario({
  producto,
  pendiente,
  hrefCancelar,
}: {
  readonly producto: ProductoEditable | null;
  readonly pendiente: boolean;
  readonly hrefCancelar: string;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
      <Button variant="outline" nativeButton={false} render={<Link href={hrefCancelar} prefetch={false} />}>
        Cancelar
      </Button>
      {producto ? null : (
        <Button type="submit" variant="outline" value="crear-otro" disabled={pendiente}>
          Guardar y crear otro
        </Button>
      )}
      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  );
}

function LateralFormulario({
  producto,
  valores,
  imagenUrl,
  subiendoImagen,
  errorImagen,
  controlaInventario,
  precioBase,
  precioTotal,
  etiquetaImpuestoActual,
  onSubirImagen,
  onQuitarImagen,
  onCambiar,
}: {
  readonly producto: ProductoEditable | null;
  readonly valores: ValoresFormulario;
  readonly imagenUrl: string | null;
  readonly subiendoImagen: boolean;
  readonly errorImagen: string | null;
  readonly controlaInventario: boolean;
  readonly precioBase: string;
  readonly precioTotal: string;
  readonly etiquetaImpuestoActual: string;
  readonly onSubirImagen: (evento: ChangeEvent<HTMLInputElement>) => void;
  readonly onQuitarImagen: () => void;
  readonly onCambiar: (cambios: Partial<ValoresFormulario>) => void;
}) {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
      <TarjetaImagen
        imagenUrl={imagenUrl}
        nombre={valores.nombre}
        subiendo={subiendoImagen}
        error={errorImagen}
        onSubir={onSubirImagen}
        onQuitar={onQuitarImagen}
      />

      <ResumenProducto
        valores={valores}
        controlaInventario={controlaInventario}
        precioBase={precioBase}
        precioTotal={precioTotal}
        etiquetaImpuestoActual={etiquetaImpuestoActual}
        onCambiar={onCambiar}
      />

      <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
        {producto
          ? "Los cambios de cantidad se registran como ajuste de inventario."
          : "La cantidad inicial entra al almacén elegido al guardar."}
      </p>
    </aside>
  );
}

function CamposCantidadCosto({
  producto,
  valores,
  controlaInventario,
  cambiar,
}: {
  readonly producto: ProductoEditable | null;
  readonly valores: ValoresFormulario;
  readonly controlaInventario: boolean;
  readonly cambiar: (cambios: Partial<ValoresFormulario>) => void;
}) {
  if (!controlaInventario) return <input type="hidden" name="costo" value="0" />;

  return (
    <>
      <CampoFormulario htmlFor="cantidad" label={producto ? "Cantidad actual" : "Cantidad inicial"}>
        <Input
          id="cantidad"
          name="cantidad"
          inputMode="decimal"
          placeholder="0"
          value={valores.cantidad}
          onChange={(evento) => cambiar({ cantidad: evento.target.value })}
          className={FORM_INPUT}
        />
      </CampoFormulario>

      <CampoFormulario htmlFor="costo" label="Costo por unidad">
        <Input
          id="costo"
          name="costo"
          inputMode="decimal"
          placeholder="0"
          value={valores.costo}
          onChange={(evento) => cambiar({ costo: evento.target.value })}
          className={FORM_INPUT}
        />
      </CampoFormulario>
    </>
  );
}

export function FormularioProducto({
  producto,
  categorias,
  almacenes,
  listasPrecios,
  impuestos,
  cuentas,
  existencias,
  imagenUrlInicial,
}: {
  readonly producto: ProductoEditable | null;
  readonly categorias: CategoriaProducto[];
  readonly almacenes: Almacen[];
  readonly listasPrecios: ListaPrecio[];
  readonly impuestos: Impuesto[];
  readonly cuentas: CuentaOpcion[];
  readonly existencias: ExistenciaAlmacen[];
  readonly imagenUrlInicial: string | null;
}) {
  const router = useRouter();
  const validacion = useValidacionFormulario();
  const [pendiente, startTransition] = useTransition();
  const almacenPorDefecto = (almacenes.find((almacen) => almacen.es_principal) ?? almacenes[0])?.id ?? "";

  const [valores, setValores] = useState<ValoresFormulario>(() =>
    valoresIniciales(producto, almacenPorDefecto, impuestos),
  );
  const [minimos, setMinimos] = useState<MinimosAlmacen>(() => minimosIniciales(existencias));
  const [preciosListas, setPreciosListas] = useState<PreciosListaFormulario>(() =>
    preciosIniciales(producto?.precios, listasPrecios),
  );
  const [imagenPath, setImagenPath] = useState(producto?.imagen_path ?? "");
  const [imagenUrl, setImagenUrl] = useState<string | null>(imagenUrlInicial);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [errorImagen, setErrorImagen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const controlaInventario = valores.tipo === "producto" && valores.inventariable;
  const precioNumero = parsearMonto(valores.precio) ?? 0;
  const itbisTasaNumero = Number(valores.itbisTasa) || 0;
  const precioTotal = formatoMoneda(precioConItbis(precioNumero, itbisTasaNumero));
  const impuestoActual = impuestos.find((impuesto) => impuesto.id === valores.impuestoId) ?? null;
  const etiquetaImpuestoActual = impuestoActual
    ? etiquetaImpuesto(impuestoActual)
    : `ITBIS ${etiquetaTasaItbis(itbisTasaNumero)}`;
  const almacenSeleccionado = almacenes.find((almacen) => almacen.id === valores.almacenId) ?? null;
  const existenciasPorAlmacen = new Set(existencias.map((existencia) => existencia.almacen_id));
  const opcionesCategoria = categorias.map((categoria) => ({ value: categoria.id, label: categoria.nombre }));
  const opcionesAlmacen = almacenes.map((almacen) => ({ value: almacen.id, label: almacen.nombre }));

  function cambiar(cambios: Partial<ValoresFormulario>) {
    setValores((previos) => ({ ...previos, ...cambios }));
  }

  function cambiarTipo(tipo: string) {
    setValores((previos) => valoresConTipo(previos, tipo));
  }

  function cambiarImpuesto(impuestoId: string) {
    setValores((previos) => valoresConImpuesto(previos, impuestos, impuestoId));
  }

  function cambiarPrecioLista(listaId: string, valor: string) {
    setPreciosListas((previos) => ({ ...previos, [listaId]: valor }));
  }

  function cambiarMinimo(almacenId: string, campo: "minimo" | "maximo", valor: string) {
    setMinimos((previos) => ({
      ...previos,
      [almacenId]: { ...(previos[almacenId] ?? { minimo: "", maximo: "" }), [campo]: valor },
    }));
  }

  function errorEnMinimos(): string | null {
    return errorEnMinimosDeFormulario(almacenes, valores.almacenId, minimos, existenciasPorAlmacen, controlaInventario);
  }

  async function subirImagen(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0] ?? null;
    evento.target.value = "";
    if (archivo === null) return;

    const problema = validarImagenProducto(archivo);
    if (problema) {
      setErrorImagen(problema);
      return;
    }

    setErrorImagen(null);
    setSubiendoImagen(true);

    try {
      const supabase = createClient();
      const ruta = `${producto?.id ?? "nuevo"}/${crypto.randomUUID()}.${extensionImagenProducto(archivo.type)}`;
      const { error: errorSubida } = await supabase.storage
        .from(BUCKET_IMAGENES_PRODUCTO)
        .upload(ruta, archivo, { cacheControl: "3600", contentType: archivo.type, upsert: false });

      if (errorSubida) {
        setErrorImagen(mensajeSubidaImagen(errorSubida.message));
        return;
      }

      const { data } = await supabase.storage.from(BUCKET_IMAGENES_PRODUCTO).createSignedUrl(ruta, 3600);
      setImagenPath(ruta);
      setImagenUrl(data?.signedUrl ?? null);
    } catch {
      setErrorImagen("No se pudo subir la imagen. Intenta de nuevo.");
    } finally {
      setSubiendoImagen(false);
    }
  }

  function quitarImagen() {
    // Solo se quita la referencia; el guardado borra `imagen_path` y el objeto
    // queda en el bucket hasta que el producto se guarde.
    setImagenPath("");
    setImagenUrl(null);
    setErrorImagen(null);
  }

  function reiniciarFormulario() {
    setValores(valoresIniciales(null, almacenPorDefecto, impuestos));
    setMinimos({});
    setPreciosListas(preciosIniciales(null, listasPrecios));
    setImagenPath("");
    setImagenUrl(null);
    setErrorImagen(null);
    setError(null);
    validacion.limpiarTodo();
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setMensaje(null);

    const formData = new FormData(evento.currentTarget);
    const submitter = (evento.nativeEvent as SubmitEvent).submitter;
    const crearOtro = esAccionCrearOtro(submitter);

    const reglas = [
      requerido("nombre", formData.get("nombre"), "El nombre es requerido."),
      requerido("precio", formData.get("precio"), "El precio es requerido."),
      requerido("unidad_medida", formData.get("unidad_medida"), "La unidad de medida es requerida."),
      requerido("almacen_id", valores.almacenId, "El almacén es requerido."),
    ];

    if (!validacion.validar(reglas)) return;

    const problemaMinimos = errorEnMinimos();
    if (problemaMinimos) {
      setError(problemaMinimos);
      return;
    }

    startTransition(async () => {
      const resultado = producto ? await actualizarProducto(producto.id, formData) : await crearProducto(formData);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      if (producto) {
        router.push(rutaProducto(producto.id));
        router.refresh();
        return;
      }

      if (crearOtro) {
        reiniciarFormulario();
        setMensaje("Producto creado. Puedes crear otro.");
        return;
      }

      router.push(resultado.id ? rutaProducto(resultado.id) : "/dashboard/productos");
      router.refresh();
    });
  }

  const hrefCancelar = producto ? rutaProducto(producto.id) : "/dashboard/productos";

  return (
    <form noValidate onSubmit={enviar} className="flex flex-col gap-6">
      <EncabezadoFormulario producto={producto} pendiente={pendiente} hrefCancelar={hrefCancelar} />

      <input type="hidden" name="tipo" value={valores.tipo} />
      <input type="hidden" name="inventariable" value={String(controlaInventario)} />
      <input type="hidden" name="vende_negativo" value={String(valores.vendeNegativo)} />
      <input type="hidden" name="activo" value={String(valores.activo)} />
      <input type="hidden" name="itbis_tasa" value={valores.itbisTasa} />
      <input type="hidden" name="almacen_id" value={valores.almacenId} />
      <input type="hidden" name="categoria_id" value={valores.categoriaId} />
      <input type="hidden" name="imagen_path" value={imagenPath} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <FormCard>
            <FormSectionTitle descripcion="Los servicios y los combos no controlan inventario.">
              Información general
            </FormSectionTitle>

            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-1 text-sm leading-5 font-medium text-slate-700">
                Tipo de producto<span className="text-primary text-xs font-normal">*</span>
              </span>
              <Tabs value={valores.tipo} onValueChange={(tipo) => cambiarTipo(String(tipo))}>
                <TabsList className="flex min-h-10 w-full gap-1">
                  {OPCIONES_TIPO.map((opcion) => (
                    <TabsTrigger key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <CampoFormulario
                htmlFor="nombre"
                label="Nombre"
                required
                error={validacion.errorDe("nombre")}
                className="sm:col-span-2"
              >
                <Input
                  id="nombre"
                  name="nombre"
                  maxLength={200}
                  value={valores.nombre}
                  onChange={(evento) => {
                    cambiar({ nombre: evento.target.value });
                    validacion.limpiar("nombre");
                  }}
                  className={FORM_INPUT}
                />
              </CampoFormulario>

              <CampoFormulario htmlFor="almacen_id" label="Almacén" required>
                {almacenes.length === 0 ? (
                  <Alert variant="destructive">
                    <AlertDescription>No hay almacenes activos. Crea uno antes de guardar productos.</AlertDescription>
                  </Alert>
                ) : (
                  <SelectCampo
                    id="almacen_id"
                    opciones={opcionesAlmacen}
                    valor={valores.almacenId}
                    onCambio={(almacenId) => cambiar({ almacenId })}
                    className={FORM_SELECT}
                  />
                )}
              </CampoFormulario>

              <CampoFormulario htmlFor="categoria_id" label="Categoría">
                <SelectCampo
                  id="categoria_id"
                  opciones={opcionesCategoria}
                  valor={valores.categoriaId}
                  onCambio={(categoriaId) => cambiar({ categoriaId })}
                  etiquetaVacia="Sin categoría"
                  buscable
                  className={FORM_COMBO}
                />
              </CampoFormulario>

              <CampoFormulario
                htmlFor="unidad_medida"
                label="Unidad de medida"
                required
                error={validacion.errorDe("unidad_medida")}
              >
                <Input
                  id="unidad_medida"
                  name="unidad_medida"
                  maxLength={60}
                  placeholder="Ej. Unidad, Caja, Galón"
                  value={valores.unidadMedida}
                  onChange={(evento) => {
                    cambiar({ unidadMedida: evento.target.value });
                    validacion.limpiar("unidad_medida");
                  }}
                  className={FORM_INPUT}
                />
              </CampoFormulario>

              <CampoFormulario htmlFor="referencia" label="Referencia">
                <Input
                  id="referencia"
                  name="referencia"
                  maxLength={100}
                  placeholder="Ej. OXI-001"
                  value={valores.referencia}
                  onChange={(evento) => cambiar({ referencia: evento.target.value })}
                  className={FORM_INPUT}
                />
              </CampoFormulario>

              <div className="flex items-center justify-between gap-3 self-start rounded-[10px] border border-slate-300 bg-white px-3 py-2 sm:col-span-2">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-700">Estado</span>
                  <span className="text-muted-foreground text-xs">
                    {valores.activo ? "Activo: se puede vender." : "Inactivo: no aparece al facturar."}
                  </span>
                </div>
                <Switch
                  checked={valores.activo}
                  aria-label="Producto activo"
                  onCheckedChange={(activo) => cambiar({ activo })}
                />
              </div>

              <CampoFormulario htmlFor="descripcion" label="Descripción" className="sm:col-span-2">
                <Textarea
                  id="descripcion"
                  name="descripcion"
                  value={valores.descripcion}
                  onChange={(evento) => cambiar({ descripcion: evento.target.value })}
                  className={FORM_TEXTAREA}
                />
              </CampoFormulario>
            </div>
          </FormCard>

          <FormCard>
            <FormSectionTitle
              descripcion={
                almacenSeleccionado
                  ? `Al cambiar la cantidad, la diferencia se ajusta en ${almacenSeleccionado.nombre}.`
                  : undefined
              }
            >
              Inventario y precio
            </FormSectionTitle>

            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <CamposCantidadCosto
                producto={producto}
                valores={valores}
                controlaInventario={controlaInventario}
                cambiar={cambiar}
              />

              <CampoFormulario htmlFor="precio" label="Precio base" required error={validacion.errorDe("precio")}>
                <Input
                  id="precio"
                  name="precio"
                  inputMode="decimal"
                  value={valores.precio}
                  onChange={(evento) => {
                    cambiar({ precio: evento.target.value });
                    validacion.limpiar("precio");
                  }}
                  className={FORM_INPUT}
                />
              </CampoFormulario>

              <CampoFormulario htmlFor="impuesto_id" label="Impuesto">
                <SelectorImpuesto
                  id="impuesto_id"
                  name="impuesto_id"
                  className={FORM_SELECT}
                  impuestos={impuestos}
                  value={valores.impuestoId}
                  onValueChange={cambiarImpuesto}
                />
              </CampoFormulario>

              <CampoFormulario htmlFor="precio_total" label="Precio total">
                <Input
                  id="precio_total"
                  readOnly
                  tabIndex={-1}
                  value={precioTotal}
                  aria-readonly="true"
                  className="h-10 rounded-[10px] border-slate-300 bg-slate-50 px-2 text-base text-slate-700 tabular-nums"
                />
              </CampoFormulario>
            </div>
          </FormCard>

          <Collapsible className="rounded-xl border border-slate-200 bg-white">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
              <span className="flex flex-col gap-0.5">
                <span className="text-base leading-6 font-semibold text-slate-700">Opciones avanzadas</span>
                <span className="text-muted-foreground text-sm">
                  Almacenes, listas de precios y cuentas contables del producto.
                </span>
              </span>
              <ChevronDown className="text-muted-foreground size-4 shrink-0" />
            </CollapsibleTrigger>

            <CollapsibleContent className="flex flex-col gap-6 border-t border-slate-200 p-4">
              <TablaAlmacenes
                almacenes={almacenes}
                existencias={existencias}
                valores={valores}
                minimos={minimos}
                controlaInventario={controlaInventario}
                onCambiarMinimo={cambiarMinimo}
              />

              <ListasPrecios listasPrecios={listasPrecios} valores={preciosListas} onCambiar={cambiarPrecioLista} />

              <CuentasContables producto={producto} cuentas={cuentas} controlaInventario={controlaInventario} />
            </CollapsibleContent>
          </Collapsible>
        </div>

        <LateralFormulario
          producto={producto}
          valores={valores}
          imagenUrl={imagenUrl}
          subiendoImagen={subiendoImagen}
          errorImagen={errorImagen}
          controlaInventario={controlaInventario}
          precioBase={formatoMoneda(precioNumero)}
          precioTotal={precioTotal}
          etiquetaImpuestoActual={etiquetaImpuestoActual}
          onSubirImagen={subirImagen}
          onQuitarImagen={quitarImagen}
          onCambiar={cambiar}
        />
      </div>

      <AvisosFormulario error={error} mensaje={mensaje} />

      <PieFormulario producto={producto} pendiente={pendiente} hrefCancelar={hrefCancelar} />
    </form>
  );
}
