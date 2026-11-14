"use client";

import { type FormEvent, useState, useTransition } from "react";

import { ChevronDown, Pencil, Plus, Search, Upload } from "lucide-react";

import { Enlace } from "@/components/enlace";
import { SelectorImpuesto } from "@/components/selector-impuesto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { rutaProducto } from "@/lib/enlaces";
import { type Impuesto, impuestoNinguno, impuestoPorTasa } from "@/lib/impuestos/tipos";
import { etiquetaTipoLista } from "@/lib/inventario/precios";
import type { CategoriaProducto, ListaPrecio } from "@/lib/inventario/tipos";
import { actualizarProducto, crearProducto } from "@/lib/productos/actions";
import {
  etiquetaTasaItbis,
  filtrarProductos,
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

function FilaProducto({
  producto,
  puedeEditar,
  seleccionado,
  onAlternar,
  onEditar,
}: {
  readonly producto: Producto;
  readonly puedeEditar: boolean;
  readonly seleccionado: boolean;
  readonly onAlternar: (id: string, marcado: boolean) => void;
  readonly onEditar: (producto: Producto) => void;
}) {
  return (
    <TableRow data-state={seleccionado ? "selected" : undefined}>
      {puedeEditar ? (
        <TableCell>
          <Checkbox
            checked={seleccionado}
            onCheckedChange={(valor) => onAlternar(producto.id, valor === true)}
            aria-label={`Seleccionar ${producto.nombre}`}
          />
        </TableCell>
      ) : null}
      <TableCell className="font-medium">
        <Enlace href={rutaProducto(producto.id)}>{producto.nombre}</Enlace>
      </TableCell>
      <TableCell className="text-muted-foreground">{producto.referencia?.trim() || "—"}</TableCell>
      <TableCell className="text-right tabular-nums">{formatoMoneda(producto.precio)}</TableCell>
      <TableCell className="text-right">{etiquetaTasaItbis(producto.itbis_tasa)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {muestraInventario(producto) ? formatoCantidad(producto.cantidad) : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {muestraInventario(producto) ? formatoMoneda(producto.costo) : "—"}
      </TableCell>
      <TableCell>
        <Badge variant={producto.activo ? "outline" : "secondary"}>{producto.activo ? "Activo" : "Inactivo"}</Badge>
      </TableCell>
      {puedeEditar ? (
        <TableCell className="text-right">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${producto.nombre}`}
            onClick={() => onEditar(producto)}
          >
            <Pencil />
          </Button>
        </TableCell>
      ) : null}
    </TableRow>
  );
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
    <div className="flex flex-col gap-3 rounded-lg border p-3">
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="cantidad">Cantidad inicial</FieldLabel>
            <Input
              id="cantidad"
              name="cantidad"
              inputMode="decimal"
              placeholder="0"
              defaultValue={producto ? String(producto.cantidad) : ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="costo">Costo</FieldLabel>
            <Input
              id="costo"
              name="costo"
              inputMode="decimal"
              placeholder="0"
              defaultValue={producto ? String(producto.costo) : ""}
            />
          </Field>
        </div>
      ) : null}
    </div>
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
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="nombre">Nombre *</FieldLabel>
          <Input id="nombre" name="nombre" required maxLength={200} defaultValue={producto?.nombre ?? ""} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="precio">Precio *</FieldLabel>
            <Input
              id="precio"
              name="precio"
              inputMode="decimal"
              required
              defaultValue={producto ? String(producto.precio) : ""}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="impuesto_id">Impuesto</FieldLabel>
            <SelectorImpuesto
              id="impuesto_id"
              name="impuesto_id"
              className="w-full"
              impuestos={impuestos}
              value={impuestoId}
              onValueChange={(id) => {
                const impuesto = impuestos.find((item) => item.id === id);
                setImpuestoId(id);
                setItbisTasa(String(impuesto?.tarifa ?? 0));
              }}
            />
            <input type="hidden" name="itbis_tasa" value={itbisTasa} />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="tipo">Tipo</FieldLabel>
          <Select
            name="tipo"
            value={tipo}
            onValueChange={(valor) => setTipo(valor ?? "producto")}
            items={OPCIONES_TIPO}
          >
            <SelectTrigger id="tipo" className="w-full">
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
        </Field>

        {tipo === "producto" ? (
          <CamposInventario
            producto={producto}
            inventariable={inventariable}
            onCambiarInventariable={setInventariable}
          />
        ) : null}

        <Collapsible
          className="rounded-lg border"
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
          <CollapsibleContent className="flex flex-col gap-4 border-t p-3">
            <Field>
              <FieldLabel htmlFor="categoria_id">Categoría</FieldLabel>
              <Select
                name="categoria_id"
                defaultValue={producto?.categoria_id ?? SIN_CATEGORIA}
                items={opcionesCategoria}
              >
                <SelectTrigger id="categoria_id" className="w-full">
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
            </Field>
            {listasPrecios.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Precios por lista</span>
                  <span className="text-muted-foreground text-xs">
                    Valor fijo en RD$ o porcentaje sobre el precio (10 = +10 %, -10 = descuento).
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {listasPrecios.map((lista) => {
                    const valor = producto?.precios.find((precio) => precio.lista_id === lista.id)?.precio;

                    return (
                      <Field key={lista.id}>
                        <FieldLabel htmlFor={`precio_lista_${lista.id}`}>
                          {lista.nombre}
                          {lista.es_principal ? " (principal)" : ""}
                        </FieldLabel>
                        <Input
                          id={`precio_lista_${lista.id}`}
                          name={`precio_lista_${lista.id}`}
                          inputMode="decimal"
                          placeholder={lista.tipo === "porcentaje" ? "0" : "0.00"}
                          defaultValue={valor === undefined ? "" : String(valor)}
                        />
                        <span className="text-muted-foreground text-xs">{etiquetaTipoLista(lista.tipo)}</span>
                      </Field>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <Field>
              <FieldLabel htmlFor="referencia">Referencia</FieldLabel>
              <Input
                id="referencia"
                name="referencia"
                defaultValue={producto?.referencia ?? ""}
                placeholder="Ej. OXI-001"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="descripcion">Descripción</FieldLabel>
              <Textarea id="descripcion" name="descripcion" defaultValue={producto?.descripcion ?? ""} />
            </Field>
          </CollapsibleContent>
        </Collapsible>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </FieldGroup>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ProductosCliente({
  productos,
  categorias,
  listasPrecios,
  impuestos,
  puedeEditar,
}: {
  readonly productos: Producto[];
  readonly categorias: CategoriaProducto[];
  readonly listasPrecios: ListaPrecio[];
  readonly impuestos: Impuesto[];
  readonly puedeEditar: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [edicionMasivaAbierta, setEdicionMasivaAbierta] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(() => new Set());

  const filtrados = filtrarProductos(productos, busqueda);
  const productosSeleccionados = productos.filter((producto) => seleccionados.has(producto.id));
  const todosVisiblesSeleccionados =
    filtrados.length > 0 && filtrados.every((producto) => seleccionados.has(producto.id));

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
      for (const producto of filtrados) {
        if (marcado) siguiente.add(producto.id);
        else siguiente.delete(producto.id);
      }
      return siguiente;
    });
  }

  function terminarEdicionMasiva() {
    setEdicionMasivaAbierta(false);
    setSeleccionados(new Set());
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
  }

  return (
    <div className="flex flex-col gap-6">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre o referencia…"
            aria-label="Buscar productos"
            className="pl-8"
          />
        </div>
        {puedeEditar ? (
          <Button
            type="button"
            variant="outline"
            disabled={seleccionados.size === 0}
            onClick={() => setEdicionMasivaAbierta(true)}
          >
            <Pencil />
            Editar seleccionados{seleccionados.size > 0 ? ` (${seleccionados.size})` : ""}
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {puedeEditar ? (
                <TableHead className="w-8">
                  <Checkbox
                    checked={todosVisiblesSeleccionados}
                    onCheckedChange={(valor) => alternarTodosVisibles(valor === true)}
                    aria-label="Seleccionar todos los productos visibles"
                  />
                </TableHead>
              ) : null}
              <TableHead>Nombre</TableHead>
              <TableHead>Referencia</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">ITBIS</TableHead>
              <TableHead className="text-right">Existencia</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead>Estado</TableHead>
              {puedeEditar ? (
                <TableHead className="w-10">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={puedeEditar ? 9 : 7}
                  className="text-muted-foreground h-24 text-center whitespace-normal"
                >
                  {busqueda.trim()
                    ? "No se encontraron productos con esa búsqueda."
                    : "Todavía no hay productos registrados."}
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((producto) => (
                <FilaProducto
                  key={producto.id}
                  producto={producto}
                  puedeEditar={puedeEditar}
                  seleccionado={seleccionados.has(producto.id)}
                  onAlternar={alternarSeleccion}
                  onEditar={abrirEditar}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
    </div>
  );
}
