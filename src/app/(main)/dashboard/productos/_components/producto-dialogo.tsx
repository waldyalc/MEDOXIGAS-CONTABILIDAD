"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ChevronDown } from "lucide-react";

import { CampoFormulario } from "@/components/formularios/campo-formulario";
import { FORM_INPUT, FORM_SELECT, FORM_TEXTAREA } from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { SelectorImpuesto } from "@/components/selector-impuesto";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { requerido } from "@/lib/formularios/validacion";
import { type Impuesto, impuestoNinguno, impuestoPorTasa } from "@/lib/impuestos/tipos";
import { etiquetaTipoLista } from "@/lib/inventario/precios";
import type { CategoriaProducto, ListaPrecio } from "@/lib/inventario/tipos";
import { actualizarProducto, crearProducto } from "@/lib/productos/actions";
import { type Producto, type ProductoTipo, SIN_CATEGORIA } from "@/lib/productos/productos";

const OPCIONES_TIPO = [
  { value: "producto", label: "Producto" },
  { value: "servicio", label: "Servicio" },
] as const;

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
          <CampoFormulario htmlFor="cantidad" label="Cantidad inicial">
            <Input
              id="cantidad"
              name="cantidad"
              inputMode="decimal"
              placeholder="0"
              defaultValue={producto ? String(producto.cantidad) : ""}
              className={FORM_INPUT}
            />
          </CampoFormulario>
          <CampoFormulario htmlFor="costo" label="Costo">
            <Input
              id="costo"
              name="costo"
              inputMode="decimal"
              placeholder="0"
              defaultValue={producto ? String(producto.costo) : ""}
              className={FORM_INPUT}
            />
          </CampoFormulario>
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
        <CampoFormulario htmlFor="categoria_id" label="Categoría">
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
        </CampoFormulario>
        {listasPrecios.length > 0 ? <PreciosPorLista listas={listasPrecios} producto={producto} /> : null}
        <CampoFormulario htmlFor="referencia" label="Referencia">
          <Input
            id="referencia"
            name="referencia"
            defaultValue={producto?.referencia ?? ""}
            placeholder="Ej. OXI-001"
            className={FORM_INPUT}
          />
        </CampoFormulario>
        <CampoFormulario htmlFor="descripcion" label="Descripción">
          <Textarea
            id="descripcion"
            name="descripcion"
            defaultValue={producto?.descripcion ?? ""}
            className={FORM_TEXTAREA}
          />
        </CampoFormulario>
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
  const validacion = useValidacionFormulario();

  const opcionesCategoria = [
    { value: SIN_CATEGORIA, label: "Sin categoría" },
    ...categorias.map((categoria) => ({ value: categoria.id, label: categoria.nombre })),
  ];

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
      const resultado = producto ? await actualizarProducto(producto.id, formData) : await crearProducto(formData);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onGuardado();
    });
  }

  return (
    <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <CampoFormulario htmlFor="nombre" label="Nombre" required error={validacion.errorDe("nombre")}>
          <Input
            id="nombre"
            name="nombre"
            required
            maxLength={200}
            defaultValue={producto?.nombre ?? ""}
            onChange={() => validacion.limpiar("nombre")}
            className={FORM_INPUT}
          />
        </CampoFormulario>

        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <CampoFormulario htmlFor="precio" label="Precio" required error={validacion.errorDe("precio")}>
            <Input
              id="precio"
              name="precio"
              inputMode="decimal"
              required
              defaultValue={producto ? String(producto.precio) : ""}
              onChange={() => validacion.limpiar("precio")}
              className={FORM_INPUT}
            />
          </CampoFormulario>

          <CampoFormulario htmlFor="impuesto_id" label="Impuesto">
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
          </CampoFormulario>
        </div>

        <CampoFormulario htmlFor="tipo" label="Tipo">
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
        </CampoFormulario>

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

export function ProductoDialogo({
  abierto,
  producto,
  categorias,
  listasPrecios,
  impuestos,
  onCambiarAbierto,
}: {
  readonly abierto: boolean;
  readonly producto: Producto | null;
  readonly categorias: CategoriaProducto[];
  readonly listasPrecios: ListaPrecio[];
  readonly impuestos: Impuesto[];
  readonly onCambiarAbierto: (abierto: boolean) => void;
}) {
  const router = useRouter();

  function cerrarTrasGuardar() {
    onCambiarAbierto(false);
    router.refresh();
  }

  return (
    <Dialog open={abierto} onOpenChange={onCambiarAbierto}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{producto ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        </DialogHeader>
        <FormularioProducto
          key={producto?.id ?? "nuevo"}
          producto={producto}
          categorias={categorias}
          listasPrecios={listasPrecios}
          impuestos={impuestos}
          onGuardado={cerrarTrasGuardar}
        />
      </DialogContent>
    </Dialog>
  );
}
