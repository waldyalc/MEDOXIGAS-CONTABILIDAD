"use client";

import { type FormEvent, useEffect, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ChevronDown, Package, Pencil, Plus, Upload } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { FORM_INPUT, FORM_SELECT, FORM_TEXTAREA, FormField } from "@/components/formularios/formulario";
import { BuscadorLista } from "@/components/listas/buscador-lista";
import { PaginadorLista } from "@/components/listas/paginador-lista";
import {
  BarraLista,
  type ColumnaLista,
  ContenedorLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { SelectorImpuesto } from "@/components/selector-impuesto";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { rutaProducto } from "@/lib/enlaces";
import { type Impuesto, impuestoNinguno, impuestoPorTasa } from "@/lib/impuestos/tipos";
import { etiquetaTipoLista } from "@/lib/inventario/precios";
import type { CategoriaProducto, ListaPrecio } from "@/lib/inventario/tipos";
import { type OpcionesLista, type ParametrosLista, type ResumenPagina, TAMANOS_PAGINA } from "@/lib/listas/parametros";
import { actualizarProducto, crearProducto } from "@/lib/productos/actions";
import {
  etiquetaTasaItbis,
  formatoCantidad,
  formatoMoneda,
  type Producto,
  type ProductoTipo,
  SIN_CATEGORIA,
} from "@/lib/productos/productos";

import { EditarSeleccionadosDialogo } from "./editar-seleccionados-dialogo";
import { ImportarProductosDialogo } from "./importar-productos-dialogo";

const OPCIONES_TIPO = [
  { value: "producto", label: "Producto" },
  { value: "servicio", label: "Servicio" },
] as const;

function muestraInventario(producto: Producto) {
  return producto.tipo === "producto" && producto.inventariable;
}

function columnasProductos(): readonly ColumnaLista<Producto>[] {
  return [
    {
      clave: "nombre",
      encabezado: "Nombre",
      celda: (producto) => (
        <Enlace href={rutaProducto(producto.id)} className="font-medium">
          {producto.nombre}
        </Enlace>
      ),
    },
    {
      clave: "referencia",
      encabezado: "Referencia",
      celda: (producto) => <span className="text-muted-foreground">{producto.referencia?.trim() || "—"}</span>,
    },
    {
      clave: "precio",
      encabezado: "Precio",
      alineacion: "derecha",
      celda: (producto) => formatoMoneda(producto.precio),
    },
    {
      clave: "itbis",
      encabezado: "ITBIS",
      alineacion: "derecha",
      celda: (producto) => etiquetaTasaItbis(producto.itbis_tasa),
    },
    {
      clave: "existencia",
      encabezado: "Existencia",
      alineacion: "derecha",
      celda: (producto) => (muestraInventario(producto) ? formatoCantidad(producto.cantidad) : "—"),
    },
    {
      clave: "costo",
      encabezado: "Costo",
      alineacion: "derecha",
      celda: (producto) => (muestraInventario(producto) ? formatoMoneda(producto.costo) : "—"),
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (producto) => (
        <PillEstado tono={producto.activo ? "exito" : "neutro"}>{producto.activo ? "Activo" : "Inactivo"}</PillEstado>
      ),
    },
  ];
}

function CamposInventario({
  producto,
  inventariable,
  onCambiarInventariable,
}: {
  readonly producto: Producto | null;
  readonly inventariable: boolean;
  readonly onCambiarInventariable: (valor: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="inventariable">Controlar inventario</Label>
        <Switch
          id="inventariable"
          name="inventariable"
          checked={inventariable}
          onCheckedChange={onCambiarInventariable}
        />
      </div>

      {inventariable ? (
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <FormField htmlFor="cantidad" label="Cantidad inicial">
            <Input
              id="cantidad"
              name="cantidad"
              inputMode="decimal"
              placeholder="0"
              defaultValue={producto ? String(producto.cantidad) : ""}
              className={FORM_INPUT}
            />
          </FormField>
          <FormField htmlFor="costo" label="Costo">
            <Input
              id="costo"
              name="costo"
              inputMode="decimal"
              placeholder="0"
              defaultValue={producto ? String(producto.costo) : ""}
              className={FORM_INPUT}
            />
          </FormField>
        </div>
      ) : null}
    </div>
  );
}

function PreciosPorLista({ listas, producto }: { listas: ListaPrecio[]; producto: Producto | null }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Precios por lista</span>
        <span className="text-muted-foreground text-xs">
          Valor fijo en RD$ o porcentaje sobre el precio (10 = +10 %, -10 = descuento).
        </span>
      </div>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {listas.map((lista) => {
          const valor = producto?.precios.find((precio) => precio.lista_id === lista.id)?.precio;

          return (
            <FormField
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
            </FormField>
          );
        })}
      </div>
    </div>
  );
}

function MasOpcionesProducto({
  producto,
  opcionesCategoria,
  listasPrecios,
}: {
  producto: Producto | null;
  opcionesCategoria: { value: string; label: string }[];
  listasPrecios: ListaPrecio[];
}) {
  return (
    <Collapsible
      className="rounded-xl border border-slate-200"
      defaultOpen={Boolean(
        producto?.referencia ??
          producto?.descripcion ??
          producto?.categoria_id ??
          (producto?.precios?.length ? "precios" : null),
      )}
    >
      <CollapsibleTrigger render={<Button type="button" variant="ghost" className="w-full justify-between" />}>
        Más opciones
        <ChevronDown className="size-4" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 border-t border-slate-200 p-3">
        <FormField htmlFor="categoria_id" label="Categoría">
          <Select name="categoria_id" defaultValue={producto?.categoria_id ?? SIN_CATEGORIA} items={opcionesCategoria}>
            <SelectTrigger id="categoria_id" className={FORM_SELECT}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opcionesCategoria.map((opcion) => (
                <SelectItem key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        {listasPrecios.length > 0 ? <PreciosPorLista listas={listasPrecios} producto={producto} /> : null}
        <FormField htmlFor="referencia" label="Referencia">
          <Input
            id="referencia"
            name="referencia"
            defaultValue={producto?.referencia ?? ""}
            placeholder="Ej. OXI-001"
            className={FORM_INPUT}
          />
        </FormField>
        <FormField htmlFor="descripcion" label="Descripción">
          <Textarea
            id="descripcion"
            name="descripcion"
            defaultValue={producto?.descripcion ?? ""}
            className={FORM_TEXTAREA}
          />
        </FormField>
      </CollapsibleContent>
    </Collapsible>
  );
}

function FormularioProducto({
  producto,
  categorias,
  listasPrecios,
  impuestos,
  onGuardado,
}: {
  readonly producto: Producto | null;
  readonly categorias: CategoriaProducto[];
  readonly listasPrecios: ListaPrecio[];
  readonly impuestos: Impuesto[];
  readonly onGuardado: () => void;
}) {
  const [tipo, setTipo] = useState<ProductoTipo>(producto?.tipo ?? "producto");
  const [inventariable, setInventariable] = useState(producto?.inventariable ?? false);
  const [impuestoId, setImpuestoId] = useState(
    producto?.impuesto_id ??
      impuestoPorTasa(impuestos, producto?.itbis_tasa ?? 18)?.id ??
      impuestoNinguno(impuestos)?.id ??
      "",
  );
  const [itbisTasa, setItbisTasa] = useState(String(producto?.itbis_tasa ?? 18));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const opcionesCategoria = [
    { value: SIN_CATEGORIA, label: "Sin categoría" },
    ...categorias.map((categoria) => ({ value: categoria.id, label: categoria.nombre })),
  ];

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const resultado = producto ? await actualizarProducto(producto.id, formData) : await crearProducto(formData);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onGuardado();
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <FormField htmlFor="nombre" label="Nombre" required>
          <Input
            id="nombre"
            name="nombre"
            required
            maxLength={200}
            defaultValue={producto?.nombre ?? ""}
            className={FORM_INPUT}
          />
        </FormField>

        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <FormField htmlFor="precio" label="Precio" required>
            <Input
              id="precio"
              name="precio"
              inputMode="decimal"
              required
              defaultValue={producto ? String(producto.precio) : ""}
              className={FORM_INPUT}
            />
          </FormField>

          <FormField htmlFor="impuesto_id" label="Impuesto">
            <SelectorImpuesto
              id="impuesto_id"
              name="impuesto_id"
              className={FORM_SELECT}
              impuestos={impuestos}
              value={impuestoId}
              onValueChange={(id) => {
                const impuesto = impuestos.find((item) => item.id === id);
                setImpuestoId(id);
                setItbisTasa(String(impuesto?.tarifa ?? 0));
              }}
            />
            <input type="hidden" name="itbis_tasa" value={itbisTasa} />
          </FormField>
        </div>

        <FormField htmlFor="tipo" label="Tipo">
          <Select
            name="tipo"
            value={tipo}
            onValueChange={(valor) => setTipo(valor ?? "producto")}
            items={OPCIONES_TIPO}
          >
            <SelectTrigger id="tipo" className={FORM_SELECT}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCIONES_TIPO.map((opcion) => (
                <SelectItem key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {tipo === "producto" ? (
          <CamposInventario
            producto={producto}
            inventariable={inventariable}
            onCambiarInventariable={setInventariable}
          />
        ) : null}

        <MasOpcionesProducto producto={producto} opcionesCategoria={opcionesCategoria} listasPrecios={listasPrecios} />

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" className="h-11 rounded-[12px] px-6" />}>
          Cancelar
        </DialogClose>
        <Button type="submit" disabled={pendiente} className="h-11 rounded-[12px] px-6">
          {pendiente ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ProductosCliente({
  productos,
  resumen,
  params,
  opciones,
  categorias,
  listasPrecios,
  impuestos,
  puedeEditar,
}: {
  readonly productos: Producto[];
  readonly resumen: ResumenPagina;
  readonly params: ParametrosLista;
  readonly opciones: OpcionesLista;
  readonly categorias: CategoriaProducto[];
  readonly listasPrecios: ListaPrecio[];
  readonly impuestos: Impuesto[];
  readonly puedeEditar: boolean;
}) {
  const router = useRouter();
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [edicionMasivaAbierta, setEdicionMasivaAbierta] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(() => new Set());
  const [productosConocidos, setProductosConocidos] = useState<Record<string, Producto>>(() =>
    Object.fromEntries(productos.map((producto) => [producto.id, producto])),
  );

  useEffect(() => {
    setProductosConocidos((actuales) => {
      const siguiente = { ...actuales };
      for (const producto of productos) siguiente[producto.id] = producto;
      return siguiente;
    });
  }, [productos]);

  const productosSeleccionados = [...seleccionados].flatMap((id) =>
    productosConocidos[id] ? [productosConocidos[id]] : [],
  );
  const todosVisiblesSeleccionados =
    productos.length > 0 && productos.every((producto) => seleccionados.has(producto.id));

  function alternarSeleccion(id: string, marcado: boolean) {
    setSeleccionados((anterior) => {
      const siguiente = new Set(anterior);
      if (marcado) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
  }

  function alternarTodosVisibles(marcado: boolean) {
    setSeleccionados((anterior) => {
      const siguiente = new Set(anterior);
      for (const producto of productos) {
        if (marcado) siguiente.add(producto.id);
        else siguiente.delete(producto.id);
      }
      return siguiente;
    });
  }

  function terminarEdicionMasiva() {
    setEdicionMasivaAbierta(false);
    setSeleccionados(new Set());
    router.refresh();
  }

  function abrirNuevo() {
    setProductoEditando(null);
    setDialogoAbierto(true);
  }

  function abrirEditar(producto: Producto) {
    setProductoEditando(producto);
    setDialogoAbierto(true);
  }

  function cambiarDialogo(abierto: boolean) {
    setDialogoAbierto(abierto);
    if (!abierto) setProductoEditando(null);
  }

  function cerrarTrasGuardar() {
    setDialogoAbierto(false);
    setProductoEditando(null);
    router.refresh();
  }

  return (
    <ContenedorLista>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Productos</h1>
          <p className="text-muted-foreground">Administra los productos y servicios que vendes.</p>
        </div>
        {puedeEditar ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setImportarAbierto(true)}>
              <Upload />
              Importar
            </Button>
            <Button type="button" onClick={abrirNuevo}>
              <Plus />
              Nuevo producto
            </Button>
          </div>
        ) : null}
      </div>

      <TarjetaLista data-lista="productos">
        <BarraLista>
          <BuscadorLista
            base="/dashboard/productos"
            parametros={params}
            valorInicial={opciones.q}
            placeholder="Buscar por nombre o referencia…"
            ariaLabel="Buscar productos"
            className="sm:max-w-[267px] [&_input]:h-8"
          />
          {puedeEditar ? (
            <Button
              type="button"
              variant="outline"
              className="ml-auto"
              disabled={seleccionados.size === 0}
              onClick={() => setEdicionMasivaAbierta(true)}
            >
              <Pencil />
              Editar seleccionados{seleccionados.size > 0 ? ` (${seleccionados.size})` : ""}
            </Button>
          ) : null}
        </BarraLista>

        <TablaLista
          columnas={columnasProductos()}
          filas={productos}
          claveFila={(producto) => producto.id}
          seleccion={
            puedeEditar
              ? {
                  cabecera: (
                    <Checkbox
                      checked={todosVisiblesSeleccionados}
                      onCheckedChange={(valor) => alternarTodosVisibles(valor === true)}
                      aria-label="Seleccionar todos los productos visibles"
                    />
                  ),
                  celda: (producto) => (
                    <Checkbox
                      checked={seleccionados.has(producto.id)}
                      onCheckedChange={(valor) => alternarSeleccion(producto.id, valor === true)}
                      aria-label={`Seleccionar ${producto.nombre}`}
                    />
                  ),
                }
              : undefined
          }
          acciones={
            puedeEditar
              ? (producto) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar ${producto.nombre}`}
                    onClick={() => abrirEditar(producto)}
                  >
                    <Pencil />
                  </Button>
                )
              : undefined
          }
          vacio={{
            filtrada: Boolean(opciones.q),
            titulo: opciones.q ? "Sin resultados" : "¡Aún no tienes productos!",
            descripcion: opciones.q
              ? "La búsqueda no arrojó productos."
              : "Crea tu primer producto o servicio para empezar.",
            icono: <Package className="size-10" />,
            accion: puedeEditar ? (
              <Button type="button" onClick={abrirNuevo}>
                <Plus />
                Nuevo producto
              </Button>
            ) : undefined,
          }}
        />

        <PaginadorLista
          base="/dashboard/productos"
          params={params}
          resumen={resumen}
          etiqueta="Ítems por página"
          tamano={opciones.tamano}
          opciones={TAMANOS_PAGINA}
          mostrarEnVacio
          botonesExtremos={false}
          className="border-border h-14 border-t px-4 text-slate-700 dark:text-slate-300"
        />
      </TarjetaLista>

      <Dialog open={dialogoAbierto} onOpenChange={cambiarDialogo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{productoEditando ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          </DialogHeader>
          <FormularioProducto
            key={productoEditando?.id ?? "nuevo"}
            producto={productoEditando}
            categorias={categorias}
            listasPrecios={listasPrecios}
            impuestos={impuestos}
            onGuardado={cerrarTrasGuardar}
          />
        </DialogContent>
      </Dialog>

      <ImportarProductosDialogo
        abierto={importarAbierto}
        categorias={categorias}
        onCambiarAbierto={setImportarAbierto}
      />

      <EditarSeleccionadosDialogo
        abierto={edicionMasivaAbierta}
        productos={productosSeleccionados}
        categorias={categorias}
        onCambiarAbierto={setEdicionMasivaAbierta}
        onTerminado={terminarEdicionMasiva}
      />
    </ContenedorLista>
  );
}
