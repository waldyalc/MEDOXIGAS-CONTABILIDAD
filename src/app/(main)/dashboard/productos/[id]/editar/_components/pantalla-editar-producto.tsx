"use client";

import { type FormEvent, type ReactNode, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "cn";
import { ArrowLeft, Boxes, Hash, Package, Paperclip, Percent, Tag, Wrench } from "lucide-react";

import { CLASE_PANEL_FICHA, GrillaKpis, ItemDato, type KpiFicha, MetaItem, Pildora } from "@/components/ficha/ficha-ui";
import { CampoFormulario } from "@/components/formularios/campo-formulario";
import { FORM_COMBO, FORM_INPUT, FORM_SELECT, FORM_TEXTAREA } from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { type ColumnaLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
import { SelectCampo } from "@/components/select-campo";
import { SelectorImpuesto } from "@/components/selector-impuesto";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { CuentaOpcion } from "@/lib/contabilidad/validacion";
import { rutaProducto } from "@/lib/enlaces";
import { formatoCantidad, formatoMoneda } from "@/lib/facturacion/formato";
import { requerido } from "@/lib/formularios/validacion";
import { etiquetaImpuesto, type Impuesto, impuestoNinguno, impuestoPorTasa } from "@/lib/impuestos/tipos";
import { etiquetaTipoLista } from "@/lib/inventario/precios";
import type { CategoriaProducto, ExistenciaAlmacen, ListaPrecio, PrecioLista } from "@/lib/inventario/tipos";
import { actualizarProducto } from "@/lib/productos/actions";
import type { ProductoEditable } from "@/lib/productos/consultas";
import { precioConItbis } from "@/lib/productos/ficha";
import { etiquetaTasaItbis, type ProductoTipo, parsearMonto } from "@/lib/productos/productos";

type Validacion = ReturnType<typeof useValidacionFormulario>;

interface ValoresFormulario {
  nombre: string;
  referencia: string;
  tipo: ProductoTipo;
  inventariable: boolean;
  activo: boolean;
  precio: string;
  costo: string;
  cantidad: string;
  impuestoId: string;
  itbisTasa: string;
}

const OPCIONES_TIPO = [
  { value: "producto", label: "Producto" },
  { value: "servicio", label: "Servicio" },
];

const CLASE_SUBPANEL = "ring-foreground/10 rounded-lg ring-1";

const COLUMNAS_ALMACENES: readonly ColumnaLista<ExistenciaAlmacen>[] = [
  {
    clave: "almacen",
    encabezado: "Almacén",
    celda: (existencia) => (
      <span className="inline-flex items-center gap-2 font-medium">
        {existencia.almacen_nombre}
        {existencia.es_principal ? <PillEstado tono="info">Principal</PillEstado> : null}
      </span>
    ),
  },
  {
    clave: "actual",
    encabezado: "Cantidad actual",
    alineacion: "derecha",
    celda: (existencia) => <span className="tabular-nums">{formatoCantidad(existencia.cantidad)}</span>,
  },
];

function Seccion({
  titulo,
  descripcion,
  children,
}: {
  readonly titulo: string;
  readonly descripcion?: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        {descripcion ? <p className="text-muted-foreground text-xs">{descripcion}</p> : null}
      </div>
      {children}
    </section>
  );
}

function TarjetaPrecio({
  precio,
  itbisTasa,
  costo,
  etiquetaImpuestoActual,
}: {
  readonly precio: number;
  readonly itbisTasa: number;
  readonly costo: number;
  readonly etiquetaImpuestoActual: string;
}) {
  return (
    <aside className={cn(CLASE_SUBPANEL, "bg-muted/30 flex flex-col gap-4 p-4")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-xs">Precio total</span>
        <span className="text-muted-foreground text-xs">DOP</span>
      </div>
      <span className="-mt-3 text-2xl font-semibold tracking-tight tabular-nums">
        {formatoMoneda(precioConItbis(precio, itbisTasa))}
      </span>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <ItemDato etiqueta="Precio sin impuesto">
          <span className="tabular-nums">{formatoMoneda(precio)}</span>
        </ItemDato>
        <ItemDato etiqueta="Impuesto">{etiquetaImpuestoActual}</ItemDato>
        <ItemDato etiqueta="Costo por unidad">
          <span className="tabular-nums">{formatoMoneda(costo)}</span>
        </ItemDato>
      </dl>
    </aside>
  );
}

function EncabezadoEdicion({
  productoId,
  valores,
  controlaInventario,
  precio,
  pendiente,
}: {
  readonly productoId: string;
  readonly valores: ValoresFormulario;
  readonly controlaInventario: boolean;
  readonly precio: number;
  readonly pendiente: boolean;
}) {
  const esServicio = valores.tipo === "servicio";

  return (
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3.5">
        <div className="bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-lg">
          {esServicio ? <Wrench className="size-6" /> : <Package className="size-6" />}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{valores.nombre.trim() || "Producto sin nombre"}</h1>
            <Pildora className="bg-muted text-muted-foreground">Editando</Pildora>
            <Pildora className="bg-primary/10 text-primary">{esServicio ? "Servicio" : "Producto"}</Pildora>
            {controlaInventario ? (
              <Pildora className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Inventariable
              </Pildora>
            ) : null}
            <Pildora
              className={
                valores.activo
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }
            >
              {valores.activo ? "Activo" : "Inactivo"}
            </Pildora>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <MetaItem
              icono={<Hash className="size-3.5" />}
              texto={`Ref: ${valores.referencia.trim() || "Sin referencia"}`}
            />
            <MetaItem
              icono={<Tag className="size-3.5" />}
              texto={formatoMoneda(precioConItbis(precio, Number(valores.itbisTasa) || 0))}
            />
            <MetaItem
              icono={<Percent className="size-3.5" />}
              texto={`ITBIS ${etiquetaTasaItbis(Number(valores.itbisTasa) || 0)}`}
            />
            {controlaInventario ? (
              <MetaItem
                icono={<Boxes className="size-3.5" />}
                texto={`Existencia: ${formatoCantidad(parsearMonto(valores.cantidad) ?? 0)}`}
              />
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={rutaProducto(productoId)} prefetch={false} />}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}

function DatosDelProducto({
  producto,
  categorias,
  valores,
  onCambiar,
  validacion,
}: {
  readonly producto: ProductoEditable;
  readonly categorias: CategoriaProducto[];
  readonly valores: ValoresFormulario;
  readonly onCambiar: (cambios: Partial<ValoresFormulario>) => void;
  readonly validacion: Validacion;
}) {
  const esServicio = valores.tipo === "servicio";
  const opcionesCategoria = categorias.map((categoria) => ({ value: categoria.id, label: categoria.nombre }));

  function cambiarTipo(valor: string) {
    if (valor === "servicio") {
      onCambiar({ tipo: "servicio", inventariable: false });
      return;
    }
    onCambiar({ tipo: "producto" });
  }

  return (
    <Seccion titulo={`Datos del ${esServicio ? "servicio" : "producto"}`}>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <CampoFormulario htmlFor="tipo" label="Tipo">
          <SelectCampo
            id="tipo"
            name="tipo"
            opciones={OPCIONES_TIPO}
            valor={valores.tipo}
            onCambio={cambiarTipo}
            className={FORM_SELECT}
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="categoria_id" label="Categoría">
          <SelectCampo
            id="categoria_id"
            name="categoria_id"
            opciones={opcionesCategoria}
            valorInicial={producto.categoria_id ?? ""}
            etiquetaVacia="Sin categoría"
            buscable
            className={FORM_COMBO}
          />
        </CampoFormulario>

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
            required
            maxLength={200}
            value={valores.nombre}
            onChange={(evento) => {
              onCambiar({ nombre: evento.target.value });
              validacion.limpiar("nombre");
            }}
            className={FORM_INPUT}
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="referencia" label="Referencia">
          <Input
            id="referencia"
            name="referencia"
            value={valores.referencia}
            onChange={(evento) => onCambiar({ referencia: evento.target.value })}
            placeholder="Ej. OXI-001"
            className={FORM_INPUT}
          />
        </CampoFormulario>

        <CampoFormulario htmlFor="activo" label="Estado">
          <div className="flex h-10 items-center justify-between gap-3 rounded-[10px] border border-slate-300 bg-white px-3">
            <span className="text-sm text-slate-700">{valores.activo ? "Activo" : "Inactivo"}</span>
            <Switch
              id="activo"
              checked={valores.activo}
              onCheckedChange={(marcado) => onCambiar({ activo: marcado })}
            />
          </div>
          <input type="hidden" name="activo" value={String(valores.activo)} />
        </CampoFormulario>

        <CampoFormulario htmlFor="descripcion" label="Descripción" className="sm:col-span-2">
          <Textarea
            id="descripcion"
            name="descripcion"
            defaultValue={producto.descripcion ?? ""}
            className={FORM_TEXTAREA}
          />
        </CampoFormulario>
      </div>
    </Seccion>
  );
}

function InventarioYPrecio({
  valores,
  controlaInventario,
  impuestos,
  precioTotal,
  onCambiar,
  validacion,
}: {
  readonly valores: ValoresFormulario;
  readonly controlaInventario: boolean;
  readonly impuestos: Impuesto[];
  readonly precioTotal: string;
  readonly onCambiar: (cambios: Partial<ValoresFormulario>) => void;
  readonly validacion: Validacion;
}) {
  function cambiarImpuesto(id: string) {
    const impuesto = impuestos.find((item) => item.id === id);
    onCambiar({ impuestoId: id, itbisTasa: String(impuesto?.tarifa ?? 0) });
  }

  return (
    <Seccion
      titulo="Inventario y precio"
      descripcion={
        controlaInventario ? "Al cambiar la existencia, la diferencia se ajusta en el almacén principal." : undefined
      }
    >
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {valores.tipo === "producto" ? (
          <div className="flex items-center justify-between gap-3 rounded-[10px] border border-slate-300 bg-white px-3 py-2 sm:col-span-2 lg:col-span-3">
            <div className="flex flex-col">
              <Label htmlFor="inventariable">Controlar inventario</Label>
              <span className="text-muted-foreground text-xs">Lleva el costo y las cantidades por almacén.</span>
            </div>
            <Switch
              id="inventariable"
              checked={controlaInventario}
              onCheckedChange={(marcado) => onCambiar({ inventariable: marcado })}
            />
          </div>
        ) : null}
        <input type="hidden" name="inventariable" value={String(controlaInventario)} />

        {controlaInventario ? (
          <>
            <CampoFormulario htmlFor="cantidad" label="Existencia actual">
              <Input
                id="cantidad"
                name="cantidad"
                inputMode="decimal"
                placeholder="0"
                value={valores.cantidad}
                onChange={(evento) => onCambiar({ cantidad: evento.target.value })}
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
                onChange={(evento) => onCambiar({ costo: evento.target.value })}
                className={FORM_INPUT}
              />
            </CampoFormulario>
          </>
        ) : null}

        <CampoFormulario htmlFor="precio" label="Precio base" required error={validacion.errorDe("precio")}>
          <Input
            id="precio"
            name="precio"
            inputMode="decimal"
            required
            value={valores.precio}
            onChange={(evento) => {
              onCambiar({ precio: evento.target.value });
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
          <input type="hidden" name="itbis_tasa" value={valores.itbisTasa} />
        </CampoFormulario>

        <CampoFormulario htmlFor="precio_total" label="Precio total">
          <Input
            id="precio_total"
            readOnly
            tabIndex={-1}
            value={precioTotal}
            aria-readonly="true"
            className={cn(FORM_INPUT, "bg-muted/50 cursor-default")}
          />
        </CampoFormulario>
      </div>
    </Seccion>
  );
}

function SeccionAlmacenes({
  visible,
  existencias,
}: {
  readonly visible: boolean;
  readonly existencias: ExistenciaAlmacen[];
}) {
  if (!visible) return null;

  return (
    <Seccion titulo="Almacenes" descripcion="Existencias guardadas por almacén.">
      <div className={cn(CLASE_SUBPANEL, "overflow-hidden")}>
        <TablaLista
          columnas={COLUMNAS_ALMACENES}
          filas={existencias}
          claveFila={(existencia) => existencia.almacen_id}
          vacio={{ titulo: "Sin existencias registradas por almacén" }}
        />
      </div>
    </Seccion>
  );
}

function SeccionListasPrecios({
  listasPrecios,
  precios,
}: {
  readonly listasPrecios: ListaPrecio[];
  readonly precios: PrecioLista[];
}) {
  return (
    <Seccion titulo="Listas de precios">
      {listasPrecios.length > 0 ? (
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {listasPrecios.map((lista) => {
            const valor = precios.find((item) => item.lista_id === lista.id)?.precio;

            return (
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
                  defaultValue={valor === undefined ? "" : String(valor)}
                  className={FORM_INPUT}
                />
                <span className="text-muted-foreground text-xs">{etiquetaTipoLista(lista.tipo)}</span>
              </CampoFormulario>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No hay listas de precios activas.</p>
      )}
    </Seccion>
  );
}

function SeccionAdjuntos() {
  return (
    <Seccion titulo="Archivos adjuntos">
      <Empty className="border border-dashed py-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Paperclip />
          </EmptyMedia>
          <EmptyTitle>Sin archivos adjuntos</EmptyTitle>
          <EmptyDescription>Aquí aparecerán los archivos de este producto.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </Seccion>
  );
}

function SeccionContabilidad({
  producto,
  cuentas,
  controlaInventario,
}: {
  readonly producto: ProductoEditable;
  readonly cuentas: CuentaOpcion[];
  readonly controlaInventario: boolean;
}) {
  const opcionesCuenta = cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} · ${cuenta.nombre}`,
  }));

  return (
    <Seccion titulo="Contabilidad" descripcion="Si no eliges una cuenta, se usa la de la configuración contable.">
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <CampoFormulario htmlFor="cuenta_ingreso_id" label="Cuenta de ventas">
          <SelectCampo
            id="cuenta_ingreso_id"
            name="cuenta_ingreso_id"
            opciones={opcionesCuenta}
            valorInicial={producto.cuenta_ingreso_id ?? ""}
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
              valorInicial={producto.cuenta_inventario_id ?? ""}
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
            valorInicial={producto.cuenta_costo_id ?? ""}
            etiquetaVacia="Cuenta por defecto"
            buscable
            className={FORM_COMBO}
          />
        </CampoFormulario>
      </div>
    </Seccion>
  );
}

function construirKpis(
  precio: number,
  itbisTasa: number,
  costo: number,
  cantidad: number,
  controlaInventario: boolean,
): KpiFicha[] {
  const kpis: KpiFicha[] = [
    { etiqueta: "Precio con ITBIS", valor: formatoMoneda(precioConItbis(precio, itbisTasa)), tono: "normal" },
    { etiqueta: "Costo", valor: formatoMoneda(costo), tono: "normal" },
  ];
  if (controlaInventario) {
    kpis.push({
      etiqueta: "Existencia actual",
      valor: formatoCantidad(cantidad),
      tono: cantidad > 0 ? "normal" : "pendiente",
    });
  }
  return kpis;
}

export function PantallaEditarProducto({
  producto,
  categorias,
  listasPrecios,
  impuestos,
  cuentas,
  existencias,
}: {
  readonly producto: ProductoEditable;
  readonly categorias: CategoriaProducto[];
  readonly listasPrecios: ListaPrecio[];
  readonly impuestos: Impuesto[];
  readonly cuentas: CuentaOpcion[];
  readonly existencias: ExistenciaAlmacen[];
}) {
  const router = useRouter();
  const [valores, setValores] = useState<ValoresFormulario>(() => ({
    nombre: producto.nombre,
    referencia: producto.referencia ?? "",
    tipo: producto.tipo,
    inventariable: producto.inventariable,
    activo: producto.activo,
    precio: String(producto.precio),
    costo: String(producto.costo),
    cantidad: String(producto.cantidad),
    impuestoId:
      producto.impuesto_id ??
      impuestoPorTasa(impuestos, producto.itbis_tasa)?.id ??
      impuestoNinguno(impuestos)?.id ??
      "",
    itbisTasa: String(producto.itbis_tasa),
  }));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const validacion = useValidacionFormulario();

  const controlaInventario = valores.tipo === "producto" && valores.inventariable;
  const precioNumero = parsearMonto(valores.precio) ?? 0;
  const costoNumero = parsearMonto(valores.costo) ?? 0;
  const cantidadNumero = parsearMonto(valores.cantidad) ?? 0;
  const itbisTasaNumero = Number(valores.itbisTasa) || 0;
  const impuestoActual = impuestos.find((impuesto) => impuesto.id === valores.impuestoId) ?? null;
  const etiquetaImpuestoActual = impuestoActual
    ? etiquetaImpuesto(impuestoActual)
    : `ITBIS ${etiquetaTasaItbis(itbisTasaNumero)}`;

  function cambiar(cambios: Partial<ValoresFormulario>) {
    setValores((previos) => ({ ...previos, ...cambios }));
  }

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    if (
      !validacion.validar([
        requerido("nombre", formData.get("nombre"), "El nombre es requerido."),
        requerido("precio", formData.get("precio"), "El precio es requerido."),
      ])
    ) {
      return;
    }

    startTransition(async () => {
      const resultado = await actualizarProducto(producto.id, formData);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(rutaProducto(producto.id));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6" style={{ fontFamily: "var(--font-inter)" }}>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={<Link href={rutaProducto(producto.id)} prefetch={false} />}
      >
        <ArrowLeft data-icon="inline-start" />
        Volver al producto
      </Button>

      <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
        <div className={CLASE_PANEL_FICHA}>
          <EncabezadoEdicion
            productoId={producto.id}
            valores={valores}
            controlaInventario={controlaInventario}
            precio={precioNumero}
            pendiente={pendiente}
          />

          <div className="px-5 pb-5">
            <GrillaKpis
              kpis={construirKpis(precioNumero, itbisTasaNumero, costoNumero, cantidadNumero, controlaInventario)}
            />
          </div>

          <div className="border-border flex flex-col gap-8 border-t p-5">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <DatosDelProducto
                producto={producto}
                categorias={categorias}
                valores={valores}
                onCambiar={cambiar}
                validacion={validacion}
              />
              <TarjetaPrecio
                precio={precioNumero}
                itbisTasa={itbisTasaNumero}
                costo={costoNumero}
                etiquetaImpuestoActual={etiquetaImpuestoActual}
              />
            </div>

            <InventarioYPrecio
              valores={valores}
              controlaInventario={controlaInventario}
              impuestos={impuestos}
              precioTotal={formatoMoneda(precioConItbis(precioNumero, itbisTasaNumero))}
              onCambiar={cambiar}
              validacion={validacion}
            />

            <SeccionAlmacenes visible={controlaInventario} existencias={existencias} />

            <div className="grid gap-6 lg:grid-cols-2">
              <SeccionListasPrecios listasPrecios={listasPrecios} precios={producto.precios} />
              <SeccionAdjuntos />
            </div>

            <SeccionContabilidad producto={producto} cuentas={cuentas} controlaInventario={controlaInventario} />

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <div className="border-border flex flex-wrap justify-end gap-2 border-t p-5">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={rutaProducto(producto.id)} prefetch={false} />}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
